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
assert(result[1].text == "九霄" and result[2].text == "风萧萧")
assert(result[3].text == "非学校" and result[4].text == "就小")
assert(result[5].text == "方案选单" and result[6].text == "分享心得")

local learned = balance.rebalance({
  candidate("打开方式"),
  candidate("打开"),
  candidate("大可不必"),
  candidate("打卡方式"),
  candidate("大开眼界"),
  candidate("打开发"),
  candidate("大客户"),
  candidate("打开文件"),
}, 6)
assert(learned[1].text == "打开方式", "learned first candidate must remain first")

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

local reads = 0
local batch = {}
for index = 1, 120 do
  local text = ({ "一", "二字", "三字词", "四字成语" })[index % 4 + 1]
  batch[index] = setmetatable({}, { __index = function(_, key)
    assert(key == "text")
    reads = reads + 1
    return text
  end })
end
local balanced = balance.rebalance(batch, 6)
assert(#balanced == #batch and reads == #batch, "每个候选只读取一次文本")
local seen = {}
for _, value in ipairs(balanced) do
  assert(not seen[value], "不能重复输出候选")
  seen[value] = true
end
for _, value in ipairs(batch) do assert(seen[value], "不能丢失候选") end

-- 实际过滤器惰性分页必须与完整重排逐项相同，包括跨 120 候选批次。
local stream = {}
for index = 1, 257 do stream[index] = candidate(string.rep("字", index % 5 + 1)) end
local expected = {}
for start = 1, #stream, 120 do
  local chunk = {}
  for index = start, math.min(start + 119, #stream) do chunk[#chunk + 1] = stream[index] end
  for _, value in ipairs(balance.rebalance(chunk, 6)) do expected[#expected + 1] = value end
end
local pulled = 0
local translation = { iter = function()
  return function() pulled = pulled + 1; return stream[pulled] end
end }
yield = coroutine.yield
local task = coroutine.create(function()
  balance.func(translation, { maximum_candidates = 120, page_size = 6 })
end)
for index, value in ipairs(expected) do
  local ok, actual = coroutine.resume(task)
  assert(ok and actual == value, "惰性过滤器不能改变跨页顺序")
  if index == 1 then assert(pulled == 120, "首项须保留原有完整预取批次") end
end
assert(coroutine.resume(task) and coroutine.status(task) == "dead")
print("length_balance.test.lua: ok")
