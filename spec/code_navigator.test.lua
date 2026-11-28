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
assert_positions("bkxhu", 2, { 5, 4 }, "snow_landao")
assert_positions("bkxhui", 2, { 5, 6 }, "snow_landao")
assert_positions("bkxhu", 2, { 5, 4 }, "snow_lanpin")
assert_positions("bkxhui", 2, { 5, 6 }, "snow_lanpin")
assert_positions("bkxhu", 2, { 5, 4 }, "snow_hedao")
assert_positions("bkxhui", 2, { 5, 6 }, "snow_hepin")

assert_positions("bhh", 3, { 1, 2, 3 })
assert_positions("bhhi", 3, { 1, 4, 3 }, "snow_landao")
assert_positions("bhhiv", 3, { 1, 4, 5 }, "snow_landao")
assert_positions("bhhivi", 3, { 6, 4, 5 }, "snow_landao")
assert_positions("bhhi", 3, { 1, 4, 3 }, "snow_lanpin")
assert_positions("bhhiv", 3, { 5, 4, 3 }, "snow_lanpin")
assert_positions("bhhivi", 3, { 5, 4, 6 }, "snow_lanpin")
assert_positions("bhhi", 3, { 1, 2, 4 }, "snow_hedao")
assert_positions("bhhiv", 3, { 1, 5, 4 }, "snow_hedao")
assert_positions("bhhivi", 3, { 6, 5, 4 }, "snow_hedao")
assert_positions("bhhi", 3, { 1, 2, 4 }, "snow_hepin")
assert_positions("bhhiv", 3, { 1, 5, 4 }, "snow_hepin")
assert_positions("bhhivi", 3, { 6, 5, 4 }, "snow_hepin")

assert_positions("wmxj", 4, { 1, 2, 3, 4 })
assert_positions("wmxji", 4, { 1, 5, 3, 4 }, "snow_landao")
assert_positions("wmxjiv", 4, { 1, 5, 6, 4 }, "snow_landao")
assert_positions("wmxjivu", 4, { 1, 5, 6, 4 }, "snow_landao")
assert_positions("wmxji", 4, { 1, 5, 3, 4 }, "snow_lanpin")
assert_positions("wmxjiv", 4, { 1, 5, 6, 4 }, "snow_lanpin")
assert_positions("wmxjivu", 4, { 7, 5, 6, 4 }, "snow_lanpin")
assert_positions("wmxji", 4, { 1, 5, 3, 4 }, "snow_hedao")
assert_positions("wmxjiv", 4, { 1, 5, 3, 6 }, "snow_hedao")
assert_positions("wmxji", 4, { 5, 2, 3, 4 }, "snow_hepin")
assert_positions("wmxjiv", 4, { 5, 2, 6, 4 }, "snow_hepin")

assert_positions("hoo", 4, { 1, 2, 3 })

for _, schema_id in ipairs({ "snow_hedao", "snow_hepin", "snow_huandao" }) do
  assert_positions("vuf", 2, { 2, 3 }, schema_id)
  assert_positions("vuf", 3, { 1, 2, 3 }, schema_id)
  assert_positions("vufe", 3, { 4, 2, 3 }, schema_id)
  assert_positions("vufeo", 3, { 4, 5, 3 }, schema_id)
  assert_positions("vufeoa", 3, { 4, 5, 6 }, schema_id)
  assert_positions("resn", 4, { 1, 2, 3, 4 }, schema_id)
  assert_positions("resni", 4, { 5, 2, 3, 4 }, schema_id)
  assert_positions("resnia", 4, { 5, 2, 3, 6 }, schema_id)
end

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
      schema_id = "snow_lanpin",
    },
  },
}
navigator.init(env)
assert(env.left_key == "Control+y")
assert(env.previous_key == "Control+u")
assert(env.next_key == "Control+i")
assert(env.right_key == "Control+o")
assert(env.uses_native_boundaries == false)

for _, schema_id in ipairs({ "snow_sipin", "snow_qingyun", "snow_yipin" }) do
  local forwarded = {}
  local native_env = {
    engine = {
      schema = {
        schema_id = schema_id,
      },
      context = {
        input = "bingwxuex",
        caret_pos = 9,
        is_composing = function() return true end,
        composition = {
          toSegmentation = function()
            return { back = function() return { start = 0, _end = 9 } end }
          end,
        },
        get_selected_candidate = function() return { text = "冰雪" } end,
      },
      process_key = function(_, key) forwarded[#forwarded + 1] = key end,
    },
  }
  navigator.init(native_env)
  assert(native_env.uses_native_boundaries == true)
  for _, repr in ipairs({ "Control+u", "Control+i" }) do
    local key = {
      modifier = 4,
      release = function() return false end,
      eq = function(_, other) return repr == other end,
    }
    assert(navigator.func(key, native_env) == 1)
  end
  assert(forwarded[1] == "Shift+Left" and forwarded[2] == "Shift+Right")
  local digit = {
    modifier = 0,
    keycode = 0x31,
    release = function() return false end,
    eq = function() return false end,
  }
  assert(navigator.func(digit, native_env) == 2, "native navigation must preserve number input")
end

print("code_navigator tests passed")
