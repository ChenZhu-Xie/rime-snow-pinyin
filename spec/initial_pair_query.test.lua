package.path = "./lua/?.lua;" .. package.path

package.loaded["snow.snow"] = {
  prepare = function(candidate, proxy)
    candidate._end = #proxy:gsub("[ ?~]", "")
    return candidate
  end,
}
package.loaded["snow.vacancy"] = { is_empty = function() return true end }
package.loaded["snow.candidate_priority"] = { promote_exact_user_phrase = function(candidate) return candidate end }
rime_api = { regex_match = function() return false end }
local table_like = require "snow.table_like"
local emitted = {}
yield = function(candidate) emitted[#emitted + 1] = candidate end

local function translation(proxy)
  local count = 0
  return { iter = function()
    return function()
      count = count + 1
      if count == 1 then return { text = "AB", _start = 0, _end = #proxy, quality = 0 } end
      if count == 2 then return { text = "A", _start = 0, _end = 1, quality = 0 } end
      error("完整声声候选结束后不应继续扫描单字前缀")
    end
  end }
end

local env = {
  translator = { query = function(_, input) return translation(input) end },
  reserved_pattern = "^$",
}
table_like.initial_pair.func("yx", { start = 0, _end = 2 }, env)
assert(#emitted == 1 and emitted[1].type == "initial_pair")

rime_api.regex_match = function() return true end
env.pattern = ".*"
env.pattern2 = ".*"
env.engine = { context = {
  composition = { toSegmentation = function() return { get_at = function() return nil end } end },
  get_option = function() return true end,
  get_property = function() return "aoiu" end,
} }
env.translator = { query = function() error("空桶不应重复查询原码路径") end }
for _, order in ipairs({ "12", "21" }) do
  env.pair_standard_order = order
  env.pair_translator = { query = function(_, proxy)
    assert(proxy == (order == "12" and "y?i x?a" or "y?a x?i"))
    return translation(proxy)
  end }
  -- 仅启用 t1；标准四码二字词路由不属于本用例。
  local matches = 0
  rime_api.regex_match = function()
    matches = matches + 1
    return matches == 1
  end
  emitted = {}
  table_like.t12.func("yx", { start = 0, _end = 2 }, env)
  assert(#emitted == 1 and emitted[1]._end == 2 and emitted[1].preedit == "y x")
end
print("声声查询：前缀提前终止、单一路径、两种辅序的原生调码约束通过")
