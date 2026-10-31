-- 冰雪神韵·形 / 冰雪神韵·调的飞码式翻译器
--
-- 主码族：一简 A、单字 AU、空桶二字 AA、二字 AUAU、三字 AAA / AAAU / 空桶 AAA+B、四字 AAAA。
-- 两个方案共用 SNOW-SHENYUN-21X26-PRODUCTION（Overall-17）声韵映射，只在 B 辅码语义上不同：
--   shape: 键道式部首形辅，物理键 avuio -> aeuio；
--   tone:  第一个 B 为声调 12345 -> ieuao，后续 B 为五笔画；数字 1 独立进入部首码。

local snow = require "snow.snow"
local bihua = require "snow.bihua"
local vacancy = require "snow.vacancy"

local this = {}

---@class ShenyunEnv: BihuaEnv
---@field translator Translator
---@field vacancy_memory Memory
---@field memory Memory
---@field pinyin ReverseLookup
---@field shape_elements ReverseLookup
---@field shape_mapping table<string, string>
---@field initial_keys string
---@field final_keys string
---@field auxiliary_keys string
---@field auxiliary_mode string
---@field auxiliary_cache table<string, string[]>
---@field vacancy_cache table<string, boolean>

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

---@type table<string, string>
local tone_keys = { ["1"] = "i", ["2"] = "e", ["3"] = "u", ["4"] = "a", ["5"] = "o" }
---@type table<string, string>
local stroke_keys = { ["1"] = "e", ["2"] = "i", ["3"] = "u", ["4"] = "o", ["5"] = "a" }

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
  for _, stroke in ipairs(bihua.codes(character, env)) do
    local code = ""
    for index = 1, stroke:len() do
      code = code .. (stroke_keys[stroke:sub(index, index)] or "")
    end
    table.insert(result, code)
  end
  return unique(result)
end

---@param spellings? string[]
local function tone_codes(text, env, spellings)
  local chars = characters(text)
  if #chars == 0 then return { "" } end
  local tones = {}
  for index, character in ipairs(chars) do
    local actual_tone = spellings and spellings[index] and spellings[index]:match("([1-5])$") or nil
    tones[index] = actual_tone and { tone_keys[actual_tone] } or tone_options(character, env)
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

---@param candidate Candidate
---@return string[]?
local function actual_spellings(candidate, env)
  local phrase = candidate:get_genuine():to_phrase()
  return phrase and env.memory:decode(phrase.entry.code) or nil
end

---@param candidate Candidate
local function auxiliary_codes(candidate, env)
  local text = candidate.text
  local spellings = env.auxiliary_mode == "tone" and actual_spellings(candidate, env) or nil
  local cache_key = text .. "\t" .. (spellings and table.concat(spellings, " ") or "")
  local cached = env.auxiliary_cache[cache_key]
  if cached then return cached end
  local codes
  if env.auxiliary_mode == "tone" then
    codes = tone_codes(text, env, spellings)
  else
    codes = shape_codes(text, env)
  end
  env.auxiliary_cache[cache_key] = codes
  return codes
end

---@param candidate Candidate
local function auxiliary_match(candidate, suffix, env)
  local text = candidate.text
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
  local codes = auxiliary_codes(candidate, env)
  if suffix == "" then return true, table.concat(codes, "/") end
  for _, code in ipairs(codes) do
    if code:sub(1, suffix:len()) == suffix then
      return true, table.concat(codes, "/")
    end
  end
  return false, table.concat(codes, "/")
end

local function add_route(routes, family, proxy, suffix, length)
  local main_length = proxy:gsub("[ ?~]", ""):len()
  table.insert(routes, {
    family = family,
    proxy = proxy,
    suffix = suffix,
    length = length,
    main_length = main_length,
  })
end

---@class ShenyunRoute
---@field family string
---@field proxy string
---@field suffix string
---@field length integer
---@field main_length integer

---@class ShenyunStream
---@field route ShenyunRoute
---@field translation Translation
---@field iterator fun(translation: Translation): Candidate?
---@field candidate Candidate?
---@field auxiliary string

---@param stream ShenyunStream
---@param env ShenyunEnv
---@return boolean
local function advance(stream, env)
  while true do
    local candidate = stream.iterator(stream.translation)
    if not candidate then
      stream.candidate = nil
      return false
    end
    -- 代理码中的分隔符会同时虚增 _end 和 quality，合流前必须统一还原。
    candidate = snow.prepare(candidate, stream.route.proxy)
    local consumed_length = candidate._end - candidate._start
    -- 普通主码进入前缀区后不会再出现完整候选，直接结束可避免为空音码扫描整批词。
    -- AA 使用两个简拼音节，某些桶会先返回只消费首音节的高频候选，必须继续查找。
    if consumed_length < stream.route.main_length then
      if stream.route.family == "AA" then
        goto continue
      else
        stream.candidate = nil
        return false
      end
    end
    if consumed_length == stream.route.main_length
        and candidate.type ~= "sentence" and utf8.len(candidate.text) == stream.route.length then
      local matches, auxiliary = auxiliary_match(candidate, stream.route.suffix, env)
      if matches then
        stream.candidate = candidate
        stream.auxiliary = auxiliary
        return true
      end
    end
    ::continue::
  end
end

