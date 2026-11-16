-- 模拟码表翻译器
-- 适用于：冰雪兰拼、冰雪兰道、冰雪三拼、冰雪键道

local snow = require "snow.snow"
local vacancy = require "snow.vacancy"
local candidate_priority = require "snow.candidate_priority"
local initial_pair_aux = require "snow.initial_pair_aux"

---@class TableLikeEnv: Env
---@field translator Translator
---@field pattern string
---@field oc21 boolean
---@field pattern2 string
---@field reserved_pattern string
---@field preserve_t12_proxy_quality boolean
---@field vacancy_translator Translator
---@field vacancy_memory Memory
---@field vacancy_projection Projection
---@field vacancy_cache table<string, boolean>
---@field pair_standard_order string
---@field pair_translator Translator

---@param candidate Candidate
---@param proxy string
---@param preserve_proxy_quality boolean
---@return Candidate
local function prepare(candidate, proxy, preserve_proxy_quality)
  local proxy_bonus = 0
  if preserve_proxy_quality then
    local proxy_segment = proxy:sub(1, candidate._end - candidate._start)
    local real_segment = proxy_segment:gsub("[ ?~]", "")
    local real_input_length = proxy:gsub("[ ?~]", ""):len()
    local filler_length = proxy_segment:len() - real_segment:len()
    if filler_length > 0 and real_input_length > 0 then
      proxy_bonus = filler_length / real_input_length
    end
  end
  candidate = snow.prepare(candidate, proxy)
  candidate.quality = candidate.quality + proxy_bonus
  local real_input_length = proxy:gsub("[ ?~]", ""):len()
  candidate_priority.promote_exact_user_phrase(candidate, real_input_length)
  return candidate
end

---@param proxy string
---@param segment Segment
---@param env TableLikeEnv
---@param preserve_proxy_quality boolean
---@param accept? fun(candidate: Candidate): boolean
---@param complete_only? boolean
---@param translator? Translator
local function translate(proxy, segment, env, preserve_proxy_quality, accept, complete_only, translator)
  -- 代理码不是合法拼写时 query 返回 nil，这一路当作没有候选
  local translation = (translator or env.translator):query(proxy, segment)
  if not translation then
    return
  end
  for candidate in translation:iter() do
    -- 原生 script_translator 按消耗长度降序输出；简拼只查完整编码，
    -- 遇到短片段即可结束，避免把大量前缀候选取到 Lua 再逐个丢弃。
    if complete_only and candidate._end - candidate._start < proxy:len() then
      return
    end
    candidate = prepare(candidate, proxy, preserve_proxy_quality)
    if not accept or accept(candidate) then
      yield(candidate)
    end
  end
end

local t12 = {}

local main = {}

---@param env TableLikeEnv
function main.init(env)
  env.translator = Component.Translator(env.engine, "translator", "script_translator")
end

---@param input string
---@param segment Segment
---@param env TableLikeEnv
function main.func(input, segment, env)
  translate(input, segment, env, false)
end

---@param env TableLikeEnv
function main.fini(env)
  env.translator = nil
  collectgarbage()
end

---@param env TableLikeEnv
function t12.init(env)
  -- 翻译器持有 engine，不能跨会话共享，否则原会话销毁后会访问失效的引擎
  env.translator = Component.Translator(env.engine, "translator", "script_translator")
  env.pair_translator = Component.Translator(env.engine, "jianpin", "script_translator")
  env.pair_standard_order = env.engine.schema.config:get_string("translator/word_auxiliary_order") or "12"
  env.pattern = env.engine.schema.config:get_string("translator/t1_pattern") or "^.+$"
  env.pattern2 = env.engine.schema.config:get_string("translator/t2_pattern") or "^.+$"
  env.preserve_t12_proxy_quality =
      env.engine.schema.config:get_bool("translator/t12_preserve_proxy_quality") or false
  env.vacancy_translator = Component.Translator(env.engine, "vacancy", "script_translator")
  env.vacancy_memory = Memory(env.engine, env.engine.schema, "vacancy")
  env.vacancy_projection = Projection(
    env.engine.schema.config:get_list("vacancy/canonical_format") or {})
  env.vacancy_cache = {}
