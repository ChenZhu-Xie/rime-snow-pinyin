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

check("bnywe", 2, { 2, 5 })
check("bnyweo", 2, { 6, 5 })
check("bde", 2, { 3, 2 })
check("bdeu", 2, { 4, 2 })
check("bdeue", 2, { 4, 5 })
check("bdeuea", 2, { 4, 6 })
check("vrfp", 3, { 1, 2, 4 })
check("vrfpe", 3, { 5, 2, 4 })
check("vrfpeu", 3, { 5, 6, 4 })
check("rgxneu", 4, { 1, 5, 6, 4 })
print("冰雪鹮道：标准词语和声声空桶的逻辑字位导航通过")
