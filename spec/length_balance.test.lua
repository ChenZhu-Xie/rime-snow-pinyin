package.path = "./lua/?.lua;" .. package.path

package.preload["snow.snow"] = function()
  return { current = function() return "jxxd" end }
end

utf8 = {
  len = function(text)
    local _, count = text:gsub("[^\128-\191]", "")
    return count
  end,
}

local balance = require "snow.length_balance"

local function candidate(text)
  return { text = text }
end

local source = {
  candidate("九霄"),
  candidate("风萧萧"),
  candidate("非学校"),
  candidate("就小"),
  candidate("旧校"),
  candidate("发儿小"),
  candidate("分学校"),
  candidate("方案选单"),
  candidate("分享心得"),
}

local result = balance.rebalance(source, 6)
local counts = { 0, 0, 0 }
for index = 1, 6 do
  local length = utf8.len(result[index].text)
  counts[length - 1] = counts[length - 1] + 1
end
assert(counts[1] == 2 and counts[2] == 2 and counts[3] == 2)
assert(result[1].text == "九霄" and result[2].text == "就小")
assert(result[3].text == "风萧萧" and result[4].text == "非学校")
assert(result[5].text == "方案选单" and result[6].text == "分享心得")

local shortage = balance.rebalance({
  candidate("九霄"),
  candidate("风萧萧"),
  candidate("非学校"),
  candidate("发儿小"),
  candidate("分学校"),
  candidate("方案选单"),
  candidate("分享心得"),
}, 6)
counts = { 0, 0, 0 }
for index = 1, 6 do
  local length = utf8.len(shortage[index].text)
  counts[length - 1] = counts[length - 1] + 1
end
assert(counts[1] == 1 and counts[2] + counts[3] == 5)

print("length_balance.test.lua: ok")
