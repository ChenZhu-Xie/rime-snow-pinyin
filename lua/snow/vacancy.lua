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
---@param segment Segment
---@param translator Translator
---@param memory Memory
---@param cache table<string, boolean>
---@return boolean
function vacancy.is_empty(input, segment, translator, memory, cache)
  local cached = cache[input]
  if cached ~= nil then return cached end
  local occupied = false
  local translation = translator:query(input, segment)
  if translation then
    for candidate in translation:iter() do
      local genuine = candidate:get_genuine()
      local phrase = genuine:to_phrase()
      local consumed = genuine._end - genuine.start
      if phrase and consumed == input:len() and utf8.len(candidate.text) == 1
          and not is_fallback(phrase.entry, memory) then
        occupied = true
      end
    end
  end
  cache[input] = not occupied
  return not occupied
end

return vacancy
