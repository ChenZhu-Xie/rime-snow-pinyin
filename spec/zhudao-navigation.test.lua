package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path
package.loaded["snow.snow"] = { kAccepted = 1, kNoop = 2 }
local navigator = require "snow.code_navigator"

local function check(input, length, expected)
  local actual = navigator.logical_positions(input, length, "snow_zhudao")
  assert(#actual == #expected, input)
  for index, value in ipairs(expected) do
    assert(actual[index] == value,
      ("%s 第 %d 字：期望 %d，实际 %s"):format(input, index, value, tostring(actual[index])))
  end
end

check("bnyroe", 2, { 5, 6 })
check("bde", 2, { 1, 3 })
check("bdea", 2, { 1, 4 })
check("bdeae", 2, { 5, 4 })
check("bdeaeu", 2, { 6, 4 })
check("vrfy", 3, { 1, 2, 4 })
check("vrfye", 3, { 5, 2, 4 })
check("vrfyeu", 3, { 5, 6, 4 })
check("rgsnea", 4, { 1, 5, 3, 6 })
print("冰雪鹮道：标准词语和声声空桶的逻辑字位导航通过")
