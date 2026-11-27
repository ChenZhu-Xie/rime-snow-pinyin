-- 冰雪鹤道 / 冰雪鹤拼的飞码式翻译器
--
-- 主码族：一简 A、单字 AU / AUBBBB、空桶二字 AA、二字 AUAU、三字 AAA / AAAU / 空桶 AAA+B、四字 AAAA、显式长词 AAAA+A…。
-- 两个活动方案共用 RC26-39a5bfdc045342cd 声韵映射，只在 B 辅码语义上不同：
--   shape: 键道式部首形辅，物理键 avuio -> aeuio；
--   tone:  第一个 B 为声调 12345 -> ieuao，后续 B 为五笔画；数字 1 独立进入部首码。
-- 活动方案二／三／四字最优辅序分别为形 12/12/24、调 12/21/13。
-- 冰雪鹮道复用路由，通过配置使用带调布局与形辅 21/12/23。

local snow = require "snow.snow"
local shape_completion = require "snow.shape_completion"
local bihua = require "snow.bihua"
local vacancy = require "snow.vacancy"
local auxiliary_semantics = require "snow.auxiliary_semantics"
local auxiliary_hint = require "snow.auxiliary_hint"
local candidate_priority = require "snow.candidate_priority"
local initial_pair_aux = require "snow.initial_pair_aux"

local jiandao_semantics = auxiliary_semantics["21x21"]
local shenyun_semantics = auxiliary_semantics["21x26"]

local translator = {}

---@class ShenyunEnv: BihuaEnv
---@field translator Translator
---@field vacancy_translator Translator
---@field vacancy_memory Memory
---@field vacancy_projection Projection
---@field memory Memory
---@field pinyin ReverseLookup|nil
---@field shape_elements ReverseLookup|nil
---@field shape_mapping table<string, string>
---@field initial_keys string
---@field final_keys string
---@field auxiliary_keys string
---@field auxiliary_mode string
---@field first_generation boolean
---@field auxiliary_cache table<string, string[]>
---@field vacancy_cache table<string, boolean>
---@field pair_standard_order string
---@field three_word_order string?
---@field four_word_order string?

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

---@param text string
---@return string[]
local function characters(text)
  ---@type string[]
  local result = {}
  for _, codepoint in utf8.codes(text) do
    table.insert(result, utf8.char(codepoint))
  end
  return result
end

---@param character string
---@param env ShenyunEnv
---@return string
local function encode_elements(character, env)
  local radicals = env.shape_elements and env.shape_elements:lookup(character) or ""
  local result = ""
  for _, codepoint in utf8.codes(radicals) do
    local radical = utf8.char(codepoint)
    result = result .. (env.shape_mapping[radical] or "")
  end
  return result
end

---@param character string
---@param env ShenyunEnv
---@return string
local function encode_radical(character, env)
  -- radical_jiandao.txt 使用 21×21 形义键；逐义迁移到 21×26，不能把调序当成形序。
  local source = jiandao_semantics.shape_keys_by_meaning
  local target = shenyun_semantics.shape_keys_by_meaning
  return (encode_elements(character, env):gsub(".", function(key)
    local index = source:find(key, 1, true)
    return index and target:sub(index, index) or ""
  end))
end

---@param value string
---@return string
local function first_or_empty(value)
  return value:sub(1, 1)
end

---@param length integer
---@param mode string
---@param first_generation boolean
---@return integer[]
---@param pair_standard_order? string
---@param three_word_order? string
---@param four_word_order? string
local function auxiliary_positions(length, mode, first_generation, pair_standard_order, three_word_order, four_word_order)
  if length == 2 then return initial_pair_aux.positions(pair_standard_order or "12") end
  local order = length == 3 and three_word_order or length == 4 and four_word_order
  if order then return { order:byte(1) - 48, order:byte(2) - 48 } end
  if length == 3 then
    return mode == "shape" and not first_generation and { 1, 2 } or { 2, 1 }
  end
  if length == 4 then
    if mode == "tone" then return { 1, 3 } end
    return first_generation and { 4, 2 } or { 2, 4 }
  end
  return { 1, 2 }
