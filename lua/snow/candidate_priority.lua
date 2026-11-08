-- 跨翻译路径的候选优先级
-- 保留原生 script_translator 对完整用户词的优先语义，避免代理码分流后退化成静态词频竞争。

local priority = {}

local user_phrase_bonus = 1000000

---@param candidate Candidate
---@return boolean
function priority.is_user_phrase(candidate)
  local genuine = candidate:get_genuine()
  return candidate.type == "user_phrase" or genuine.type == "user_phrase"
end

---@param candidate Candidate
---@param expected_length integer
---@return Candidate
function priority.promote_exact_user_phrase(candidate, expected_length)
  local consumed_length = candidate._end - candidate._start
  if consumed_length == expected_length and priority.is_user_phrase(candidate) then
    candidate.quality = (candidate.quality or 0) + user_phrase_bonus
  end
  return candidate
end

---@param candidate Candidate
---@param current Candidate
---@return boolean
function priority.better_across_routes(candidate, current)
  local candidate_is_user_phrase = priority.is_user_phrase(candidate)
  local current_is_user_phrase = priority.is_user_phrase(current)
  if candidate_is_user_phrase ~= current_is_user_phrase then
    return candidate_is_user_phrase
  end
  return (candidate.quality or 0) > (current.quality or 0)
end

return priority
