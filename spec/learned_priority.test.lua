package.path = "./lua/?.lua;" .. package.path

package.preload["snow.snow"] = function()
  return { current = function() return "jxxd" end }
end

local learned_priority = require "snow.learned_priority"

local function candidate(text, spellings, consumed_length)
  local phrase = { entry = { code = spellings } }
  return {
    type = "phrase",
    text = text,
    _start = 0,
    _end = consumed_length or 4,
    get_genuine = function() return {
      type = "phrase",
      to_phrase = function() return phrase end,
    } end,
  }
end

local current_code = ""
local memory = {
  decode = function(_, code) return code end,
  user_dict = {
    lookup_words = function(_, code)
      current_code = code
      local entries = {}
      if current_code == "fang1 an4 xuan3 dan1" then
        entries = { { text = "方案选单", weight = -1 } }
      elseif current_code == "jiu3 xiao1" then
        entries = { { text = "九霄", weight = -5 } }
      elseif current_code == "qian2 zhui4" then
        entries = { { text = "前缀", weight = 999 } }
      end
      return {
        iter = function()
          local index = 0
          return function()
            index = index + 1
            return entries[index]
          end
        end,
      }
    end,
  },
}

local source = {
  candidate("九霄", { "jiu3", "xiao1" }),
  candidate("风萧萧", { "feng1", "xiao1", "xiao1" }),
  candidate("方案选单", { "fang1", "an4", "xuan3", "dan1" }),
}
local result = learned_priority.prioritize(source, memory, {}, 4)
assert(result[1].text == "方案选单",
  "the higher native user-dictionary weight must win when both phrases are learned")
assert(result[2].text == "九霄" and result[3].text == "风萧萧",
  "ordinary candidates must retain their original relative order")
local readonly = learned_priority.prioritize(source, {}, {}, 4)
for index, value in ipairs(source) do
  assert(readonly[index] == value, "关闭学习时不得改变系统候选顺序")
end

local fixed = candidate("固定候选", { "gu4", "ding4", "hou4", "xuan3" })
fixed.comment = "📌"
result = learned_priority.prioritize({
  fixed,
  candidate("九霄", { "jiu3", "xiao1" }),
  candidate("方案选单", { "fang1", "an4", "xuan3", "dan1" }),
}, memory, {}, 4)
assert(result[1].text == "固定候选",
  "learned ranking must not displace a fixed candidate")
assert(result[2].text == "方案选单" and result[3].text == "九霄",
  "learned weights must still rank the unfixed slots")

result = learned_priority.prioritize({
  candidate("前缀", { "qian2", "zhui4" }, 2),
  candidate("普通", { "pu3", "tong1" }),
  candidate("方案选单", { "fang1", "an4", "xuan3", "dan1" }),
}, memory, {}, 4)
assert(result[1].text == "方案选单",
  "an exact learned phrase must outrank a partial user candidate")
assert(result[2].text == "前缀" and result[3].text == "普通",
  "partial candidates must retain ordinary relative order")

local has_words = false
local probes, pulls = 0, 0
local streaming_memory = {
  decode = memory.decode,
  user_dict = { lookup_words = function(_, code, predictive, limit)
    if code ~= "" then return memory.user_dict:lookup_words(code) end
    assert(predictive and limit == 1)
    probes = probes + 1
    local pending = has_words
    return { iter = function() return function()
      if pending then pending = false; return { text = "方案选单" } end
    end end }
  end },
}
local env = { memory = streaming_memory, engine = { context = {} }, cache = {}, maximum_candidates = 120 }
local function output()
  pulls = 0
  local translation = { iter = function()
    local index = 0
    return function() index = index + 1; pulls = pulls + 1; return source[index] end
  end }
  yield = coroutine.yield
  return coroutine.create(function() learned_priority.func(translation, env) end)
end
local task = output()
local ok, first = coroutine.resume(task)
assert(ok and first == source[1] and pulls == 1, "空用户词库必须流式输出首项，不预取 120 项")
for index = 2, #source do
  local success, value = coroutine.resume(task)
  assert(success and value == source[index])
end
has_words = true
task = output()
ok, first = coroutine.resume(task)
assert(ok and first.text == "方案选单" and probes == 2,
  "新增学习词后必须立即恢复学习排序，不能缓存空库判断")
print("learned_priority.test.lua: ok")
