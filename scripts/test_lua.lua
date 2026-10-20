-- 不需要 Rime 的 Lua 回归测试：lua scripts/test_lua.lua
-- Rime 接口在这里用最小替身提供，真实输入流程仍由 spec/*.test.yaml 验证
---@diagnostic disable

local script_dir = arg[0]:match("^(.*[/\\])") or ""
package.path = script_dir .. "../lua/?.lua;" .. package.path

local candidates = {}
function Candidate(kind, start, finish, text, comment)
  assert(type(text) == "string", "候选文字必须是字符串")
  return { type = kind, start = start, _end = finish, text = text, comment = comment }
end
function yield(candidate)
  table.insert(candidates, candidate)
end

local calculator = require "snow.calculator"
local function calculate(expression)
  candidates = {}
  calculator.func("o" .. expression, { start = 0, _end = #expression + 1 }, { prompt = "o" })
  return candidates
end

for _, case in ipairs({
  { "1+2", "3", 5 },
  { "true", "true", 3 },
  { "false", "false", 3 },
  { "string.lower('ABC')", '"abc"', 3 },
  { "range(0,3)", "{0, 1, 2}", 3 },
  { "sin", "callable", 3 },
  { "function() error('不能调用返回的函数') end", "callable", 3 },
  { "1e30", "1e+30", 5 },
  { "1/0", "inf", 3 },
}) do
  local output = calculate(case[1])
  assert(output[2].text == case[2], case[1])
  assert(#output == case[3], case[1])
end
assert(#calculate("0/0") == 3)
assert(calculate("(function() local t={} t[1]=t return t end)()")[2].text == '{"<cycle>"}')
assert(calculate("{1, {true, 'e'}}")[2].text == '{1, {true, "e"}}')
assert(#calculate("1+") == 1)
assert(#calculate("nil+1") == 1)
assert(calculate("sum(map(range(0,3),sin))")[2])
assert(calculate("map(range(0,3),\\x.x+1|)")[2].text == "{1, 2, 3}")
print("✓ 计算器处理数字、布尔值、字符串、数组和函数")

for _, name in ipairs({ "os", "io", "_G", "package", "require", "debug", "load", "loadfile", "dofile", "Candidate", "yield" }) do
  assert(calculate(name .. "==nil")[2].text == "true", name)
  assert(calculate("_ENV['" .. name .. "']==nil")[2].text == "true", name)
end
assert(#calculate("os['difftime'](2,1)") == 1)
assert(#calculate("io['open']('/tmp/snow-test-unavailable')") == 1)
assert(calculate("string.dump==nil")[2].text == "true")
local original_abs = math.abs
calculate("(function() math.abs=nil;review_marker=1;return 0 end)()")
assert(math.abs == original_abs)
assert(calculate("math.abs(-1)")[2].text == "1")
assert(calculate("review_marker==nil")[2].text == "true")
assert(calculate("type(date())")[2].text == '"string"')
assert(calculate("type(time())")[2].text == '"number"')
print("✓ 计算器隔离系统接口、全局状态和各次求值")

Component = {
  Translator = function(engine)
    return {
      owner = engine,
      query = function()
        assert(engine.alive, "不能访问已销毁会话的引擎")
      end,
    }
  end,
}
local table_like = require "snow.table_like"
for _, translator in ipairs({ table_like.t12, table_like.jianpin }) do
  local function environment()
    return { engine = { alive = true, schema = { config = { get_string = function() end } } } }
  end
  local first, second, third = environment(), environment(), environment()
  translator.init(first)
  translator.init(second)
  assert(first.translator ~= second.translator)
  assert(second.translator.owner == second.engine)
  translator.fini(first)
  first.engine.alive = false
  second.translator:query()
  translator.fini(second)
  second.engine.alive = false
  translator.init(third)
  third.translator:query()
  translator.fini(third)
end
print("✓ 两路代理翻译器各自持有当前会话的引擎")

local user_dict = require "snow.user_dict"
local snow = require "snow.snow"
local writes = {}
local segment = { start = 0, _end = 1 }
local fix_key = {}
local fixing = { engine = {
  schema = { config = { get_bool = function() return true end } },
  context = {
    input = "b",
    composition = { toSegmentation = function()
      return { back = function() return segment end }
    end },
    get_property = function() return "" end,
    get_selected_candidate = function() return { text = "测试", comment = "" } end,
    refresh_non_confirmed_composition = function() end,
  },
}, add_input = "", fix_key = fix_key, user_dict = {
  update = function(_, key, value) writes[key] = value end,
} }
local key = { eq = function(_, target) return target == fix_key end }
for _, index in ipairs({ 19, 20, 21 }) do
  segment.selected_index = index - 1
  assert(user_dict.func(key, fixing) == snow.kAccepted)
  assert(next(writes) == nil, "越界固定操作不能写入词典")
end
segment.selected_index = 17
assert(user_dict.func(key, fixing) == snow.kAccepted)
local _, index = snow.decode(snow.parse(writes[snow.key("b", "测试")]))
assert(index == snow.MAX_INDEX)
print("✓ 固定第 18 项可写入，第 19 项起不写入")

local function notifier()
  return { connect = function(_, callback)
    return { callback = callback, disconnect = function() end }
  end }
end
Config = function()
  return { load_from_file = function() return false end }
end
local tick = 100000
rime_api = {
  get_user_data_dir = function() return "/tmp" end,
  get_time_ms = function() tick = tick + 100; return tick end,
}
local context = {
  input = "",
  commit_notifier = notifier(),
  unhandled_key_notifier = notifier(),
  property_update_notifier = notifier(),
  is_composing = function(self) return self.input ~= "" end,
  get_option = function() return false end,
  get_commit_text = function() return "我" end,
}
local env = { engine = {
  context = context,
  schema = { schema_id = "test", config = {
    get_string = function() end,
    get_list = function() end,
  } },
} }
local statistics = require "snow.statistics"
statistics.processor.init(env)
local key = {
  keycode = 97,
  release = function() return false end,
  ctrl = function() return false end,
  alt = function() return false end,
  super = function() return false end,
}
for _ = 1, 1000 do
  context.input = ""
  assert(statistics.processor.func(key, env) == 2)
  context.input = "a"
  statistics.processor.func(key, env)
  env.connection.callback(context)
end
assert(#env.steps == 0)
statistics.processor.fini(env)
print("✓ 统计库不可用时不积累按键")
