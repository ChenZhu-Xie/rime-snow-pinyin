-- 辅助码过滤器
-- 本过滤器根据上下文中的形码输入，过滤候选词，并在候选词上显示形码提示。

local snow = require "snow.snow"
local bihua = require "snow.bihua"

---@class ShapeFilterEnv: BihuaEnv
---@field shape_elements ReverseLookup|nil
---@field pinyin ReverseLookup|nil
---@field shape_mapping table<string, string>
---@field jiandao_shape_cache table<string, string>
---@field vacant_initial_pattern string

--- 反查库加载失败时为 nil，当作查不到
---@param db ReverseLookup|nil
---@param text string
---@return string
local function lookup(db, text)
  return db and db:lookup(text) or ""
end

--- 将字符串中每一个字符替换为 map 中对应的值
---@param element string
---@param map table<string, string>
local function encode(element, map)
  local result = ""
  for _, c in utf8.codes(element) do
    local character = utf8.char(c)
    local value = map[character]
    if value then
      result = result .. value
    end
  end
  return result
end


local stroke_names = { ["1"] = "一", ["2"] = "丨", ["3"] = "丿", ["4"] = "丶", ["5"] = "乙" }
local sipin_stroke_map = { ["一"] = "e", ["丨"] = "i", ["丿"] = "u", ["丶"] = "o", ["乙"] = "a" }
local sanpin_stroke_map = { ["一"] = "i", ["丨"] = "v", ["丿"] = "u", ["丶"] = "a", ["乙"] = "o" }
local sanpin_tones = { i = "1", v = "2", u = "3", a = "4", o = "5" }

---@param map table<string, string>
---@return table<string, string>, table<string, string>
local function stroke_maps(map)
  local reverse_map = {}
  local direct_map = {}
  for stroke, key in pairs(map) do
    reverse_map[key] = stroke
  end
  for number, stroke in pairs(stroke_names) do
    direct_map[number] = map[stroke]
  end
  return reverse_map, direct_map
end

local sipin_reverse_stroke_map, sipin_direct_stroke_map = stroke_maps(sipin_stroke_map)
local sanpin_reverse_stroke_map, sanpin_direct_stroke_map = stroke_maps(sanpin_stroke_map)

--- 声声二字词的一次辅码按第二字声调筛选。
---@param text string
---@param shape_input string
---@param env ShapeFilterEnv
local function sanpin_initial_pair_match(text, shape_input, env)
  local tone = sanpin_tones[shape_input]
  local prompt = tone and " 调[" .. shape_input .. "]" or nil
  if not tone or utf8.len(text) ~= 2 then
    return false, prompt, nil
  end
  local readings = lookup(env.pinyin, snow.sub(text, 2, 2))
  for reading in readings:gmatch("%S+") do
    if reading:sub(-1) == tone then
      return true, prompt, nil
    end
  end
  return false, prompt, nil
end

