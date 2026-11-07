package.path = "./lua/?.lua;" .. package.path

package.preload["snow.snow"] = function()
  return { kNoop = 2, kAccepted = 1 }
end

function KeyEvent(repr)
  local released = repr:sub(1, 8) == "Release+"
  local name = released and repr:sub(9) or repr
  local keycodes = { space = 0x20, Return = 0xff0d, BackSpace = 0xff08, Escape = 0xff1b }
  return {
    keycode = keycodes[name] or (#name == 1 and name:byte() or 0),
    modifier = 0,
    repr = function() return repr end,
    release = function() return released end,
    eq = function(_, other) return repr == other:repr() end,
  }
end

function Schema(schema_id)
  return { schema_id = schema_id }
end

function Candidate(candidate_type, start, finish, text, comment)
  local candidate = {
    type = candidate_type,
    start = start,
    _end = finish,
    text = text,
    comment = comment,
  }
  candidate.get_genuine = function() return candidate end
  return candidate
end

local yielded = {}
function yield(candidate)
  table.insert(yielded, candidate)
end

local menu = require "snow.schema_menu"

local function names(entries)
  local result = {}
  for index, entry in ipairs(entries) do
    result[index] = entry.name
  end
  return table.concat(result, "|")
end

local expected = {
  { "snow_jiandao_classic", "冰雪键道", "21²5⁴ 经典键道 二字词低重" },
  { "snow_sanpin_classic", "冰雪三拼", "21²5ⁿ 经典三拼 单字简繁通打" },
  { "snow_jiandao", "冰雪健道", "21²5⁴ 零飞键道 三四字词低重" },
  { "snow_sanpin", "冰雪弎拼", "21²5ⁿ 零飞三拼 人体工学" },
  { "snow_shenyun_shape", "冰雪简道", "21¹26¹5⁴ 无重键道 没有 630" },
  { "snow_shenyun_tone", "冰雪散拼", "21¹26¹5ⁿ 无重三拼 顶功版廿六" },
  { "snow_sipin", "冰雪四拼", "21¹5ⁿ 动态调频 多音节词王" },
  { "snow_qingyun", "冰雪清韵", "21ᵐ9¹ 四码前缀 多字根字王" },
}

assert(#menu.entries == #expected, "方案数必须为 8")
for index, item in ipairs(expected) do
  local entry = menu.entries[index]
  assert(entry.schema_id == item[1], "schema_id 顺序错误：" .. index)
  assert(entry.name == item[2], "方案名顺序错误：" .. index)
  assert(entry.comment == item[3], "方案说明错误：" .. index)
  assert(#entry.aliases >= 3, "每项必须同时覆盖方案名与描述声母：" .. entry.name)
end

assert(names(menu.filter_entries("")) == names(menu.entries), "空查询必须返回全部方案")
assert(names(menu.filter_entries("jd")) == "冰雪键道|冰雪健道|冰雪简道", "jd 必须保留三个道方案")
assert(names(menu.filter_entries("jdjd")) == "冰雪键道", "jdjd 必须定位经典键道")
assert(names(menu.filter_entries("lfjd")) == "冰雪健道", "lfjd 必须定位零飞键道")
assert(names(menu.filter_entries("wzjd")) == "冰雪简道", "wzjd 必须定位无重键道")
assert(names(menu.filter_entries("bxqy")) == "冰雪清韵", "连续声母必须定位冰雪清韵")
assert(names(menu.filter_entries("jdedc")) == "冰雪键道", "有序子序列必须能够筛选描述")
assert(menu.filter_entries("qqqq")[1] == nil, "无匹配必须返回空列表")

local function notifier()
  local callbacks = {}
  return {
    callbacks = callbacks,
    connect = function(_, callback)
      table.insert(callbacks, callback)
      return { disconnect = function() end }
    end,
  }
end

local selected_candidate = nil
local selected_schema = nil
local confirmed = 0
local context = {
  input = "",
  select_notifier = notifier(),
  clear = function(self) self.input = "" end,
  push_input = function(self, text) self.input = self.input .. text return true end,
  pop_input = function(self, length) self.input = self.input:sub(1, -length - 1) return true end,
  confirm_current_selection = function() confirmed = confirmed + 1 return true end,
  get_selected_candidate = function() return selected_candidate end,
  set_option = function() end,
}
local config = {
  get_string = function(_, path)
    if path == "schema_menu/prefix" then return "~~" end
    if path == "schema_menu/sentinel" then return "'" end
    if path == "schema_menu/tag" then return "schema_menu" end
    return nil
  end,
}
local engine = {
  context = context,
  schema = { schema_id = "snow_jiandao", config = config },
  apply_schema = function(_, schema) selected_schema = schema.schema_id end,
}
local processor_env = { engine = engine }
menu.processor.init(processor_env)

assert(menu.processor.func(KeyEvent("Control+Shift+grave"), processor_env) == 2,
  "Ctrl+Shift+grave 必须交给原生选单")
assert(menu.processor.func(KeyEvent("F4"), processor_env) == 1 and context.input == "~~'",
  "F4 必须打开 Lua 选单")
assert(menu.processor.func(KeyEvent("Control+grave"), processor_env) == 1 and context.input == "",
  "选单内再次按入口必须关闭")
context.input = "ordinary"
assert(menu.processor.func(KeyEvent("Control+grave"), processor_env) == 1 and context.input == "~~'",
  "Ctrl+grave 必须清空未上屏输入并打开选单")
assert(menu.processor.func(KeyEvent("j"), processor_env) == 1 and context.input == "~~'j",
  "菜单激活时必须在 chord_composer 之前直接接收字母")
assert(menu.processor.func(KeyEvent("Release+j"), processor_env) == 1,
  "菜单接收的字母释放事件不得落入 chord_composer")
assert(menu.processor.func(KeyEvent("BackSpace"), processor_env) == 1 and context.input == "~~'",
  "菜单退格必须删除一个查询字母")
assert(menu.processor.func(KeyEvent("space"), processor_env) == 1 and confirmed == 1,
  "菜单空格必须确认当前方案候选")
context.input = "~~'"
assert(menu.processor.func(KeyEvent("Escape"), processor_env) == 1 and context.input == "",
  "Escape 必须关闭 Lua 选单")

local translator_env = { engine = engine }
menu.translator.init(translator_env)
local segment = {
  start = 0,
  _end = 3,
  has_tag = function(_, tag) return tag == "schema_menu" end,
}
yielded = {}
menu.translator.func("jd", segment, translator_env)
assert(#yielded == 3 and yielded[1].text == "冰雪键道" and yielded[3].text == "冰雪简道",
  "翻译器必须按固定顺序筛选三个道方案")
assert(yielded[1].preedit == "jd", "候选预编辑只能显示筛选字母")
yielded = {}
menu.translator.func("qqqq", segment, translator_env)
assert(#yielded == 0, "无匹配时不得回落普通候选")

yielded = {}
menu.translator.func("'", segment, translator_env)
assert(#yielded == #menu.entries, "空查询必须立即显示全部方案")
assert(yielded[1].preedit == "", "空查询不得显示内部菜单前缀")

selected_candidate = Candidate("schema_menu", 0, 3, "冰雪清韵", "")
context.input = "~~'bxqy"
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(selected_schema == "snow_qingyun" and context.input == "",
  "选择候选必须清空菜单并切换方案")

selected_schema = nil
selected_candidate = Candidate("schema_menu", 0, 3, "冰雪健道", "")
context.input = "~~'lfjd"
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(selected_schema == nil and context.input == "", "选择当前方案只能关闭选单")
menu.translator.fini(translator_env)

print("schema_menu.test.lua: ok")
