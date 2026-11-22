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

-- 使用可区分各字位的形码，核对鹮道 R2 的 21/12/23 与空桶反序 1122。
package.loaded["snow.vacancy"].is_empty = function(code) return code == "bd" or code == "ko" end
env.pair_standard_order = "21"
env.three_word_order = "12"
env.four_word_order = "23"
env.auxiliary_cache = {}
env.shape_elements = { lookup = function(_, character) return character end }
env.shape_mapping = {
  ["冰"] = "o", ["雪"] = "v", ["输"] = "v", ["入"] = "u", ["法"] = "o",
  ["人"] = "u", ["工"] = "v", ["智"] = "u", ["能"] = "a",
  ["不"] = "vu", ["到"] = "va", ["数"] = "o", ["据"] = "i", ["库"] = "u",
}
local phrases = {
  ["bn yw"] = "冰雪", ["v r fp"] = "输入法", ["R G X N"] = "人工智能",
  ["b d"] = "不到", ["v j k"] = "数据库",
}
env.translator.query = function(_, proxy)
  local text = phrases[proxy]
  if not text then return nil end
  local candidate = { text = text, _start = 0, _end = #proxy, comment = "" }
  return { iter = function()
    local pending = candidate
    return function() local result = pending; pending = nil; return result end
  end }
end
local function check_policy(input, text, preedit)
  emitted = {}
  translator.func(input, { _end = #input }, env)
  assert(#emitted == 1 and emitted[1].text == text, input)
  assert(emitted[1].preedit == preedit, input .. ": " .. tostring(emitted[1].preedit))
end
check_policy("bnyweo", "冰雪", "bn yw 形[eo]")
check_policy("vrfpeu", "输入法", "v r fp 形[eu]")
check_policy("rgxneu", "人工智能", "r g x n 形[eu]")
check_policy("bdeuea", "不到", "b d 形[euea]")
check_policy("vjkoi", "数据库", "v j k 形[oi]")
print("鹮道 R2：标准词形辅 21/12/23、声声反序 1122 与 AAA+B 空桶路由通过")
