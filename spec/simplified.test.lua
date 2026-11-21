package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path

local conversions = { ["這"] = "这", ["來"] = "来" }
Opencc = function()
  return { convert_text = function(_, text) return conversions[text] or text end }
end
local filter = require "snow.simplified"
local traditional = false
local env = { engine = { context = { get_option = function() return traditional end } } }
filter.init(env)
local input = { { text = "這" }, { text = "㬚" }, { text = "这" }, { text = "𤭢" } }
local function collect()
  local result = {}
  local translation = { iter = function()
    local index = 0
    return function() index = index + 1; return input[index] end
  end }
  yield = function(candidate) result[#result + 1] = candidate.text end
  filter.func(translation, env)
  return table.concat(result, " ")
end
assert(collect() == "㬚 这 𤭢 這", "简体模式后置繁体原字，不丢失生僻及扩展区字")
traditional = true
assert(collect() == "這 㬚 这 𤭢", "繁体模式保留固顶原序，交由 simplifier 转换")
env.converter = nil
traditional = false
assert(collect() == "這 㬚 这 𤭢", "缺少 OpenCC 时透传，不吞候选")
filter.fini(env)
assert(env.converter == nil and env.cache == nil)
print("simplified candidate contracts passed")