---@param input string
---@param env ShenyunEnv
---@return ShenyunRoute[]
local function routes_for(input, env)
  local routes = {}
  local n = input:len()
  local A, U, B = env.initial_keys, env.final_keys, env.auxiliary_keys
  local first_pair = n >= 2 and input:sub(1, 2) or ""
  local first_vacant = first_pair ~= "" and all_in(first_pair, 1, A)
      and vacancy.is_empty(first_pair, env.vacancy_memory, env.vacancy_cache)
  local third_pair = n >= 4 and input:sub(3, 4) or ""
  local third_vacant = third_pair ~= "" and contains(A, third_pair:sub(1, 1))
      and vacancy.is_empty(third_pair, env.vacancy_memory, env.vacancy_cache)

  if n == 1 and contains(A, input) then
    add_route(routes, "A", input, "", 1)
  end
  if n >= 2 and contains(A, input:sub(1, 1)) and contains(U, input:sub(2, 2))
      and not first_vacant and all_in(input, 3, B) then
    add_route(routes, "AU", input:sub(1, 2), input:sub(3), 1)
  end
  if first_vacant and all_in(input, 3, B) then
    -- AA 只在同码 AU 没有完整单字候选时启用；B 沿用二字词的 B2、B1 顺序。
    add_route(routes, "AA", input:sub(1, 1) .. " " .. input:sub(2, 2), input:sub(3), 2)
  end
  if n >= 4 and contains(A, input:sub(1, 1)) and contains(U, input:sub(2, 2))
      and contains(A, input:sub(3, 3)) and contains(U, input:sub(4, 4))
      and not first_vacant and not third_vacant and all_in(input, 5, B) then
    add_route(routes, "AUAU", input:sub(1, 2) .. " " .. input:sub(3, 4), input:sub(5), 2)
  end
  if n == 3 and all_in(input, 1, A) then
    add_route(routes, "AAA", input:sub(1, 1) .. " " .. input:sub(2, 2) .. " " .. input:sub(3, 3), "", 3)
  end
  if n >= 4 and all_in(input:sub(1, 3), 1, A) and contains(U, input:sub(4, 4))
      and not third_vacant and all_in(input, 5, B) then
    add_route(routes, "AAAU", input:sub(1, 1) .. " " .. input:sub(2, 2) .. " " .. input:sub(3, 4), input:sub(5), 3)
  end
  if n >= 4 and all_in(input:sub(1, 3), 1, A) and contains(B, input:sub(4, 4))
      and third_vacant and all_in(input, 4, B) then
    -- 第三音节 AU 空桶时，第四码直接作为三字词第一辅码，回收为 AAA+B。
    add_route(routes, "AAA+B", input:sub(1, 1) .. " " .. input:sub(2, 2) .. " " .. input:sub(3, 3), input:sub(4), 3)
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
  env.vacancy_memory = Memory(env.engine, env.engine.schema, "vacancy")
  env.memory = Memory(env.engine, env.engine.schema, "shenyun")
  env.pinyin = ReverseLookup("snow_pinyin")
  local shape_elements = config:get_string("translator/shape_elements") or "snow_jiandao_chaifen"
  env.shape_elements = ReverseLookup(shape_elements)
  local shape_mapping = config:get_string("translator/shape_mapping") or "radical_jiandao.txt"
  env.shape_mapping = snow.table_from_tsv(rime_api.get_user_data_dir() .. "/lua/snow/" .. shape_mapping)
  env.initial_keys = config:get_string("translator/shenyun_initial_keys") or "bpmfdtnlgkhjqwvxrzcsy"
  env.final_keys = config:get_string("translator/shenyun_final_keys") or "abcdefghijklmnopqrstuvwxyz"
  env.auxiliary_keys = config:get_string("translator/shenyun_auxiliary_keys") or "aeuio"
  env.auxiliary_mode = config:get_string("shenyun_options/auxiliary") or "shape"
  env.auxiliary_cache = {}
  env.vacancy_cache = {}
  if env.auxiliary_mode == "tone" then bihua.load_strokes(env) end
end

function this.func(input, segment, env)
  ---@type ShenyunStream[]
  local streams = {}
  for _, route in ipairs(routes_for(input, env)) do
    local translation = env.translator:query(route.proxy, segment)
    if translation then
      local stream = {
        route = route,
        translation = translation,
        iterator = translation:iter(),
        candidate = nil,
        auxiliary = "",
      }
      if advance(stream, env) then
        table.insert(streams, stream)
      end
    end
  end
  local seen = {}
  while #streams > 0 do
    local best_index = 1
    for index = 2, #streams do
      local candidate = streams[index].candidate
      local best = streams[best_index].candidate
      if candidate and best and (candidate.quality or 0) > (best.quality or 0) then
        best_index = index
      end
    end
    local stream = streams[best_index]
    local candidate = stream.candidate
    if not candidate then
      table.remove(streams, best_index)
      goto continue
    end
    if not seen[candidate.text] then
      seen[candidate.text] = true
      candidate._end = segment._end
      candidate.preedit = input
      local length = utf8.len(candidate.text)
      local order = length == 2 and "₂₁" or length >= 3 and "₁₂" or ""
      local label = (env.auxiliary_mode == "tone" and "调" or "形") .. order
      if stream.auxiliary ~= "" then
        snow.comment(candidate, ("〔%s %s〕"):format(label, stream.auxiliary))
      end
      yield(candidate)
    end
    if not advance(stream, env) then
      table.remove(streams, best_index)
    end
    ::continue::
  end
end

function this.fini(env)
  env.translator = nil
  env.vacancy_memory = nil
  env.memory = nil
  env.pinyin = nil
  env.shape_elements = nil
  env.auxiliary_cache = nil
  env.vacancy_cache = nil
  bihua.release_strokes(env)
  collectgarbage()
end

function this.tags_match(segment, env)
  return segment:has_tag("abc")
end

return this
