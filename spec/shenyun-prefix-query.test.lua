package.path = "./lua/?.lua;" .. package.path
local prepared = 0
package.loaded["snow.snow"] = {
  prepare = function(candidate, proxy)
    prepared = prepared + 1
    candidate._end = #proxy:gsub("[ ?~]", "")
    return candidate
  end,
  comment = function(candidate, comment) candidate.comment = comment end,
}
package.loaded["snow.bihua"] = {}
package.loaded["snow.vacancy"] = { is_empty = function() return true end }
package.loaded["snow.candidate_priority"] = {}
local translator = require "snow.shenyun"
local emitted = {}
yield = function(candidate) emitted[#emitted + 1] = candidate end
local candidates = {
  { text = "不", _start = 0, _end = 1, comment = "" },
  { text = "不到", _start = 0, _end = 3, comment = "" },
  { text = "把", _start = 0, _end = 1, comment = "" },
  { text = "别的", _start = 0, _end = 3, comment = "" },
  { text = "不打", _start = 0, _end = 3, comment = "" },
}
local env = {
  engine = { context = { get_property = function() return "" end } },
  translator = { query = function(_, proxy)
    assert(proxy == "b d")
    return { iter = function()
      local index = 0
      return function() index = index + 1; return candidates[index] end
    end }
  end },
  initial_keys = "bpmfdtnlgkhjqwvxrzcsy",
  final_keys = "abcdefghijklmnopqrstuvwxyz",
  auxiliary_keys = "aeuio",
  auxiliary_mode = "shape",
  pair_standard_order = "12",
  auxiliary_cache = { ["不到\tAA\t"] = { "eaeu" }, ["不打\tAA\t"] = { "eaeu" }, ["别的\tAA\t"] = { "eeee" } },
}
translator.func("bdeaeu", { _end = 6 }, env)
assert(#emitted == 2 and emitted[1].text == "不到" and emitted[2].text == "不打")
assert(emitted[1]._end == 6 and emitted[2]._end == 6)
assert(prepared == 2, "前缀候选不应进入代理码修正；不能因此截断后续完整候选")
print("声声查询：前后夹杂的前缀不阻断完整词，排除前缀无需代理码修正")
