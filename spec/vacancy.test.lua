package.path = "./lua/?.lua;" .. package.path
utf8 = utf8 or { len = function(text)
  local _, count = text:gsub("[^\128-\191]", "")
  return count
end }
local vacancy = require "snow.vacancy"
local pulls, queries = 0, 0
local memory = { decode = function(_, code) return { code } end }
local projection = { apply = function(_, spelling)
  return spelling == "wrong1" and "zz" or "bh"
end }
local function candidate(text, code, consumed)
  local value = { text = text, start = 0, _end = consumed or 2 }
  function value:get_genuine() return self end
  function value:to_phrase() return code and { entry = { code = code } } or nil end
  return value
end
local function translator(candidates, forbid_end)
  return { query = function()
    queries = queries + 1
    return { iter = function()
      local index = 0
      return function()
        index = index + 1
        pulls = pulls + 1
        if forbid_end then assert(index <= #candidates, "占桶后不应继续拉取候选") end
        return candidates[index]
      end
    end }
  end }
end
local rejected = {
  candidate("不", nil), candidate("不是", "bu4"), candidate("不", "bu4", 1),
  candidate("不", "~b"), candidate("不", "wrong1"), candidate("不", "biang1"),
}
local empty_cache = {}
assert(vacancy.is_empty("bh", {}, translator(rejected), memory, projection, empty_cache))
assert(pulls == #rejected + 1, "空桶必须遍历完所有候选")
local occupied = {}
for _, value in ipairs(rejected) do occupied[#occupied + 1] = value end
occupied[#occupied + 1] = candidate("不", "bu4")
local cache = {}
pulls = 0
local source = translator(occupied, true)
assert(not vacancy.is_empty("bh", {}, source, memory, projection, cache))
assert(pulls == #occupied and cache.bh == false)
local previous_queries = queries
assert(not vacancy.is_empty("bh", {}, source, memory, projection, cache))
assert(vacancy.is_empty("bh", {}, source, memory, projection, empty_cache))
assert(queries == previous_queries, "占桶和空桶均须命中缓存")
print("vacancy.test.lua: ok")
