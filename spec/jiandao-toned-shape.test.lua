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
    ["冰"] = "ovui", ["雪"] = "vuio", ["输"] = "iv",
    ["入"] = "uo", ["法"] = "aov", ["人"] = "iu",
    ["工"] = "vv", ["智"] = "oi", ["能"] = "ao",
  },
  pair_standard_order = "21", three_word_order = "213", four_word_order = "14",
  pair_aux_cache = {}, pair_aux_cache_size = 0,
  engine = { schema = { schema_id = "snow_jiandao_toned" } },
}
local state = {
  id = "snow_jiandao_toned", current = "bmxd", is_pinyin = false,
  jiandao_active = true, show_chaifen = false,
}
local function match(text, input, suffix, expected)
  state.current = input
  local accepted = filter.handle_candidate(text, suffix, env, state)
  assert(accepted == expected, text .. " " .. input .. " " .. suffix)
end
match("冰", "bm", "ovui", true)
match("冰", "bm", "ovuiu", false)
match("冰雪", "bmxd", "vo", true)
match("冰雪", "bmxd", "ov", false)
match("输入法", "lrf", "uia", true)
match("输入法", "lrf", "uai", false)
match("人工智能", "rgkn", "ia", true)
match("人工智能", "rgkn", "va", false)
state.initial_pair = true
state.current = "rb"
local accepted, _, comment = filter.handle_candidate("冰雪", "ovv", env, state)
assert(accepted and comment == "〔形₁₁₂₂ u〕")
assert(not filter.handle_candidate("冰雪", "vu", env, state))
local function positions(input, length, expected)
  local actual = navigator.logical_positions(input, length, "snow_jiandao_toned")
  assert(#actual == #expected, input)
  for index, value in ipairs(expected) do assert(actual[index] == value, input .. " " .. index) end
end
positions("bmxdv", 2, { 2, 5 })
positions("bmxdvo", 2, { 6, 5 })
positions("rbov", 2, { 4, 2 })
positions("rbovvu", 2, { 4, 6 })
positions("lrfuia", 3, { 5, 4, 6 })
positions("rgknia", 4, { 5, 2, 3, 6 })
print("冰雪莲道：真实形辅过滤路径、21/213/14、声声反序逐字两辅和字位导航通过")
