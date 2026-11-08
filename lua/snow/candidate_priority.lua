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
---@param memory Memory
---@param cache table<string, boolean>
---@return boolean
function priority.is_learned_phrase(candidate, memory, cache)
  if priority.is_user_phrase(candidate) then
    return true
  end
  local phrase = candidate:get_genuine():to_phrase()
  if not phrase then
    return false
  end
  local spellings = memory:decode(phrase.entry.code)
  if #spellings == 0 then
    return false
  end
  local code = table.concat(spellings, " ")
  local cache_key = code .. "\t" .. candidate.text
  local cached = cache[cache_key]
  if cached ~= nil then
    return cached
  end
  local learned = false
  local found = memory:user_lookup(code, false)
  local entries = {}
  if found then
    for entry in memory:iter_user() do
      table.insert(entries, entry.text)
      if entry.text == candidate.text then
        learned = true
        break
      end
    end
  end
  if code == "fang1 an4 xuan3 dan1" then
    log.error(("learned-priority lookup found=%s count=%d learned=%s"):format(
      tostring(found), #entries, tostring(learned)))
  end
  cache[cache_key] = learned
  return learned
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
