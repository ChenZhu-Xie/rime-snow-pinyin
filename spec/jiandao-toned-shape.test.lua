package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path
package.loaded["snow.snow"] = {
  kAccepted = 1, kNoop = 2,
  sub = function(text, first, last)
    local start = utf8.offset(text, first)
    local finish = utf8.offset(text, last + 1)
    return text:sub(start, finish and finish - 1 or -1)
  end,
}
local filter = require "snow.shape_filter"
local navigator = require "snow.code_navigator"
local env = {
  shape_mapping = {},
  jiandao_shape_cache = {
    ["冰"] = "ova", ["雪"] = "voav", ["输"] = "vaiv",
    ["入"] = "uo", ["法"] = "avoa", ["人"] = "i",
    ["工"] = "viv", ["智"] = "uvoi", ["能"] = "aoua",
  },
  pair_standard_order = "21", three_word_order = "231", four_word_order = "14",
  pair_aux_cache = {}, pair_aux_cache_size = 0,
  engine = { schema = { schema_id = "snow_jiandao_toned" } },
}
local state = {
  id = "snow_jiandao_toned", current = "bzxd", is_pinyin = false,
  jiandao_active = true, show_chaifen = false,
}
local function match(text, input, suffix, expected)
  state.current = input
  local accepted = filter.handle_candidate(text, suffix, env, state)
  assert(accepted == expected, text .. " " .. input .. " " .. suffix)
end
match("雪", "xd", "voav", true)
match("雪", "xd", "voava", false)
match("冰雪", "bzxd", "vo", true)
match("冰雪", "bzxd", "ov", false)
match("输入法", "krf", "uav", true)
match("输入法", "krf", "ua", true)
match("输入法", "krf", "uv", false)
match("输入法", "krf", "uva", false)
match("人工智能", "rgen", "ia", true)
match("人工智能", "rgen", "va", false)
state.initial_pair = true
state.current = "rf"
local accepted, _, comment = filter.handle_candidate("冰雪", "ovv", env, state)
assert(accepted and comment == "〔形₁₁₂₂ o〕")
assert(not filter.handle_candidate("冰雪", "vu", env, state))
-- 「人」仅有一辅，缺少第二辅时不能挪用「工」的形码补齐该字边界。
assert(filter.handle_candidate("人工", "i", env, state))
assert(not filter.handle_candidate("人工", "iv", env, state))
local function positions(input, length, expected)
  local actual = navigator.logical_positions(input, length, "snow_jiandao_toned")
  assert(#actual == #expected, input)
  for index, value in ipairs(expected) do assert(actual[index] == value, input .. " " .. index) end
end
positions("bzxdv", 2, { 2, 5 })
positions("bzxdvo", 2, { 6, 5 })
positions("rfov", 2, { 4, 2 })
positions("rfovvu", 2, { 4, 6 })
positions("krfu", 3, { 1, 4, 3 })
positions("krfua", 3, { 1, 4, 5 })
positions("krfuav", 3, { 6, 4, 5 })
positions("rgenia", 4, { 5, 2, 3, 6 })
-- 大写补韵沿用兰道，输入长度不能被误当成第三个四字词形辅而写入 nil 下标。
positions("rSgNeRn", 4, { 5, 2, 3, 6 })
print("冰雪莲道：真实形辅过滤路径、21/231/14、声声反序逐字两辅和字位导航通过")
