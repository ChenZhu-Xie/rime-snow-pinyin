-- 冰雪神韵·形 / 冰雪神韵·调的飞码式翻译器
--
-- 主码族：一简 A、单字 AU、二字 AUAU、三字 AAA / AAAU、四字 AAAA。
-- 两个方案共用 R10-21X26-M39-08 声韵映射，只在 B 辅码语义上不同：
--   shape: 键道式部首形辅，物理键 avuio -> aeuio；
--   tone:  第一个 B 为声调 12345 -> ieuao，后续 B 为五笔画；数字 1 独立进入部首码。

local snow = require "snow.snow"

local this = {}

---@class ShenyunEnv: Env
---@field translator Translator
---@field pinyin ReverseLookup
---@field strokes ReverseLookup
---@field shape_elements ReverseLookup
---@field shape_mapping table<string, string>
---@field initial_keys string
---@field final_keys string
---@field auxiliary_keys string
---@field auxiliary_mode string

local function contains(keys, character)
  return keys:find(character, 1, true) ~= nil
end

local function all_in(input, first, keys)
  for index = first, input:len() do
    if not contains(keys, input:sub(index, index)) then
      return false
    end
  end
  return true
end

local function characters(text)
  local result = {}
  for _, codepoint in utf8.codes(text) do
    table.insert(result, utf8.char(codepoint))
  end
  return result
end

local function encode_elements(character, env)
  local radicals = env.shape_elements:lookup(character) or ""
  local result = ""
  for _, codepoint in utf8.codes(radicals) do
    local radical = utf8.char(codepoint)
    result = result .. (env.shape_mapping[radical] or "")
  end
  return result
end

local function encode_radical(character, env)
  -- 键道的五部物理键 avuio 迁移到神韵的 aeuio，小集合仍与 A 键互斥。
  local code = encode_elements(character, env):gsub("v", "e")
  return code
end

local function first_or_empty(value)
  return value:sub(1, 1)
end

local function shape_codes(text, env)
  local chars = characters(text)
  local codes = {}
  for _, character in ipairs(chars) do
    table.insert(codes, encode_radical(character, env))
  end
  if #codes == 1 then
    return { codes[1] }
  elseif #codes == 2 then
    -- 飞花式二字扩展：先第二字 B2，再第一字 B1。
    return { first_or_empty(codes[2]) .. first_or_empty(codes[1]) }
  elseif #codes >= 3 then
    -- 三、四字词的标准四码后，依次取第一、第二字形辅。
    return { first_or_empty(codes[1]) .. first_or_empty(codes[2]) }
  end
  return { "" }
end

local tone_keys = { ["1"] = "i", ["2"] = "e", ["3"] = "u", ["4"] = "a", ["5"] = "o" }
local stroke_keys = { h = "e", s = "i", p = "u", n = "o", z = "a" }

local function unique(values)
  local seen = {}
  local result = {}
  for _, value in ipairs(values) do
    if value ~= "" and not seen[value] then
      seen[value] = true
      table.insert(result, value)
    end
  end
  return result
end

local function tone_options(character, env)
  local result = {}
  for spelling in (env.pinyin:lookup(character) or ""):gmatch("[^ ]+") do
    local tone = spelling:match("([1-5])$")
    if tone and tone_keys[tone] then
      table.insert(result, tone_keys[tone])
    end
  end
  return unique(result)
end

local function stroke_options(character, env)
  local result = {}
  for stroke in (env.strokes:lookup(character) or ""):gmatch("[^ ]+") do
    local code = ""
    for index = 1, stroke:len() do
      code = code .. (stroke_keys[stroke:sub(index, index)] or "")
    end
    table.insert(result, code)
  end
  return unique(result)
end

local function tone_codes(text, env)
  local chars = characters(text)
  if #chars == 0 then return { "" } end
  local tones = {}
  for index, character in ipairs(chars) do
    tones[index] = tone_options(character, env)
    if #tones[index] == 0 then tones[index] = { "" } end
  end
  local result = {}
  if #chars == 1 then
    local strokes = stroke_options(chars[1], env)
    if #strokes == 0 then strokes = { "" } end
    for _, tone in ipairs(tones[1]) do
      for _, stroke in ipairs(strokes) do
        -- 单字以声调为第一辅码，之后可继续用四拼式 aeuio 笔画筛选。
        table.insert(result, tone .. stroke)
      end
    end
  elseif #chars == 2 then
    -- 飞花式二字扩展顺序 B2B1。
    for _, second in ipairs(tones[2]) do
      for _, first in ipairs(tones[1]) do
        table.insert(result, second .. first)
      end
    end
  else
    -- 三、四字词标准四码后的 B1B2。
    for _, first in ipairs(tones[1]) do
      for _, second in ipairs(tones[2]) do
        table.insert(result, first .. second)
      end
    end
  end
  return unique(result)
end

local function auxiliary_codes(text, env)
  if env.auxiliary_mode == "tone" then
    return tone_codes(text, env)
  end
  return shape_codes(text, env)
end

