-- 原生用户词优先过滤器
-- script_translator 会先按文本去重；缩写查询中若系统词先出现，Lua 只能看到普通 phrase。
-- 这里用候选的规范音节码反查用户词典，恢复被去重掩盖的已学习身份。

local snow = require "snow.snow"
local candidate_priority = require "snow.candidate_priority"

local filter = {}

---@class LearnedPriorityEnv: Env
---@field memory Memory
---@field cache table<string, UserPhraseWeight>
---@field connection Connection
---@field maximum_candidates integer
---@field minimum_input_length integer

---@param candidates Candidate[]
---@param memory Memory
---@param cache table<string, UserPhraseWeight>
---@return Candidate[]
function filter.prioritize(candidates, memory, cache)
  ---@type { candidate: Candidate, weight: number|nil }[]
  local learned = {}
  local ordinary = {}
  for _, candidate in ipairs(candidates) do
    local weight = candidate_priority.user_phrase_weight(candidate, memory, cache)
    if candidate_priority.is_user_phrase(candidate) or weight ~= nil then
      local position = #learned + 1
      if weight then
        for index, existing in ipairs(learned) do
          if existing.weight and weight > existing.weight then
            position = index
            break
          end
        end
      end
      table.insert(learned, position, { candidate = candidate, weight = weight })
    else
      table.insert(ordinary, candidate)
    end
  end
  ---@type Candidate[]
  local result = {}
  for _, entry in ipairs(learned) do
    table.insert(result, entry.candidate)
  end
  for _, candidate in ipairs(ordinary) do
    table.insert(result, candidate)
  end
  return result
end

---@param env LearnedPriorityEnv
function filter.init(env)
  local config = env.engine.schema.config
  local name_space = config:get_string("learned_priority/memory_namespace") or "translator"
  env.memory = Memory(env.engine, env.engine.schema, name_space)
  env.cache = {}
  env.maximum_candidates = config:get_int("learned_priority/maximum_candidates") or 120
  env.minimum_input_length = config:get_int("learned_priority/minimum_input_length") or 4
  env.connection = env.engine.context.commit_notifier:connect(function(ctx)
    local input = snow.current(ctx)
    local segment = ctx.composition:toSegmentation():back()
    local candidate = ctx:get_selected_candidate()
    if not ctx:get_option("buffered")
        and input and input:len() >= env.minimum_input_length
        and rime_api.regex_match(input, "^[a-z]+$")
        and segment and segment:has_tag("abc") and candidate
        and not candidate_priority.is_user_phrase(candidate) then
      -- Component.Translator 被 Lua 包装后，普通 phrase 不一定能触发子翻译器的
      -- Memory::OnCommit；显式补写 genuine Phrase，语义与原生 script_translator 一致。
      env.memory:start_session()
      env.memory:update_candidate(candidate, 1)
      env.memory:finish_session()
    end
    -- 本次提交可能刚写入一个新用户词；下一次查询必须重新判断。
    env.cache = {}
  end)
end

---@param segment Segment
---@param env LearnedPriorityEnv
function filter.tags_match(segment, env)
  local context = env.engine.context
  local input = snow.current(context)
  return not context:get_option("buffered")
      and segment:has_tag("abc") and input ~= nil and input:len() >= env.minimum_input_length
      and rime_api.regex_match(input, "^[a-z]+$")
end

---@param translation Translation
---@param env LearnedPriorityEnv
function filter.func(translation, env)
  local iterator = translation:iter()
  while true do
    local buffered = {}
    while #buffered < env.maximum_candidates do
      local candidate = iterator(translation)
      if not candidate then break end
      table.insert(buffered, candidate)
    end
    if #buffered == 0 then break end
    for _, candidate in ipairs(filter.prioritize(buffered, env.memory, env.cache)) do
      yield(candidate)
    end
    if #buffered < env.maximum_candidates then break end
  end
end

---@param env LearnedPriorityEnv
function filter.fini(env)
  env.connection:disconnect()
  env.memory = nil
  env.cache = nil
  collectgarbage()
end

return filter
