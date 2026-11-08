-- 辅助码过滤器
-- 本过滤器根据上下文中的形码输入，过滤候选词，并在候选词上显示形码提示。

local snow = require "snow.snow"
local bihua = require "snow.bihua"
local auxiliary_semantics = require "snow.auxiliary_semantics"
local auxiliary_hint = require "snow.auxiliary_hint"

---@class ShapeFilterEnv: BihuaEnv
---@field shape_elements ReverseLookup|nil
---@field pinyin ReverseLookup|nil
---@field memory Memory|nil
---@field shape_mapping table<string, string>
---@field jiandao_shape_cache table<string, string>

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
local sanpin_semantics = auxiliary_semantics["21x21"]
---@type table<string, string>
local sanpin_stroke_map = {}
---@type table<string, string>
local sanpin_tones = {}
---@type table<string, string>
local sanpin_tone_keys = sanpin_semantics.tone_keys_by_digit
for digit, key in pairs(sanpin_semantics.stroke_keys_by_digit) do
  sanpin_stroke_map[stroke_names[digit]] = key
end
for digit, key in pairs(sanpin_semantics.tone_keys_by_digit) do
  sanpin_tones[key] = digit
end

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
---@param candidate Candidate?
local function sanpin_initial_pair_match(text, shape_input, env, candidate)
  local tone = sanpin_tones[shape_input]
  local prompt = tone and " 调[" .. shape_input .. "]" or nil
  if not tone or utf8.len(text) ~= 2 then
    return false, prompt, nil
  end
  local readings = ""
  if candidate and env.memory then
    local phrase = candidate:get_genuine():to_phrase()
    if phrase then
      local spellings = env.memory:decode(phrase.entry.code)
      readings = spellings[2] or ""
    end
  end
  if readings == "" then
    readings = lookup(env.pinyin, snow.sub(text, 2, 2))
  end
  for reading in readings:gmatch("%S+") do
    if reading:sub(-1) == tone then
      return true, prompt, nil
    end
  end
  return false, prompt, nil
end