local function auxiliary_match(text, suffix, env)
  local radical_input = env.engine.context:get_property("shape_input") or ""
  if radical_input ~= "" then
    if env.auxiliary_mode ~= "tone" or utf8.len(text) ~= 1
        or radical_input:sub(1, 1) ~= "1" then
      return false, ""
    end
    local radical_code = encode_elements(text, env)
    local prefix = radical_input:sub(2)
    if radical_code:sub(1, #prefix) ~= prefix then
      return false, radical_code
    end
  end
  local codes = auxiliary_codes(text, env)
  if suffix == "" then return true, table.concat(codes, "/") end
  for _, code in ipairs(codes) do
    if code:sub(1, suffix:len()) == suffix then
      return true, table.concat(codes, "/")
    end
  end
  return false, table.concat(codes, "/")
end

local function add_route(routes, family, proxy, suffix, length)
  table.insert(routes, { family = family, proxy = proxy, suffix = suffix, length = length })
end

local function routes_for(input, env)
  local routes = {}
  local n = input:len()
  local A, U, B = env.initial_keys, env.final_keys, env.auxiliary_keys

  if n == 1 and contains(A, input) then
    add_route(routes, "A", input, "", 1)
  end
  if n >= 2 and contains(A, input:sub(1, 1)) and contains(U, input:sub(2, 2))
      and all_in(input, 3, B) then
    add_route(routes, "AU", input:sub(1, 2), input:sub(3), 1)
  end
  if n >= 4 and contains(A, input:sub(1, 1)) and contains(U, input:sub(2, 2))
      and contains(A, input:sub(3, 3)) and contains(U, input:sub(4, 4))
      and all_in(input, 5, B) then
    add_route(routes, "AUAU", input:sub(1, 2) .. " " .. input:sub(3, 4), input:sub(5), 2)
  end
  if n == 3 and all_in(input, 1, A) then
    add_route(routes, "AAA", input:sub(1, 1) .. " " .. input:sub(2, 2) .. " " .. input:sub(3, 3), "", 3)
  end
  if n >= 4 and all_in(input:sub(1, 3), 1, A) and contains(U, input:sub(4, 4))
      and all_in(input, 5, B) then
    add_route(routes, "AAAU", input:sub(1, 1) .. " " .. input:sub(2, 2) .. " " .. input:sub(3, 4), input:sub(5), 3)
  end
  if n >= 4 and all_in(input:sub(1, 4), 1, A) and all_in(input, 5, B) then
    add_route(routes, "AAAA", input:sub(1, 1) .. " " .. input:sub(2, 2) .. " " ..
      input:sub(3, 3) .. " " .. input:sub(4, 4), input:sub(5), 4)
  end
  return routes
end

function this.init(env)
  local config = env.engine.schema.config
  env.translator = Component.Translator(env.engine, "shenyun", "script_translator")
  env.pinyin = ReverseLookup("snow_pinyin")
  env.strokes = ReverseLookup("stroke")
  local shape_elements = config:get_string("translator/shape_elements") or "snow_jiandao_chaifen"
  env.shape_elements = ReverseLookup(shape_elements)
  local shape_mapping = config:get_string("translator/shape_mapping") or "radical_jiandao.txt"
  env.shape_mapping = snow.table_from_tsv(rime_api.get_user_data_dir() .. "/lua/snow/" .. shape_mapping)
  env.initial_keys = config:get_string("translator/shenyun_initial_keys") or "bpmfdtnlgkhjqwvxrzcsy"
  env.final_keys = config:get_string("translator/shenyun_final_keys") or "abcdefghijklmnopqrstuvwxyz"
  env.auxiliary_keys = config:get_string("translator/shenyun_auxiliary_keys") or "aeuio"
  env.auxiliary_mode = config:get_string("shenyun_options/auxiliary") or "shape"
end

function this.func(input, segment, env)
  local found = {}
  for _, route in ipairs(routes_for(input, env)) do
    local translation = env.translator:query(route.proxy, segment)
    if translation then
      for candidate in translation:iter() do
        if candidate.type ~= "sentence" and utf8.len(candidate.text) == route.length then
          local matches, auxiliary = auxiliary_match(candidate.text, route.suffix, env)
          if matches then
            table.insert(found, { candidate = candidate, auxiliary = auxiliary, family = route.family })
          end
        end
      end
    end
  end
  table.sort(found, function(left, right)
    return (left.candidate.quality or 0) > (right.candidate.quality or 0)
  end)
  local seen = {}
  for _, item in ipairs(found) do
    local candidate = item.candidate
    if not seen[candidate.text] then
      seen[candidate.text] = true
      candidate._end = segment._end
      candidate.preedit = input
      local label = env.auxiliary_mode == "tone" and "调" or "形"
      if item.auxiliary ~= "" then
        snow.comment(candidate, ("〔%s %s〕"):format(label, item.auxiliary))
      end
      yield(candidate)
    end
  end
end

function this.fini(env)
  env.translator = nil
  env.pinyin = nil
  env.strokes = nil
  env.shape_elements = nil
  collectgarbage()
end

function this.tags_match(segment, env)
  return segment:has_tag("abc")
end

return this
