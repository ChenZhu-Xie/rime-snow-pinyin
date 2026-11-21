package.path = "./lua/?.lua;" .. package.path

local auxiliary_hint = require "snow.auxiliary_hint"

assert(auxiliary_hint.next_codes({ "ui", "uo" }, "") == "ui/uo")
assert(auxiliary_hint.next_codes({ "ui", "uo" }, "u") == "i/o")

assert(auxiliary_hint.format_preedit("dk jw", "ui", "shape", { 1, 2 }) == "dk jw 形[ui]")
assert(auxiliary_hint.format_preedit("dk jw", "ui", "tone", { 1, 2 }) == "dku jwi")

assert(auxiliary_hint.format_preedit("d k jw", "ui", "tone", { 2, 1 }) == "di ku jw")

assert(auxiliary_hint.format_preedit("dk", "uia", "tone", { 1 }) == "dku 笔[ia]")

print("shenyun_hint.test.lua: ok")

local current = "q"
package.loaded["snow.snow"] = {
  current = function() return current end,
  get_dictionary_path = function() return "fixture" end,
  read_dictionary = function() return { q = { "三", "3" }, s = { "这" } } end,
}
package.loaded["snow.shenyun_hints"] = {
  fixture = { q = { { text = "提示", code = "qz" } }, s = { { text = "支持", code = "sx" } } },
}
Candidate = function(kind, start, finish, text, comment)
  return { type = kind, _start = start, _end = finish, text = text, comment = comment }
end
local filter = require "snow.shenyun_hint"
local env = { engine = { schema = { schema_id = "fixture", config = { get_string = function() return "qs" end } }, context = {} } }
filter.init(env)
local function collect(texts)
  local result = {}
  local translation = { iter = function()
    local index = 0
    return function()
      index = index + 1
      local text = texts[index]
      if text then return Candidate("phrase", 0, 1, text, "") end
    end
  end }
  yield = function(candidate) result[#result + 1] = candidate.text end
  filter.func(translation, env)
  return table.concat(result, " ")
end
assert(collect({ "三", "3", "其" }) == "三 3 提示 其", "数字固顶必须排在空桶提示之前")
current = "s"
assert(collect({ "这", "中", "着" }) == "这 支持 中 着", "其他单键的提示位置及自然候选顺序不变")
assert(collect({}) == "", "空翻译不生成提示")
print("shenyun fixed-prefix hints: ok")
