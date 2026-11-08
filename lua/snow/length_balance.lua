-- 候选词长平衡过滤器
-- 四码及以后以原始质量顺序为主；仅在一页缺少某类词长时，从后续候选柔性补位。

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

---@param candidates Candidate[]
---@return integer[]
local function group_counts(candidates)
  local counts = { 0, 0, 0 }
  for _, candidate in ipairs(candidates) do
    local group = group_of(candidate)
    if group then counts[group] = counts[group] + 1 end
  end
  return counts
end

---@param available integer[]
---@param slots integer
---@return integer[]
local function balanced_targets(available, slots)
  local targets = { 0, 0, 0 }
  while slots > 0 do
    local selected = nil
    for group = 1, 3 do
      if targets[group] < available[group]
          and (not selected or targets[group] < targets[selected]) then
        selected = group
      end
    end
    if not selected then break end
    targets[selected] = targets[selected] + 1
    slots = slots - 1
  end
  return targets
end

---@param candidates Candidate[]
---@param page_size integer
---@return Candidate[], Candidate[]
local function take_page(candidates, page_size)
  local page_length = math.min(page_size, #candidates)
  local available = group_counts(candidates)
  local grouped_slots = math.min(page_length, available[1] + available[2] + available[3])
  local targets = balanced_targets(available, grouped_slots)
  local selected = {}
  for index = 1, page_length do selected[index] = true end
  local page = {}
  for index = 1, page_length do table.insert(page, candidates[index]) end
  local counts = group_counts(page)

  for needed_group = 1, 3 do
    while counts[needed_group] < targets[needed_group] do
      local replacement = nil
      for index = page_length + 1, #candidates do
        if not selected[index] and group_of(candidates[index]) == needed_group then
          replacement = index
          break
        end
      end
      if not replacement then break end
      local displaced = nil
      for index = page_length, 1, -1 do
        local group = group_of(candidates[index])
        if selected[index] and group and counts[group] > targets[group] then
          displaced = index
          break
        end
      end
      if not displaced then break end
      local displaced_group = group_of(candidates[displaced])
      if not displaced_group then break end
      selected[displaced] = false
      selected[replacement] = true
      counts[displaced_group] = counts[displaced_group] - 1
      counts[needed_group] = counts[needed_group] + 1
    end
  end

  page = {}
  local remaining = {}
  for index, candidate in ipairs(candidates) do
    if selected[index] then
      table.insert(page, candidate)
    else
      table.insert(remaining, candidate)
    end
  end
  return page, remaining
end

---@param candidates Candidate[]
---@param page_size integer
---@return Candidate[]
function filter.rebalance(candidates, page_size)
  ---@type Candidate[]
  local remaining = candidates
  local result = {}
  while #remaining > 0 do
    local page
    page, remaining = take_page(remaining, page_size)
    for _, candidate in ipairs(page) do
      table.insert(result, candidate)
    end
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