end

---@param input string
---@param segment Segment
---@param env TableLikeEnv
function t12.func(input, segment, env)
  -- 六码二字词选完首字后，原始输入剩下第二字声韵与两个调码。
  -- 按本方案标准辅序找到第二字调码；原始输入不变，退格仍可撤销首字选择。
  local previous = env.engine.context.composition:toSegmentation():get_at(-2)
  local selected = previous and previous:get_selected_candidate()
  if previous and previous._end == segment.start and selected
      and selected:get_genuine().type == "sanpin_partial" and input:len() == 4 then
    local positions = initial_pair_aux.positions(env.pair_standard_order)
    local tone_index = positions[1] == 2 and 3 or 4
    local proxy = input:sub(1, 2) .. input:sub(tone_index, tone_index)
    translate(proxy, segment, env, env.preserve_t12_proxy_quality, function(candidate)
      if candidate._end ~= segment._end - 1 then
        return false
      end
      candidate._end = segment._end
      return true
    end)
    return
  end
  -- 一字词与整句模式
  if rime_api.regex_match(input, env.pattern) or not env.engine.context:get_option("popping") then
    local initial_pair_vacant = input:len() == 2
        and vacancy.is_empty(input, segment, env.vacancy_translator,
          env.vacancy_memory, env.vacancy_projection, env.vacancy_cache)
    -- 空桶只查一条完整双音节路径，避免原码和代理码重复遍历全部二字词及单字前缀。
    if not initial_pair_vacant then
      translate(input, segment, env, env.preserve_t12_proxy_quality)
    end
    if initial_pair_vacant then
      local groups = { input:sub(1, 1), input:sub(2) }
      local suffix = env.engine.context:get_property("shape_input") or ""
      local positions = initial_pair_aux.positions(env.pair_standard_order)
      for index = 1, 2 do
        local tone = suffix:sub((index - 1) * 2 + 1, (index - 1) * 2 + 1)
        if tone ~= "" then
          local position = positions[3 - index]
          groups[position] = groups[position] .. "?" .. tone
        end
      end
      local proxy = table.concat(groups, " ")
      translate(proxy, segment, env, env.preserve_t12_proxy_quality, function(candidate)
        if utf8.len(candidate.text) ~= 2 then return false end
        candidate.type = "initial_pair"
        candidate._end = segment._end
        candidate.preedit = input:sub(1, 1) .. " " .. input:sub(2)
        return true
      end, true, env.pair_translator)
    end
  end
  -- 二字词
  if rime_api.regex_match(input, env.pattern2) then
    local proxy = ("%s %s"):format(input:sub(1, 2), input:sub(3))
    if input:len() >= 5 then
      -- 后置调码按本方案标准二字词辅序分配；声声词在过滤器里反转同一配置。
      local positions = initial_pair_aux.positions(env.pair_standard_order)
      local tones = { "", "" }
      tones[positions[1]] = input:sub(5, 5)
      tones[positions[2]] = input:sub(6, 6)
      proxy = ("%s%s %s%s"):format(
        input:sub(1, 2), tones[1], input:sub(3, 4), tones[2])
    end
    translate(proxy, segment, env, env.preserve_t12_proxy_quality, function(candidate)
      local length = utf8.len(candidate.text)
      if length == 1 and input:len() == 6 and candidate._end == segment.start + 3 then
        -- 首字只消耗连续的声韵两码，其声调仍留在原始输入的末尾。
        candidate._end = segment.start + 2
        candidate.type = "sanpin_partial"
        candidate.preedit = input:sub(1, 2) .. " "
      end
      return length <= 2
    end)
  end
