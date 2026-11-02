package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path
package.loaded["snow.snow"] = {
  kAccepted = 1,
  kNoop = 2,
}

local navigator = require "snow.code_navigator"

local function assert_positions(input, word_length, expected, schema_id)
  local actual = navigator.logical_positions(input, word_length, schema_id)
  assert(#actual == #expected, ("%s: expected %d positions, got %d"):format(input, #expected, #actual))
  for index, value in ipairs(expected) do
    assert(actual[index] == value,
      ("%s: position %d expected %d, got %s"):format(input, index, value, tostring(actual[index])))
  end
end

assert_positions("bk", 1, { 2 })
assert_positions("bki", 1, { 3 })

assert_positions("bf", 2, { 1, 2 })
assert_positions("ho", 2, { 1, 2 })
assert_positions("pui", 2, { 3, 2 })
assert_positions("bkxh", 2, { 2, 4 })
assert_positions("bkxhu", 2, { 2, 5 })
assert_positions("bkxhui", 2, { 6, 5 })
assert_positions("bkxhu", 2, { 5, 4 }, "snow_jiandao")
assert_positions("bkxhui", 2, { 5, 6 }, "snow_jiandao")
assert_positions("bkxhu", 2, { 5, 4 }, "snow_sanpin")
assert_positions("bkxhui", 2, { 5, 6 }, "snow_sanpin")
assert_positions("bkxhu", 2, { 5, 4 }, "snow_shenyun_shape")
assert_positions("bkxhui", 2, { 5, 6 }, "snow_shenyun_tone")

assert_positions("bhh", 3, { 1, 2, 3 })
assert_positions("bhhi", 3, { 1, 4, 3 }, "snow_jiandao")
assert_positions("bhhiv", 3, { 1, 4, 5 }, "snow_jiandao")
assert_positions("bhhivi", 3, { 6, 4, 5 }, "snow_jiandao")
assert_positions("bhhi", 3, { 1, 4, 3 }, "snow_sanpin")
assert_positions("bhhiv", 3, { 5, 4, 3 }, "snow_sanpin")
assert_positions("bhhivi", 3, { 5, 4, 6 }, "snow_sanpin")
assert_positions("bhhi", 3, { 1, 2, 4 }, "snow_shenyun_shape")
assert_positions("bhhiv", 3, { 1, 5, 4 }, "snow_shenyun_shape")
assert_positions("bhhivi", 3, { 6, 5, 4 }, "snow_shenyun_shape")
assert_positions("bhhi", 3, { 1, 2, 4 }, "snow_shenyun_tone")
assert_positions("bhhiv", 3, { 1, 5, 4 }, "snow_shenyun_tone")
assert_positions("bhhivi", 3, { 6, 5, 4 }, "snow_shenyun_tone")

assert_positions("wmxj", 4, { 1, 2, 3, 4 })
assert_positions("wmxji", 4, { 1, 5, 3, 4 }, "snow_jiandao")
assert_positions("wmxjiv", 4, { 1, 5, 3, 6 }, "snow_jiandao")
assert_positions("wmxjivu", 4, { 7, 5, 3, 6 }, "snow_jiandao")
assert_positions("wmxji", 4, { 1, 5, 3, 4 }, "snow_sanpin")
assert_positions("wmxjiv", 4, { 1, 5, 6, 4 }, "snow_sanpin")
assert_positions("wmxjivu", 4, { 7, 5, 6, 4 }, "snow_sanpin")
assert_positions("wmxji", 4, { 1, 2, 3, 5 }, "snow_shenyun_shape")
assert_positions("wmxjiv", 4, { 1, 6, 3, 5 }, "snow_shenyun_shape")
assert_positions("wmxji", 4, { 5, 2, 3, 4 }, "snow_shenyun_tone")
assert_positions("wmxjiv", 4, { 5, 2, 6, 4 }, "snow_shenyun_tone")

assert_positions("hoo", 4, { 1, 2, 3 })

assert(navigator.index_for_digit("1", 4) == 1)
assert(navigator.index_for_digit("4", 4) == 2)
assert(navigator.index_for_digit("5", 4) == 3)
assert(navigator.index_for_digit("6", 4) == 4)
assert(navigator.index_for_digit("6", 3) == nil)
assert(navigator.index_for_digit("7", 4) == nil)

KeyEvent = function(repr) return repr end
local env = {
  engine = {
    schema = {
      schema_id = "snow_sanpin",
    },
  },
}
navigator.init(env)
assert(env.left_key == "Control+y")
assert(env.previous_key == "Control+u")
assert(env.next_key == "Control+i")
assert(env.right_key == "Control+o")
assert(env.uses_native_boundaries == false)

for _, schema_id in ipairs({ "snow_sipin", "snow_qingyun" }) do
  local native_env = {
    engine = {
      schema = {
        schema_id = schema_id,
      },
    },
  }
  navigator.init(native_env)
  assert(native_env.uses_native_boundaries == true)
end

print("code_navigator tests passed")
