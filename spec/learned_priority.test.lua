package.path = "./lua/?.lua;" .. package.path

package.preload["snow.snow"] = function()
  return { current = function() return "jxxd" end }
end

local learned_priority = require "snow.learned_priority"

local function candidate(text, spellings)
  local phrase = { entry = { code = spellings } }
  return {
    type = "phrase",
    text = text,
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
local result = learned_priority.prioritize(source, memory, {})
assert(result[1].text == "方案选单",
  "the higher native user-dictionary weight must win when both phrases are learned")
assert(result[2].text == "九霄" and result[3].text == "风萧萧",
  "ordinary candidates must retain their original relative order")

local fixed = candidate("固定候选", { "gu4", "ding4", "hou4", "xuan3" })
fixed.comment = "📌"
result = learned_priority.prioritize({
  fixed,
  candidate("九霄", { "jiu3", "xiao1" }),
  candidate("方案选单", { "fang1", "an4", "xuan3", "dan1" }),
}, memory, {})
assert(result[1].text == "固定候选",
  "learned ranking must not displace a fixed candidate")
assert(result[2].text == "方案选单" and result[3].text == "九霄",
  "learned weights must still rank the unfixed slots")

print("learned_priority.test.lua: ok")