--- 冰雪四拼和冰雪弎拼的笔画匹配函数
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
  -- 查不到部首时 encode 返回空串；Lua 中空串为真，不能用 not code 判空。
  local match = code == "" or code:sub(1, #partial_code) == partial_code
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
  -- 普通词组取每个字的形码首码；冰雪键道与冰雪健道
  -- 共用二／三／四字 CKT v5.1 辅序 12/231/24。
  for i, code in ipairs(codes) do
    codes[i] = code:sub(1, 1)
  end
  local positions
  if #codes == 2 then
    positions = { 1, 2 }
  elseif #codes == 3 then
    positions = { 2, 3, 1 }
  elseif #codes == 4 then
    positions = { 2, 4 }
  else
    return table.concat(codes)
  end
  local result = ""
  for _, position in ipairs(positions) do
    result = result .. codes[position]
  end
  return result
end

---@param length integer
---@return integer[]
local function sanpin_auxiliary_positions(length)
  if length == 1 then return { 1 } end
  if length == 2 then return { 1, 2 } end
  if length == 3 then return { 2, 1, 3 } end
  if length == 4 then return { 2, 3 } end
  local positions = { length, 1, 2 }
  for index = 3, length - 1 do table.insert(positions, index) end
  return positions
end

---@param candidate Candidate?
---@param env ShapeFilterEnv
---@return string[]?
local function sanpin_spellings(candidate, env)
  if not candidate or not env.memory then return nil end
  local phrase = candidate:get_genuine():to_phrase()
  return phrase and env.memory:decode(phrase.entry.code) or nil
end

---@param text string
---@param position integer
---@param spellings string[]?
---@param tone_keys table<string, string>
---@param env ShapeFilterEnv
---@return string[]
local function sanpin_tone_options(text, position, spellings, tone_keys, env)
  local result = {}
  local seen = {}
  local function add(spelling)
    local tone = spelling:match("([1-5])$")
    local key = tone and tone_keys[tone] or nil
    if key and not seen[key] then
      seen[key] = true
      table.insert(result, key)
    end
  end
  if spellings and spellings[position] then
    add(spellings[position])
    return result
  end
  local character = snow.sub(text, position, position)
  for spelling in lookup(env.pinyin, character):gmatch("%S+") do add(spelling) end
  return result
end

---@param current string
---@param word_length integer
---@return integer[]?, string?
local function sanpin_route(current, word_length)
  local initial = "[bpmfdtnlgkhjqxzcsrywe]"
  local suffix
  if word_length == 1 then
    suffix = current:match("^" .. initial .. "[a-z]([ivuao]*)$")
    return suffix and { 1 } or nil, suffix
  elseif word_length == 2 then
    suffix = current:match("^" .. initial .. "[a-z]" .. initial .. "[a-z]([ivuao]*)$")
    return suffix and { 1, 2 } or nil, suffix
  end
  suffix = current:match("([ivuao]*)$") or ""
  local sound = suffix == "" and current or current:sub(1, -suffix:len() - 1)
  local groups = {}
  for group in sound:gmatch(initial .. "[A-Z]?") do table.insert(groups, group) end
  if #groups < 3 or table.concat(groups) ~= sound or word_length < #groups then return nil, nil end
  return sanpin_auxiliary_positions(#groups), suffix
end

---@param text string
---@param current string
---@param env ShapeFilterEnv
---@param candidate Candidate?
---@return string?
local function sanpin_auxiliary_hint(text, current, env, candidate)
  local word_length = utf8.len(text)
  if not word_length then return nil end
  local positions, suffix = sanpin_route(current, word_length)
  if not positions or suffix == nil then return nil end
  local spellings = sanpin_spellings(candidate, env)
  local codes = { "" }
  for _, position in ipairs(positions) do
    local options = sanpin_tone_options(text, position, spellings, sanpin_tone_keys, env)
    if #options == 0 then return nil end
    local expanded = {}
    for _, code in ipairs(codes) do
      for _, key in ipairs(options) do table.insert(expanded, code .. key) end
    end
    codes = expanded
  end
  local next_tones = auxiliary_hint.next_codes(codes, suffix)
  if next_tones == "" then return nil end
  local order = ""
  if #positions > 1 then
    for _, position in ipairs(positions) do order = order .. tostring(position) end
    order = order:gsub("1", "₁"):gsub("2", "₂"):gsub("3", "₃"):gsub("4", "₄")
  end
  return ("〔调%s %s〕"):format(order, next_tones)
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
  elseif id == "snow_sanpin" or id == "snow_sanpin_classic" then
    sanpin_initial_pair = shape_input:len() == 1
        and context:get_property("shape_status") == "initial_pair"
    sanpin_passthrough = shape_input:len() == 0
        and not rime_api.regex_match(current, "[bpmfdtnlgkhjqxzcsrywe][a-z][viuoa]")
  elseif id == "snow_jiandao" or id == "snow_jiandao_classic" then
    if id == "snow_jiandao_classic" then
      jiandao_active = shape_input:len() > 0
          or rime_api.regex_match(current, "[bpmfdtnlgkhjqxzcsrywe][a-z]([bpmfdtnlgkhjqxzcsrywe][a-z]?)?")
    else
      jiandao_active = shape_input:len() > 0
          or current:find("[BPMFDTNLGKHJQXZCSRYWE]") ~= nil
          or rime_api.regex_match(current, "[bpmfdtnlgkhjqxzcsrywe]{2,4}")
    end
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
  if id == "snow_sipin" or id == "snow_sanpin" or id == "snow_sanpin_classic" then
    bihua.load_strokes(env)
  end
  if id == "snow_sanpin" or id == "snow_sanpin_classic" then
    env.pinyin = ReverseLookup("snow_pinyin")
    env.memory = Memory(env.engine, env.engine.schema, "translator")
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
---@param candidate? Candidate
function filter.handle_candidate(text, shape_input, env, state, candidate)
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
  elseif state.id == "snow_sanpin" or state.id == "snow_sanpin_classic" then -- 冰雪弎拼／冰雪三拼
    if state.sanpin_initial_pair then
      return sanpin_initial_pair_match(text, shape_input, env, candidate)
    end
    if shape_input == "" then
      local comment = sanpin_auxiliary_hint(text, state.current, env, candidate)
      if comment then return true, nil, comment end
    end
    if state.sanpin_passthrough then
      return true, nil, nil
    end
    if shape_input:sub(1, 1) == "1" then
      return radical_match(text, shape_input:sub(2), env)
    else
      return stroke_match(text, shape_input, env, sanpin_reverse_stroke_map, sanpin_direct_stroke_map)
    end
  elseif state.id == "snow_jiandao" or state.id == "snow_jiandao_classic" then -- 冰雪健道／冰雪键道
    if state.is_pinyin or state.jiandao_active then
      local code = jiandao_encode(
        text, state.current, env.shape_elements, env.shape_mapping, env.jiandao_shape_cache)
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
  local shape_input = context:get_property("shape_input") or ""
  local state = current_state(env)
  local has_candidate = false
  local has_match = false
  ---@type string?
  local first_preedit = nil
  for candidate in translation:iter() do
    has_candidate = true
    local show, prompt, comment = filter.handle_candidate(candidate.text, shape_input, env, state, candidate)
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
  env.memory = nil
  env.shape_mapping = nil
  bihua.release_strokes(env)
  collectgarbage()
end

return filter
