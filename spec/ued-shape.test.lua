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
    ["输"] = "vaiv", ["入"] = "uo", ["法"] = "avoa",
    ["人"] = "i", ["工"] = "viv", ["智"] = "uvoi", ["能"] = "aoua",
  },
  pair_standard_order = "12", three_word_order = "231", four_word_order = "23",
  pair_aux_cache = {}, pair_aux_cache_size = 0,
  engine = { schema = { schema_id = "snow_landao" } },
}
local state = { id = "snow_landao", current = "krf", is_pinyin = false, jiandao_active = true, show_chaifen = false }
for _, id in ipairs({ "snow_landao", "snow_jiandao", "snow_liandao" }) do
  state.id = id
  state.current = "xg"
  for _, text in ipairs({ "v", "V", "7" }) do
    assert(filter.handle_candidate(text, "", env, state))
    assert(not filter.handle_candidate(text, "v", env, state))
    assert(not filter.handle_candidate(text, "vvii", env, state))
    assert(filter.handle_candidate(text, "v", env, state, { comment = "📌", type = "table" }))
    assert(filter.handle_candidate(text, "v", env, state, { comment = "📍", type = "table" }))
  end
  -- 无形码的汉字仍按既有合同放行，不能把修复扩大到全部未知字符。
  assert(filter.handle_candidate("𠮷", "v", env, state))
end
state.id = "snow_landao"
state.current = "krf"
assert(filter.handle_candidate("输入法", "uav", env, state))
assert(not filter.handle_candidate("输入法", "uva", env, state))
state.current = "rgen"
assert(filter.handle_candidate("人工智能", "vu", env, state))
assert(not filter.handle_candidate("人工智能", "va", env, state))
for _, case in ipairs({
  { "snow_landao", "krfuav", 3, { 6, 4, 5 } },
  { "snow_landao", "rgenvu", 4, { 1, 5, 6, 4 } },
  { "snow_lanpin", "krfaiu", 3, { 5, 4, 6 } },
  { "snow_lanpin", "tkdlva", 4, { 1, 5, 6, 4 } },
}) do
  local actual = navigator.logical_positions(case[2], case[3], case[1])
  assert(table.concat(actual, ",") == table.concat(case[4], ","), case[1] .. " " .. case[2])
end
print("UED：兰道 12/231/23 形辅过滤及兰道、兰拼字位导航通过")
