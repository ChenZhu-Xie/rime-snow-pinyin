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

---@alias UserPhraseWeight number|false

---@param candidate Candidate
---@param memory Memory
---@param cache table<string, UserPhraseWeight>
---@return number|nil
function priority.user_phrase_weight(candidate, memory, cache)
  local phrase = candidate:get_genuine():to_phrase()
  if not phrase then
    return nil
  end
  local spellings = memory:decode(phrase.entry.code)
  if #spellings == 0 then
    return nil
  end
  local code = table.concat(spellings, " ")
  local cache_key = code .. "\t" .. candidate.text
  local cached = cache[cache_key]
  if cached ~= nil then
    return cached ~= false and cached or nil
  end
  ---@type number|nil
  local weight
  -- Memory:user_lookup 接收方案棱镜输入；这里的 code 已由 DictEntry 解码为用户库的规范音节键，
  -- 必须绕过棱镜直接查 UserDictionary，否则 jxxd 一类缩写候选永远读不到真实用户权重。
  local entries = memory.user_dict:lookup_words(code, false, 0)
  for entry in entries:iter() do
    if entry.text == candidate.text then
      weight = math.max(weight or entry.weight, entry.weight)
    end
  end
  cache[cache_key] = weight or false
  return weight
end

---@param candidate Candidate
---@param memory Memory
---@param cache table<string, UserPhraseWeight>
---@return boolean
function priority.is_learned_phrase(candidate, memory, cache)
  return priority.is_user_phrase(candidate)
      or priority.user_phrase_weight(candidate, memory, cache) ~= nil
end

---@param candidate Candidate
---@param expected_length integer
---@return boolean
function priority.consumes_input(candidate, expected_length)
  return candidate._end - candidate._start == expected_length
end

---@param candidate Candidate
---@param expected_length integer
---@return Candidate
function priority.promote_exact_user_phrase(candidate, expected_length)
  if priority.consumes_input(candidate, expected_length) and priority.is_user_phrase(candidate) then
    candidate.quality = (candidate.quality or 0) + user_phrase_bonus
  end
  return candidate
end

---@param candidate Candidate
---@param current Candidate
---@param memory Memory|nil
---@param cache table<string, UserPhraseWeight>|nil
---@return boolean
function priority.better_across_routes(candidate, current, memory, cache)
  local candidate_is_learned
  local current_is_learned
  ---@type number|nil
  local candidate_weight
  ---@type number|nil
  local current_weight
  if memory and cache then
    candidate_weight = priority.user_phrase_weight(candidate, memory, cache)
    current_weight = priority.user_phrase_weight(current, memory, cache)
    candidate_is_learned = priority.is_user_phrase(candidate) or candidate_weight ~= nil
    current_is_learned = priority.is_user_phrase(current) or current_weight ~= nil
  else
    candidate_is_learned = priority.is_user_phrase(candidate)
    current_is_learned = priority.is_user_phrase(current)
  end
  if candidate_is_learned ~= current_is_learned then
    return candidate_is_learned
  end
  if candidate_weight and current_weight and candidate_weight ~= current_weight then
    return candidate_weight > current_weight
  end
  return (candidate.quality or 0) > (current.quality or 0)
end

return priority
