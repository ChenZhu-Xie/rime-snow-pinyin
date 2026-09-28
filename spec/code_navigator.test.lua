package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path
package.loaded["snow.snow"] = {
  kAccepted = 1,
  kNoop = 2,
}

local navigator = require "snow.code_navigator"

local function assert_positions(input, word_length, expected)
  local actual = navigator.logical_positions(input, word_length)
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

assert_positions("bhh", 3, { 1, 2, 3 })
assert_positions("bhhi", 3, { 1, 2, 4 })
assert_positions("bhhiv", 3, { 5, 2, 4 })
assert_positions("bhhivi", 3, { 5, 6, 4 })

assert_positions("wmxj", 4, { 1, 2, 3, 4 })
assert_positions("wmxji", 4, { 1, 2, 3, 5 })
assert_positions("wmxjiv", 4, { 6, 2, 3, 5 })
assert_positions("wmxjivu", 4, { 6, 7, 3, 5 })

assert_positions("hoo", 4, { 1, 2, 3 })

assert(navigator.index_for_digit("1", 4) == 1)
assert(navigator.index_for_digit("4", 4) == 2)
assert(navigator.index_for_digit("5", 4) == 3)
assert(navigator.index_for_digit("6", 4) == 4)
assert(navigator.index_for_digit("6", 3) == nil)
assert(navigator.index_for_digit("7", 4) == nil)

print("code_navigator tests passed")
