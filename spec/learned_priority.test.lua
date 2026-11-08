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

local memory = {
  decode = function(_, code) return code end,
  user_lookup = function(_, code)
    return code == "fang1 an4 xuan3 dan1"
  end,
  iter_user = function()
    local yielded = false
    return function()
      if yielded then return nil end
      yielded = true
      return { text = "方案选单" }
    end
  end,
}

local source = {
  candidate("九霄", { "jiu3", "xiao1" }),
  candidate("风萧萧", { "feng1", "xiao1", "xiao1" }),
  candidate("方案选单", { "fang1", "an4", "xuan3", "dan1" }),
}
local result = learned_priority.prioritize(source, memory, {})
assert(result[1].text == "方案选单")
assert(result[2].text == "九霄" and result[3].text == "风萧萧",
  "ordinary candidates must retain their original relative order")

print("learned_priority.test.lua: ok")
