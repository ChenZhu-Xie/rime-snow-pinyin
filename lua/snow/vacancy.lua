-- 音节空桶判定
-- 只把词频大于 1 的完整单字候选视为有效音节，忽略大字集的零频和一次性兜底读音。

local vacancy = {}

---@param input string
---@param memory Memory
---@param cache table<string, boolean>
---@return boolean
function vacancy.is_empty(input, memory, cache)
  local cached = cache[input]
  if cached ~= nil then return cached end
  local occupied = false
  memory:dict_lookup(input, false, 1000)
  for entry in memory:iter_dict() do
    if utf8.len(entry.text) == 1 and entry.weight > 0 then
      occupied = true
    end
  end
  cache[input] = not occupied
  return not occupied
end

return vacancy