end

---@param codes string[]
---@param positions integer[]
---@return string
local function ordered_initials(codes, positions)
  local result = ""
  for _, position in ipairs(positions) do
    result = result .. first_or_empty(codes[position] or "")
  end
  return result
end

---@param text string
---@param env ShenyunEnv
---@return string[]
local function shape_codes(text, env)
  local chars = characters(text)
  ---@type string[]
  local codes = {}
  for _, character in ipairs(chars) do
    table.insert(codes, encode_radical(character, env))
  end
  if #codes == 1 then
    return { shape_completion.single(codes[1]) }
  elseif #codes >= 2 then
    return { ordered_initials(codes, auxiliary_positions(#codes, "shape", env.first_generation, env.pair_standard_order, env.three_word_order, env.four_word_order)) }
  end
  return { "" }
end

---@type table<string, string>
local tone_keys = shenyun_semantics.tone_keys_by_digit
---@type table<string, string>
local stroke_keys = shenyun_semantics.stroke_keys_by_digit

---@param values string[]
---@return string[]
local function unique(values)
  ---@type table<string, boolean>
  local seen = {}
  ---@type string[]
  local result = {}
  for _, value in ipairs(values) do
    if value ~= "" and not seen[value] then
      seen[value] = true
      table.insert(result, value)
    end
  end
  return result
end

---@param character string
---@param env ShenyunEnv
---@return string[]
local function tone_options(character, env)
  local result = {}
  for spelling in (env.pinyin and env.pinyin:lookup(character) or ""):gmatch("[^ ]+") do
    local tone = spelling:match("([1-5])$")
    if tone and tone_keys[tone] then
      table.insert(result, tone_keys[tone])
    end
  end
  return unique(result)
end

---@param character string
---@param env ShenyunEnv
---@return string[]
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

---@param text string
---@param env ShenyunEnv
---@param spellings? string[]
---@return string[]
local function tone_codes(text, env, spellings)
  local chars = characters(text)
  if #chars == 0 then return { "" } end
  ---@type string[][]
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
  else
    local positions = auxiliary_positions(#chars, "tone", env.first_generation, env.pair_standard_order, env.three_word_order, env.four_word_order)
    for _, first in ipairs(tones[positions[1]]) do
      for _, second in ipairs(tones[positions[2]]) do
        table.insert(result, first .. second)
      end
    end
  end
  return unique(result)
end

---@param candidate Candidate
---@param env ShenyunEnv
---@return string[]?
local function actual_spellings(candidate, env)
  local phrase = candidate:get_genuine():to_phrase()
  return phrase and env.memory:decode(phrase.entry.code) or nil
end

---@param candidate Candidate
---@param env ShenyunEnv
---@param initial_pair? boolean
---@return string[]
local function auxiliary_codes(candidate, env, initial_pair)
  local text = candidate.text
  local spellings = env.auxiliary_mode == "tone" and actual_spellings(candidate, env) or nil
  local cache_key = text .. "\t" .. (initial_pair and "AA\t" or "")
      .. (spellings and table.concat(spellings, " ") or "")
  local cached = env.auxiliary_cache[cache_key]
  if cached then return cached end
  ---@type string[]
  local codes
  if initial_pair then
    ---@type string[][]
    local options = {}
    for index, character in ipairs(characters(text)) do
      if env.auxiliary_mode == "tone" then
        local reading = spellings and spellings[index] and spellings[index]:match("([1-5])$")
        local tones = reading and { tone_keys[reading] } or tone_options(character, env)
        local strokes = stroke_options(character, env)
        local values = {}
        for _, tone in ipairs(tones) do
          if #strokes == 0 then table.insert(values, tone) end
          for _, stroke in ipairs(strokes) do table.insert(values, tone .. stroke:sub(1, 1)) end
        end
        options[index] = #values > 0 and values or { "" }
      else
        options[index] = { encode_radical(character, env) }
      end
    end
    codes = initial_pair_aux.codes(options, env.pair_standard_order)
  elseif env.auxiliary_mode == "tone" then
    codes = tone_codes(text, env, spellings)
  else
    codes = shape_codes(text, env)
  end
  env.auxiliary_cache[cache_key] = codes
  return codes
end

---@param route ShenyunRoute
---@param mode string
---@return string
local function format_preedit(route, mode, first_generation, pair_standard_order, three_word_order, four_word_order)
  if route.family == "AA" then
    return route.proxy .. (route.suffix ~= "" and
      (mode == "tone" and " 调笔[" or " 形[") .. route.suffix .. "]" or "")
  end
  ---@type string
  local proxy = route.proxy
  if route.family == "AAAA" or route.family == "LONG" then
    proxy = proxy:lower():gsub(" ", ""):gsub(".", "%0 "):sub(1, -2) --[[@as string]]
  end
  local positions = route.length == 1 and { 1 }
      or auxiliary_positions(route.length, mode, first_generation, pair_standard_order, three_word_order, four_word_order)
  return auxiliary_hint.format_preedit(proxy, route.suffix, mode, positions)
end

---@param candidate Candidate
---@param suffix string
---@param env ShenyunEnv
---@param initial_pair boolean
---@return boolean, string
local function auxiliary_match(candidate, suffix, env, initial_pair)
  local text = candidate.text
  local radical_input = env.engine.context:get_property("shape_input") or ""
  -- 自适应上屏的菜单只用于选词，不展示形辅提示。无辅码约束时无需
  -- 对预取的每个候选做部件反查；保留原有候选流，让后续排序完全一致。
  if suffix == "" and radical_input == ""
      and env.engine.context:get_property("snow_append_query") == "1" then
    return true, ""
  end
  if (suffix ~= "" or radical_input ~= "") and text:match("^[A-Za-z0-9]+$") then
    return false, ""
  end
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
  local codes = auxiliary_codes(candidate, env, initial_pair)
  if suffix == "" then return true, auxiliary_hint.next_codes(codes, suffix) end
  for _, code in ipairs(codes) do
    if code:sub(1, suffix:len()) == suffix then
      return true, auxiliary_hint.next_codes(codes, suffix)
    end
  end
  return false, ""
end

---@param routes ShenyunRoute[]
---@param family string
---@param proxy string
---@param suffix string
---@param length integer
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
    -- 先按原生代理码长度排除前缀；被排除的候选无需改写 C++ 字段或 quality。
    -- AA 仍继续查找，保留高频前缀前后都可能出现完整二字词的行为。
    if candidate._end - candidate._start < stream.route.proxy:len() then
      if stream.route.family == "AA" then
        goto continue
      else
        stream.candidate = nil
        return false
      end
    end
    -- 已消费完整 proxy 的候选经 prepare 后恰好消费 main_length。
    -- 先筛字数和辅码；只给真正进入合流的候选修正 _end / quality。
    local length = utf8.len(candidate.text)
    if stream.route.family == "AA" and initial_pair_aux.is_composable(candidate.text) then
      goto continue
    end
    local is_long = length and (stream.route.family == "LONG" and length >= stream.route.length
        or stream.route.family == "AAAA" and stream.route.suffix == ""
          and candidate.type == "completion" and length >= 5)
    if candidate.type ~= "sentence" and (length == stream.route.length or is_long) then
      -- 单键只提示声韵码，不需要为每个单字查询形辅、声调或笔画。
      if stream.route.family == "A" or is_long then
        stream.candidate = snow.prepare(candidate, stream.route.proxy)
        stream.auxiliary = ""
        return true
      end
      local matches, auxiliary = auxiliary_match(candidate, stream.route.suffix, env, stream.route.family == "AA")
      if matches then
        stream.candidate = snow.prepare(candidate, stream.route.proxy)
        stream.auxiliary = auxiliary
        return true
      end
    end
    ::continue::
  end
end

---@param input string
---@param segment Segment
---@param env ShenyunEnv
---@return ShenyunRoute[]
local function routes_for(input, segment, env)
  local routes = {}
  local n = input:len()
  local A, U, B = env.initial_keys, env.final_keys, env.auxiliary_keys
  -- 大写只在四声母以后表示显式续写。保留这个标记，普通小写第五键仍走四码顶。
  local continuation = input:sub(5)
  if n >= 5 and all_in(input:sub(1, 4), 1, A)
      and continuation:match("^[A-Z]+$") and all_in(continuation:lower(), 1, A) then
    add_route(routes, "LONG", input:upper(), "", n)
    return routes
  end
  if n > 6 then
    -- 调辅单字可继续追加笔画；词语和形辅仍保留原有六码合同。
    if env.auxiliary_mode == "tone" and contains(A, input:sub(1, 1))
        and contains(U, input:sub(2, 2)) and all_in(input, 3, B)
        and not (all_in(input:sub(1, 2), 1, A)
          and vacancy.is_empty(input:sub(1, 2), segment, env.vacancy_translator,
            env.vacancy_memory, env.vacancy_projection, env.vacancy_cache)) then
      add_route(routes, "AU", input:sub(1, 2), input:sub(3), 1)
    end
    return routes
  end
  local first_pair = n >= 2 and input:sub(1, 2) or ""
  local first_vacant = first_pair ~= "" and all_in(first_pair, 1, A)
      and vacancy.is_empty(first_pair, segment, env.vacancy_translator,
        env.vacancy_memory, env.vacancy_projection, env.vacancy_cache)
  local third_pair = n >= 4 and input:sub(3, 4) or ""
  local third_vacant = third_pair ~= "" and contains(A, third_pair:sub(1, 1))
      and vacancy.is_empty(third_pair, segment, env.vacancy_translator,
        env.vacancy_memory, env.vacancy_projection, env.vacancy_cache)

  if n == 1 and contains(A, input) then
    add_route(routes, "A", input, "", 1)
  end
  if n >= 2 and contains(A, input:sub(1, 1)) and contains(U, input:sub(2, 2))
      and not first_vacant and all_in(input, 3, B) then
    add_route(routes, "AU", input:sub(1, 2), input:sub(3), 1)
  end
  if first_vacant and n <= 6 and all_in(input, 3, B) then
    -- AA 只在 AU 空桶启用；标准二字词辅序反向，每字连续两辅，最多四辅。
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
    -- 第三音节 AU 空桶时，第四码直接作为三字词第二字辅码，回收为 AAA+B。
    add_route(routes, "AAA+B", input:sub(1, 1) .. " " .. input:sub(2, 2) .. " " .. input:sub(3, 3), input:sub(4), 3)
  end
  if n >= 4 and all_in(input:sub(1, 4), 1, A) and all_in(input, 5, B) then
    -- 等长大写简拼没有 AU 完整音节边，避免原生切分优先全拼而删除四声母路径。
    -- 裸四声母不注入填充分隔符，满足原生词补全的输入末尾长度条件。
    ---@type string
    local proxy = input:sub(1, 4):upper()
    -- 补辅时不启用长补全，保留旧查询的间隔与 quality 修正，避免改动跨词长排名。
    if n > 4 then proxy = proxy:gsub(".", "%0 "):sub(1, -2) --[[@as string]] end
    add_route(routes, "AAAA", proxy, input:sub(5), 4)
  end
  return routes
end

---@param env ShenyunEnv
function translator.init(env)
  local config = env.engine.schema.config
  env.translator = Component.Translator(env.engine, "shenyun", "script_translator")
  env.vacancy_translator = Component.Translator(env.engine, "vacancy", "script_translator")
  env.vacancy_memory = Memory(env.engine, env.engine.schema, "vacancy")
  env.vacancy_projection = Projection(config:get_list("vacancy/canonical_format") or {})
  env.memory = Memory(env.engine, env.engine.schema, "shenyun")
  env.pinyin = ReverseLookup("snow_pinyin")
  local shape_elements = config:get_string("translator/shape_elements") or "snow_landao_chaifen"
  env.shape_elements = ReverseLookup(shape_elements)
  local shape_mapping = config:get_string("translator/shape_mapping") or "radical_jiandao.txt"
  env.shape_mapping = snow.table_from_tsv(rime_api.get_user_data_dir() .. "/lua/snow/" .. shape_mapping)
  env.initial_keys = config:get_string("translator/shenyun_initial_keys") or "bpmfdtnlgkhjqwvxrzcsy"
  env.final_keys = config:get_string("translator/shenyun_final_keys") or "abcdefghijklmnopqrstuvwxyz"
  env.auxiliary_keys = config:get_string("translator/shenyun_auxiliary_keys") or "aeuio"
  env.auxiliary_mode = config:get_string("shenyun_options/auxiliary") or "shape"
  env.pair_standard_order = config:get_string("translator/word_auxiliary_order") or "12"
  env.three_word_order = config:get_string("translator/three_word_auxiliary_order")
  env.four_word_order = config:get_string("translator/four_word_auxiliary_order")
  env.first_generation = env.engine.schema.schema_id:match("_first$") ~= nil
  env.auxiliary_cache = {}
  env.vacancy_cache = {}
  if env.auxiliary_mode == "tone" then bihua.load_strokes(env) end
end

---@param input string
---@param segment Segment
---@param env ShenyunEnv
function translator.func(input, segment, env)
  ---@type ShenyunStream[]
  local streams = {}
  ---@type table<string, UserPhraseWeight>
  local learned_cache = {}
  for _, route in ipairs(routes_for(input, segment, env)) do
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
  ---@type table<string, boolean>
  local seen = {}
  while #streams > 0 do
    local best_index = 1
    for index = 2, #streams do
      local candidate = streams[index].candidate
      local best = streams[best_index].candidate
      if candidate and best
          and candidate_priority.better_across_routes(
            candidate, best, env.memory, learned_cache) then
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
      candidate.preedit = format_preedit(stream.route, env.auxiliary_mode, env.first_generation, env.pair_standard_order, env.three_word_order, env.four_word_order)
      local length = utf8.len(candidate.text)
      local order = ""
      if length and length >= 2 then
        local positions = auxiliary_positions(length, env.auxiliary_mode, env.first_generation, env.pair_standard_order, env.three_word_order, env.four_word_order)
        local raw_order = ("%d%d"):format(positions[1], positions[2])
        order = raw_order:gsub("1", "₁"):gsub("2", "₂"):gsub("3", "₃"):gsub("4", "₄")
      end
      local label = (env.auxiliary_mode == "tone" and "调" or "形") .. order
      if stream.route.family == "AA" then
        candidate.type = "initial_pair"
        local codes = auxiliary_codes(candidate, env, true)
        local _, _, comment = initial_pair_aux.match(codes, stream.route.suffix,
          env.auxiliary_mode, env.pair_standard_order)
        if comment ~= "" then snow.comment(candidate, comment) end
      elseif stream.route.family == "A" then
        local spellings = actual_spellings(candidate, env)
        if spellings and spellings[1] then
          local code = env.vacancy_projection:apply(spellings[1])
          snow.comment(candidate, ("〔声韵 %s〕"):format(code))
        end
      elseif stream.auxiliary ~= "" then
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

---@param env ShenyunEnv
function translator.fini(env)
  env.translator = nil
  env.vacancy_translator = nil
  env.vacancy_memory = nil
  env.vacancy_projection = nil
  env.memory = nil
  env.pinyin = nil
  env.shape_elements = nil
  env.auxiliary_cache = nil
  env.vacancy_cache = nil
  bihua.release_strokes(env)
  collectgarbage()
end

function translator.tags_match(segment, env)
  return segment:has_tag("abc")
end

return translator
