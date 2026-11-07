-- 候选词长平衡过滤器
-- 四码及以后将二字、三字、四字及以上候选分层交错，保留各层内部原有顺序。

local snow = require "snow.snow"

---@class LengthBalanceEnv: Env
---@field page_size integer
---@field maximum_candidates integer
---@field minimum_input_length integer

local filter = {}

---@param candidate Candidate
---@return integer|nil
local function group_of(candidate)
  local length = utf8.len(candidate.text)
  if length == 2 then return 1 end
  if length == 3 then return 2 end
  if length and length >= 4 then return 3 end
  return nil
end

---@param queues Candidate[][]
---@return integer
local function active_queue_count(queues)
  local count = 0
  for _, queue in ipairs(queues) do
    if #queue > 0 then count = count + 1 end
  end
  return count
end

---@param queues Candidate[][]
---@param page_size integer
---@return Candidate[]
local function take_page(queues, page_size)
  local page = {}
  local cursor = 1
  while #page < page_size and active_queue_count(queues) > 0 do
    local active = active_queue_count(queues)
    local remaining = page_size - #page
    local quota = math.max(1, math.floor(remaining / active))
    local visited = 0
    while visited < #queues and #page < page_size do
      local queue = queues[cursor]
      cursor = cursor % #queues + 1
      visited = visited + 1
      for _ = 1, math.min(quota, #queue) do
        table.insert(page, table.remove(queue, 1))
        if #page == page_size then break end
      end
    end
  end
  return page
end

---@param candidates Candidate[]
---@param page_size integer
---@return Candidate[]
function filter.rebalance(candidates, page_size)
  ---@type Candidate[][]
  local queues = { {}, {}, {} }
  local passthrough = {}
  for _, candidate in ipairs(candidates) do
    local group = group_of(candidate)
    if group then
      table.insert(queues[group], candidate)
    else
      table.insert(passthrough, candidate)
    end
  end
  local result = {}
  while active_queue_count(queues) > 0 do
    for _, candidate in ipairs(take_page(queues, page_size)) do
      table.insert(result, candidate)
    end
  end
  for _, candidate in ipairs(passthrough) do
    table.insert(result, candidate)
  end
  return result
end

---@param env LengthBalanceEnv
function filter.init(env)
  local config = env.engine.schema.config
  env.page_size = config:get_int("menu/page_size") or 6
  env.maximum_candidates = config:get_int("length_balance/maximum_candidates") or 120
  env.minimum_input_length = config:get_int("length_balance/minimum_input_length") or 4
end

---@param segment Segment
---@param env LengthBalanceEnv
function filter.tags_match(segment, env)
  local input = snow.current(env.engine.context)
  return segment:has_tag("abc") and input ~= nil and input:len() >= env.minimum_input_length
end

---@param translation Translation
---@param env LengthBalanceEnv
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
    for _, candidate in ipairs(filter.rebalance(buffered, env.page_size)) do
      yield(candidate)
    end
    if #buffered < env.maximum_candidates then break end
  end
end

return filter
