-- 音节空桶判定
-- 系统词典里有完整单字候选即占桶；仅忽略整组单字词频都不超过 1 的大字集兜底音节。

local vacancy = {}

-- 按拼音而非方案码记录，映射变化后仍由运行时查询决定落在哪个桶。
---@type table<string, boolean>
local fallback_syllables = {
  biang = true,
  bong = true,
  cei = true,
  chua = true,
  din = true,
  eng = true,
  fiao = true,
  gue = true,
  hm = true,
  len = true,
  lvan = true,
  n = true,
  nia = true,
  nui = true,
  nun = true,
  pia = true,
  r = true,
  rua = true,
  sei = true,
  tei = true,
  wong = true,
  yai = true,
  zhei = true,
  ["ê"] = true,
}

---@param entry DictEntry
---@param memory Memory
---@return boolean
local function is_fallback(entry, memory)
  local spelling = memory:decode(entry.code)[1]
  return spelling ~= nil and fallback_syllables[spelling:gsub("[0-9]$", "")] == true
end

---@param input string
---@param memory Memory
---@param cache table<string, boolean>
---@return boolean
function vacancy.is_empty(input, memory, cache)
  local cached = cache[input]
  if cached ~= nil then return cached end
  -- 冰雪三拼的完整单字还有第三位声调，必须以前缀方式查询前两码；
  -- 冰雪键道和冰雪神韵的完整单字仍会作为精确匹配返回。
  memory:dict_lookup(input, true, 1000)
  local occupied = false
  for entry in memory:iter_dict() do
    if utf8.len(entry.text) == 1 and not is_fallback(entry, memory) then
      occupied = true
    end
  end
  cache[input] = not occupied
  return not occupied
end

return vacancy