--- 冰雪四拼和冰雪三拼的笔画匹配函数
--- @param text string
--- @param partial_code string
--- @param env ShapeFilterEnv
--- @param reverse_map table<string, string>
--- @param direct_map table<string, string>
local function stroke_match(text, partial_code, env, reverse_map, direct_map)
  ---@type string?
  local prompt = nil
  if partial_code:len() > 0 then
    prompt = " 笔画 [" .. partial_code:gsub(".", reverse_map) .. "]"
  end
  -- 未收录的字不做笔画过滤；已收录但没有启用任何来源的字不能匹配。
  local elements, known = bihua.codes(text, env)
  local match = partial_code == "" or not known
  ---@type string[]
  local codes = {}
  for _, element in ipairs(elements) do
    local code = encode(element, direct_map)
    if code:len() > partial_code:len() + 4 then
      code = code:sub(1, partial_code:len() + 4) .. "~"
    end
    table.insert(codes, code)
    ---@type boolean
    match = match or code:sub(1, #partial_code) == partial_code
  end
  local comment = table.concat(codes, " ")
  return match, prompt, comment
end

--- @param text string
--- @param partial_code string
--- @param env ShapeFilterEnv
local function radical_match(text, partial_code, env)
  local element = lookup(env.shape_elements, text)
  local code = encode(element, env.shape_mapping)
  local prompt = " 部首 [" .. partial_code .. "]"
  local comment = code .. " " .. element
  local match = not code or code:sub(1, #partial_code) == partial_code
  return match, prompt, comment
end

--- 键道的特殊处理
---@param text string
---@param current string
---@param radicals_map ReverseLookup|nil
---@param map table<string, string>
---@param cache table<string, string>
local function jiandao_encode(text, current, radicals_map, map, cache)
  -- 把 UTF-8 编码的词语拆成单个字符的列表
  ---@type string[]
  local codes = {}
  for _, codepoint in utf8.codes(text) do
    local char = utf8.char(codepoint)
    local code = cache[char]
    if code == nil then
      local radicals = lookup(radicals_map, char)
      code = ""
      for _, radical_codepoint in utf8.codes(radicals) do
        local r = utf8.char(radical_codepoint)
        local radical_code = map[r] or ""
        code = code .. radical_code
      end
      cache[char] = code
    end
    table.insert(codes, code)
  end
  if #codes == 2 and current:len() == 1 then -- 630
    return (codes[2] or "??"):sub(1, 2)
  elseif #codes == 1 then
    -- 如果只有一个字符，直接返回对应的编码
    return codes[1] or "??"
  end
  -- 普通词组取每个字的形码首码，不限制词长
  for i, code in ipairs(codes) do
    codes[i] = code:sub(1, 1)
  end
  return table.concat(codes)
end

local filter = {}

---@class ShapeFilterState
---@field id string
---@field current string
---@field is_pinyin boolean
---@field show_chaifen boolean
---@field initial_pair boolean
---@field sipin_passthrough boolean
---@field sanpin_initial_pair boolean
---@field sanpin_passthrough boolean
---@field jiandao_active boolean

---@param env ShapeFilterEnv
---@return ShapeFilterState
local function current_state(env)
  local context = env.engine.context
  local segment = context.composition:toSegmentation():back()
  local id = env.engine.schema.schema_id
  local current = snow.current(context) or ""
  local shape_input = context.get_property and context:get_property("shape_input") or ""
  local sipin_passthrough = false
  local sanpin_initial_pair = false
  local sanpin_passthrough = false
  local jiandao_active = false
  if id == "snow_sipin" then
    sipin_passthrough = shape_input:len() == 0
        and not rime_api.regex_match(current, "[bpmfdtnlgkhjqxzcsrwyv][aeiou]{3}")
  elseif id == "snow_sanpin" then
    sanpin_initial_pair = shape_input:len() == 1
        and rime_api.regex_match(current, env.vacant_initial_pattern)
    sanpin_passthrough = shape_input:len() == 0
        and not rime_api.regex_match(current, "[bpmfdtnlgkhjqxzcsrywe][a-z][viuoa]")
  elseif id == "snow_jiandao" then
    jiandao_active = shape_input:len() > 0 or current:find("[A-Z]") ~= nil
        or rime_api.regex_match(current, "[bpmfdtnlgkhjqxzcsrywe][a-z]([bpmfdtnlgkhjqxzcsrywe][a-z]?)?")
  end
  return {
    id = id,
    current = current,
    is_pinyin = segment and segment:has_tag("pinyin") or false,
    show_chaifen = context.get_option and context:get_option("chaifen") or false,
    initial_pair = context.get_property and context:get_property("shape_status") == "initial_pair" or false,
    sipin_passthrough = sipin_passthrough,
    sanpin_initial_pair = sanpin_initial_pair,
    sanpin_passthrough = sanpin_passthrough,
    jiandao_active = jiandao_active,
  }
end

---@param env ShapeFilterEnv
function filter.init(env)
  local config = env.engine.schema.config
  local dir = rime_api.get_user_data_dir() .. "/lua/snow/"
  local id = env.engine.schema.schema_id
  if id == "snow_sipin" or id == "snow_sanpin" then
    bihua.load_strokes(env)
  end
  env.vacant_initial_pattern = config:get_string("translator/vacant_initial_pattern") or "^$"
  if id == "snow_sanpin" then
    env.pinyin = ReverseLookup("snow_pinyin")
  end
  local shape_elements = config:get_string("translator/shape_elements") or "snow_bushou"
  env.shape_elements = ReverseLookup(shape_elements)
  local shape_mapping = config:get_string("translator/shape_mapping") or "radical_sipin.txt"
  env.shape_mapping = snow.table_from_tsv(dir .. shape_mapping)
  env.jiandao_shape_cache = {}
end

---@param text string
---@param shape_input string
---@param env ShapeFilterEnv
---@param state? ShapeFilterState
function filter.handle_candidate(text, shape_input, env, state)
  state = state or current_state(env)
  if state.id == "snow_sipin" then -- 冰雪四拼
    if state.sipin_passthrough then
      return true, nil, nil
    end
    if shape_input:sub(1, 1) == "1" then
      return radical_match(text, shape_input:sub(2), env)
    else
      return stroke_match(text, shape_input, env, sipin_reverse_stroke_map, sipin_direct_stroke_map)
    end
  elseif state.id == "snow_sanpin" then -- 冰雪三拼
    if state.sanpin_initial_pair then
      return sanpin_initial_pair_match(text, shape_input, env)
    end
    if state.sanpin_passthrough then
      return true, nil, nil
    end
    if shape_input:sub(1, 1) == "1" then
      return radical_match(text, shape_input:sub(2), env)
    else
      return stroke_match(text, shape_input, env, sanpin_reverse_stroke_map, sanpin_direct_stroke_map)
    end
  elseif state.id == "snow_jiandao" then -- 冰雪键道
    if state.is_pinyin or state.jiandao_active then
      local code = jiandao_encode(
        text, state.current, env.shape_elements, env.shape_mapping, env.jiandao_shape_cache
      )
      local prompt = shape_input:len() > 0
          and (state.initial_pair and " 形[" .. shape_input .. "]" or " 形 [" .. shape_input .. "]") or nil
      local match = code == "" or code:sub(1, #shape_input) == shape_input
      local comment = code
      if not state.is_pinyin and state.current:len() == 1 then
        comment = "" -- 630 不需要提示
      elseif utf8.len(text) == 1 and (state.show_chaifen or state.is_pinyin) then
        local chaifen = lookup(env.shape_elements, text)
        comment = comment .. " " .. chaifen
      end
      return match, prompt, comment
    else
      return true, nil, nil
    end
  elseif state.id == "snow_yipin" then -- 冰雪一拼
    local partial_code = ""
    local prompt = ""
    local element = lookup(env.shape_elements, text)
    local code = encode(element, env.shape_mapping)
    local comment = (code .. " " .. element):gsub("rj", "'")
    if shape_input:sub(1, 1) == "v" then
      partial_code = shape_input:sub(2, -2):gsub("([a-z])%1", function(a, b)
        return a:upper()
      end)
      prompt = (" [" .. partial_code .. "]"):gsub("rj", "'")
    end
    local match = partial_code == "" or code == partial_code
    return match, prompt, comment
  else
    return true, nil, nil
  end
end

---@param translation Translation
---@param env ShapeFilterEnv
function filter.func(translation, env)
  local context = env.engine.context
  local shape_input = context:get_property("shape_input")
  local state = current_state(env)
  local has_candidate = false
  local has_match = false
  ---@type string?
  local first_preedit = nil
  for candidate in translation:iter() do
    has_candidate = true
    local show, prompt, comment = filter.handle_candidate(candidate.text, shape_input, env, state)
    if not first_preedit and prompt then
      first_preedit = candidate.preedit .. prompt
    end
    if show then
      if comment then snow.comment(candidate, comment) end
      if prompt then candidate.preedit = candidate.preedit .. prompt end
      has_match = true
      yield(candidate)
    end
  end
  if has_candidate and not has_match then
    local segment = context.composition:toSegmentation():back()
    if not segment then
      return
    end
    local candidate = Candidate("hint", segment.start, segment._end, "🈚️", "无匹配候选词")
    candidate.preedit = first_preedit or ""
    yield(candidate)
  end
end

---@param segment Segment
---@param env Env
function filter.tags_match(segment, env)
  return segment:has_tag("abc") or segment:has_tag("pinyin")
end

---@param env ShapeFilterEnv
function filter.fini(env)
  env.shape_elements = nil
  env.pinyin = nil
  env.shape_mapping = nil
  bihua.release_strokes(env)
end

return filter