end

---@param env TableLikeEnv
function t12.fini(env)
  env.translator = nil
  env.pair_translator = nil
  env.vacancy_translator = nil
  env.vacancy_memory = nil
  env.vacancy_projection = nil
  collectgarbage()
end

local jianpin = {}

---@param length integer
---@param oc21 boolean
---@return integer[]
local function sanpin_auxiliary_positions(length, oc21)
  if length == 2 then return { 1, 2 } end
  if length == 3 then return { 2, 1, 3 } end
  if length == 4 then return oc21 and { 2, 1 } or { 2, 3 } end
  local positions = { length, 1, 2 }
  for index = 3, length - 1 do table.insert(positions, index) end
  return positions
end

---@param env TableLikeEnv
function jianpin.init(env)
  env.oc21 = env.engine.schema.schema_id == "snow_sanpin"
  env.translator = Component.Translator(env.engine, "jianpin", "script_translator")
  env.pattern = env.engine.schema.config:get_string("translator/jianpin_pattern") or "^.+$"
end

---@param input string
---@param segment Segment
---@param env TableLikeEnv
function jianpin.func(input, segment, env)
  if not rime_api.regex_match(input, env.pattern) then
    return
  end
  local tones = input:match("[ivuao]+$") or ""
  local sound_input = tones == "" and input or input:sub(1, -tones:len() - 1)
  ---@type string[]
  local groups = {}
  for group in sound_input:gmatch("[bpmfdtnlgkhjqxzcsrywe][A-Z]?") do
    table.insert(groups, group)
  end
  local initial_count = #groups
  -- 冰雪兰拼采用 12/213/21，冰雪三拼采用 12/213/23；四字词止于两辅。
  local positions = sanpin_auxiliary_positions(initial_count, env.oc21)
  for tone_index, position in ipairs(positions) do
    local tone = tones:sub(tone_index, tone_index)
    if tone ~= "" and groups[position] then
      groups[position] = groups[position] .. "?" .. tone
    end
  end
  local proxy = table.concat(groups)
  translate(proxy, segment, env, false, function(candidate)
    return utf8.len(candidate.text) >= initial_count and candidate.type ~= "sentence"
  end, true)
end

---@param env TableLikeEnv
function jianpin.fini(env)
  env.translator = nil
  collectgarbage()
end

local initial_pair = {}

---@param env TableLikeEnv
function initial_pair.init(env)
  env.translator = Component.Translator(env.engine, "initial_pair", "script_translator")
  env.vacancy_translator = Component.Translator(env.engine, "vacancy", "script_translator")
  env.vacancy_memory = Memory(env.engine, env.engine.schema, "vacancy")
  env.vacancy_projection = Projection(
    env.engine.schema.config:get_list("vacancy/canonical_format") or {})
  env.vacancy_cache = {}
  env.reserved_pattern =
      env.engine.schema.config:get_string("translator/reserved_initial_pair_pattern") or "^$"
end

---@param input string
---@param segment Segment
---@param env TableLikeEnv
function initial_pair.func(input, segment, env)
  if input:len() ~= 2
      or not vacancy.is_empty(input, segment, env.vacancy_translator,
        env.vacancy_memory, env.vacancy_projection, env.vacancy_cache)
      or rime_api.regex_match(input, env.reserved_pattern) then
    return
  end
  translate(input, segment, env, false, function(candidate)
    if utf8.len(candidate.text) ~= 2 then
      return false
    end
    candidate.type = "initial_pair"
    return true
  end, true)
end

---@param env TableLikeEnv
function initial_pair.fini(env)
  env.translator = nil
  env.vacancy_translator = nil
  env.vacancy_memory = nil
  env.vacancy_projection = nil
  collectgarbage()
end

return {
  main = main,
  t12 = t12,
  jianpin = jianpin,
  initial_pair = initial_pair,
}
