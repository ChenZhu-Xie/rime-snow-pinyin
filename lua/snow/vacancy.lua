-- 音节空桶判定
-- 只把词频大于 1 的完整单字候选视为有效音节，忽略大字集的零频和一次性兜底读音。

local vacancy = {}

---@param input string
---@param segment Segment
---@param translator Translator
---@param cache table<string, boolean>
---@return boolean
function vacancy.is_empty(input, segment, translator, cache)
  local cached = cache[input]
  if cached ~= nil then return cached end
  local translation = translator:query(input, segment)
  if translation then
    for candidate in translation:iter() do
      local genuine = candidate:get_genuine()
      local phrase = genuine:to_phrase()
      local consumed = genuine._end - genuine.start
      if phrase and consumed == input:len() and utf8.len(candidate.text) == 1
          and phrase.entry.weight > 0 then
        cache[input] = false
        return false
      end
    end
  end
  cache[input] = true
  return true
end

return vacancy
