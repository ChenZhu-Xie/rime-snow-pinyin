-- 原生用户词优先过滤器
-- script_translator 会先按文本去重；缩写查询中若系统词先出现，Lua 只能看到普通 phrase。
-- 这里用候选的规范音节码反查用户词典，恢复被去重掩盖的已学习身份。

local snow = require "snow.snow"
local candidate_priority = require "snow.candidate_priority"

local filter = {}

---@class LearnedPriorityEnv: Env
---@field memory Memory
---@field cache table<string, boolean>
---@field connection Connection
---@field maximum_candidates integer
---@field minimum_input_length integer

---@param candidates Candidate[]
---@param memory Memory
---@param cache table<string, boolean>
---@return Candidate[]
function filter.prioritize(candidates, memory, cache)
  local learned = {}
  local ordinary = {}
  for _, candidate in ipairs(candidates) do
    if candidate_priority.is_learned_phrase(candidate, memory, cache) then
      table.insert(learned, candidate)
    else
      table.insert(ordinary, candidate)
    end
  end
  for _, candidate in ipairs(ordinary) do
    table.insert(learned, candidate)
  end
  return learned
end

---@param env LearnedPriorityEnv
function filter.init(env)
  local config = env.engine.schema.config
  local name_space = config:get_string("learned_priority/memory_namespace") or "translator"
  env.memory = Memory(env.engine, env.engine.schema, name_space)
  env.cache = {}
  env.maximum_candidates = config:get_int("learned_priority/maximum_candidates") or 120
  env.minimum_input_length = config:get_int("learned_priority/minimum_input_length") or 4
  env.connection = env.engine.context.commit_notifier:connect(function()
    -- 本次提交可能刚写入一个新用户词；下一次查询必须重新判断。
    env.cache = {}
  end)
end

---@param segment Segment
---@param env LearnedPriorityEnv
function filter.tags_match(segment, env)
  local input = snow.current(env.engine.context)
  return segment:has_tag("abc") and input ~= nil and input:len() >= env.minimum_input_length
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
