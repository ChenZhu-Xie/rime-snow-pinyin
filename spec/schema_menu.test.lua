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

local unavailable_schemas = {}
local schema_list = {}
local modes = {}
local default_config = {
  get_list_size = function(_, path)
    assert(path == "schema_list")
    return #schema_list
  end,
  get_string = function(_, path)
    local index = tonumber(path:match("^schema_list/@(%d+)/schema$"))
    return index and schema_list[index + 1].schema or nil
  end,
  get_list = function(_, path)
    local index = tonumber(path:match("^schema_list/@(%d+)/case$"))
    local conditions = index and schema_list[index + 1].case
    if not conditions then return nil end
    return {
      size = #conditions,
      get_value_at = function(_, item) return { value = conditions[item + 1] } end,
    }
  end,
  get_bool = function(_, path) return modes[path] end,
}
function Schema(schema_id)
  if schema_id == ".default" then return { config = default_config } end
  return {
    schema_id = schema_id,
    config = { get_string = function(_, path)
      if path == "schema/schema_id" and not unavailable_schemas[schema_id] then return schema_id end
      return nil
    end },
  }
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
for _, entry in ipairs(menu.entries) do
  table.insert(schema_list, { schema = entry.schema_id })
end

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
  { "snow_jiandao", "冰雪兰道", "21²5⁴ 零飞键道 三四字词低重" },
  { "snow_sanpin", "冰雪兰拼", "21²5ⁿ 零飞三拼 人体工学" },
  { "snow_shenyun_shape", "冰雪鹤道", "21¹26¹5⁴ 无重键道 没有 630" },
  { "snow_shenyun_tone", "冰雪鹤拼", "21¹26¹5ⁿ 无重三拼 顶功版廿六" },
  { "snow_sipin", "冰雪四拼", "21¹5ⁿ 动态调频 多音节词王" },
  { "snow_yipin", "冰雪一拼", "1200ⁿ95ᵐ 顶功并击 带调音节/击" },
  { "snow_qingyun", "冰雪清韵", "21ᵐ9¹ 四码前缀 多字根字王" },
  { "snow_zhudao", "冰雪鹮道", "21¹26¹5⁴ 带调鹤道 最低记忆" },
  { "snow_jiandao_toned", "冰雪莲道", "21²5⁴ 带调兰道 字词均衡" },
}

assert(#menu.entries == #expected, "方案数必须为 11")
for index, item in ipairs(expected) do
  local entry = menu.entries[index]
  assert(entry.schema_id == item[1], "schema_id 顺序错误：" .. index)
  assert(entry.name == item[2], "方案名顺序错误：" .. index)
  assert(entry.comment == item[3], "方案说明错误：" .. index)
  assert(#entry.aliases >= 3, "每项必须同时覆盖方案名与描述声母：" .. entry.name)
end

assert(names(menu.filter_entries("")) == names(menu.entries), "空查询必须返回全部方案")
assert(names(menu.filter_entries("dthd")) == "冰雪鹮道", "dthd 必须定位冰雪鹮道")
assert(names(menu.filter_entries("ddhd")) == "冰雪鹮道", "带调读作 dai diao 时也能定位鹮道")
assert(names(menu.filter_entries("jd")) == "冰雪键道", "jd 必须定位冰雪键道")
assert(names(menu.filter_entries("bxjd")) == "冰雪键道", "全称声母必须定位冰雪键道")
assert(names(menu.filter_entries("dtld")) == "冰雪莲道", "dtld 必须定位带调莲道")
assert(names(menu.filter_entries("ddld")) == "冰雪莲道", "带调读作 dai diao 时也能定位莲道")
assert(names(menu.filter_entries("dtjd")) == "冰雪莲道", "dtjd 必须定位带调莲道")
assert(names(menu.filter_entries("ddjd")) == "冰雪莲道", "带调读作 dai diao 时也能定位莲道")
assert(names(menu.filter_entries("ld")) == "冰雪兰道|冰雪莲道", "ld 必须同时显示兰道和莲道")
assert(names(menu.filter_entries("lp")) == "冰雪兰拼", "lp 必须定位冰雪兰拼")
assert(names(menu.filter_entries("hd")) == "冰雪鹤道|冰雪鹮道", "hd 必须同时显示鹤道和鹮道")
assert(names(menu.filter_entries("hp")) == "冰雪鹤拼", "hp 必须定位冰雪鹤拼")
assert(names(menu.filter_entries("bxld")) == "冰雪兰道|冰雪莲道", "全称声母必须同时显示兰道和莲道")
assert(names(menu.filter_entries("bxlp")) == "冰雪兰拼", "全称声母必须定位冰雪兰拼")
assert(names(menu.filter_entries("bxhd")) == "冰雪鹤道|冰雪鹮道", "全称声母必须同时显示鹤道和鹮道")
assert(names(menu.filter_entries("bxhp")) == "冰雪鹤拼", "全称声母必须定位冰雪鹤拼")
assert(names(menu.filter_entries("jdjd")) == "冰雪键道", "jdjd 必须定位经典键道")
assert(names(menu.filter_entries("lfjd")) == "冰雪兰道", "lfjd 必须定位零飞键道")
assert(names(menu.filter_entries("wzjd")) == "冰雪鹤道", "wzjd 必须定位无重键道")
assert(names(menu.filter_entries("yp")) == "冰雪一拼", "yp 必须定位冰雪一拼")
assert(names(menu.filter_entries("dgbj")) == "冰雪一拼", "描述声母必须定位顶功并击")
assert(names(menu.filter_entries("dtyjj")) == "冰雪一拼", "描述声母必须定位带调音节每击")
assert(names(menu.filter_entries("bxqy")) == "冰雪清韵", "连续声母必须定位冰雪清韵")
assert(names(menu.filter_entries("jdedc")) == "冰雪键道", "有序子序列必须能够筛选描述")
assert(menu.filter_entries("qqqq")[1] == nil, "无匹配必须返回空列表")

local function notifier()
  local callbacks = {}
  return {
    callbacks = callbacks,
    connect = function(_, callback)
      table.insert(callbacks, callback)
      return { disconnect = function()
        for index, connected in ipairs(callbacks) do
          if connected == callback then table.remove(callbacks, index) break end
        end
      end }
    end,
  }
end

local selected_candidate = nil
local selected_schema = nil
local confirmed = 0
local properties = {}
local switch_values = {}
local context = {
  input = "",
  select_notifier = notifier(),
  update_notifier = notifier(),
  clear = function(self)
    self.input = ""
    for _, callback in ipairs(self.update_notifier.callbacks) do callback(self) end
  end,
  push_input = function(self, text) self.input = self.input .. text return true end,
  pop_input = function(self, length) self.input = self.input:sub(1, -length - 1) return true end,
  confirm_current_selection = function() confirmed = confirmed + 1 return true end,
  get_selected_candidate = function() return selected_candidate end,
  set_option = function(_, key, value) switch_values[key] = value end,
  get_option = function(_, key) return switch_values[key] == true end,
  set_property = function(_, key, value) properties[key] = value end,
  get_property = function(_, key) return properties[key] or "" end,
}
local menu_switch_name = "character"
local menu_switch_states = { "字词", "单字" }
local config = {
  get_list_size = function(_, path) return path == "switches" and 1 or 0 end,
  get_list = function(_, path)
    if path == "switches/@0/states" then
      return { size = 2, get_value_at = function(_, index) return { value = menu_switch_states[index + 1] } end }
    end
  end,
  get_string = function(_, path)
    if path == "switches/@0/name" then return menu_switch_name end
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
assert(menu.processor.func(KeyEvent("Control+Shift+asciitilde"), processor_env) == 2,
  "小狼毫将 Shift+grave 转成 asciitilde，必须同样交给原生选单")
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

-- 英文直通会把选单前缀分成 raw；选单期间必须暂停，退出后恢复。
for _, closing_key in ipairs({ "Escape", "Control+grave", "BackSpace" }) do
  switch_values.ascii_mode = true
  context:clear()
  assert(menu.processor.func(KeyEvent("Control+grave"), processor_env) == 1)
  assert(context.input == "~~'" and not context:get_option("ascii_mode"),
    "英文模式打开选单时必须停用英文直通，供原生分段器生成候选")
  assert(menu.processor.func(KeyEvent("l"), processor_env) == 1 and context.input == "~~'l")
  menu.processor.func(KeyEvent("Release+l"), processor_env)
  menu.processor.func(KeyEvent("BackSpace"), processor_env)
  menu.processor.func(KeyEvent(closing_key), processor_env)
  assert(context.input == "" and context:get_option("ascii_mode"),
    "取消选单必须恢复原来的英文模式：" .. closing_key)
end
menu.processor.func(KeyEvent("Control+grave"), processor_env)
context:clear()
assert(context:get_option("ascii_mode"), "外部清空选单也必须恢复英文模式")
switch_values.ascii_mode = false

local segment = {
  start = 0,
  _end = 3,
  has_tag = function(_, tag) return tag == "schema_menu" end,
}
yielded = {}
menu.translator.func("hd", segment, translator_env)
assert(#yielded == 2 and yielded[1].text == "冰雪鹤道" and yielded[2].text == "冰雪鹮道",
  "翻译器必须按新名称声母筛选方案")
assert(yielded[1].preedit == "hd", "候选预编辑只能显示筛选字母")
yielded = {}
menu.translator.func("qqqq", segment, translator_env)
assert(#yielded == 0, "无匹配时不得回落普通候选")

yielded = {}
switch_values.ascii_mode = true
menu.processor.func(KeyEvent("Control+grave"), processor_env)
menu.translator.func("'", segment, translator_env)
assert(#yielded == #menu.entries + 1 and yielded[1].text == "方案选项", "空查询首项必须是方案选项，随后显示全部方案")
assert(yielded[2].preedit == "", "空查询不得显示内部菜单前缀")
selected_candidate = yielded[1]
context.select_notifier.callbacks[1](context)
assert(switch_values._auto_commit == false, "选项入口不能上屏")
context.select_notifier.callbacks[2](context)
assert(properties.snow_menu_options == "1" and context.input == "~~'", "首项进入当前方案选项")
assert(not context:get_option("ascii_mode"), "进入子菜单不得提前恢复英文直通")
yielded = {}
menu.translator.func("'", segment, translator_env)
assert(#yielded == 1 and yielded[1].text == "字词 → 单字", "子菜单必须读取实际方案开关")
selected_candidate = yielded[1]
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(switch_values.character and context.input == "" and properties.snow_menu_options == "", "选择单字应切换选项且不输出文字")
assert(context:get_option("ascii_mode"), "切换普通选项后必须恢复原来的英文模式")

menu_switch_name = "ascii_mode"
menu_switch_states = { "中文", "西文" }
menu.processor.func(KeyEvent("Control+grave"), processor_env)
properties.snow_menu_options = "1"
yielded = {}
menu.translator.func("'", segment, translator_env)
assert(yielded[1].text == "西文 → 中文", "中英选项必须显示进入选单前的真实状态")
selected_candidate = yielded[1]
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(not context:get_option("ascii_mode"), "明确切回中文时不得恢复旧的英文状态")
menu_switch_name = "character"
menu_switch_states = { "字词", "单字" }


switch_values.ascii_mode = true
menu.processor.func(KeyEvent("Control+grave"), processor_env)
selected_candidate = Candidate("schema_menu", 0, 3, "冰雪清韵", "")
context.input = "~~'bxqy"
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(selected_schema == "snow_qingyun" and context.input == "",
  "选择候选必须清空菜单并切换方案")
assert(context:get_option("ascii_mode") and properties.snow_menu_ascii_mode == "",
  "切换方案前必须结束临时模式并清除恢复标记")
switch_values.ascii_mode = false

yielded = {}
menu.translator.func("dtld", segment, translator_env)
assert(#yielded == 1 and yielded[1].text == "冰雪莲道", "带调莲道必须可被筛选")
assert(yielded[1].comment == "21²5⁴ 带调兰道 字词均衡", "已部署莲道必须显示方案说明")
selected_schema = nil
selected_candidate = yielded[1]
context.input = "~~'dtld"
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(selected_schema == "snow_jiandao_toned" and context.input == "",
  "选择冰雪莲道必须切换到实际带调方案")

selected_schema = nil
selected_candidate = Candidate("schema_menu", 0, 3, "冰雪兰道", "")
context.input = "~~'lfjd"
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(selected_schema == nil and context.input == "", "选择当前方案只能关闭选单")
menu.translator.fini(translator_env)
assert(#context.update_notifier.callbacks == 0, "销毁翻译器必须断开模式恢复回调")

-- 源方案在菜单中可见但尚未部署：保留提示，不得切换空 Schema 或上屏方案名。
unavailable_schemas.snow_zhudao = true
local missing_env = { engine = engine }
menu.translator.init(missing_env)
yielded = {}
menu.translator.func("dthd", segment, missing_env)
assert(#yielded == 1 and yielded[1].text == "冰雪鹮道")
assert(yielded[1].comment == "未部署：请加入方案列表后重新部署")
selected_schema = nil
selected_candidate = yielded[1]
context.input = "~~'dthd"
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(selected_schema == nil and context.input == "", "未部署方案不得替换当前有效引擎")
menu.translator.fini(missing_env)

-- 初始化时存在的部署产物若随后失效，选择时仍不能切到空方案。
unavailable_schemas.snow_zhudao = nil
local stale_env = { engine = engine }
menu.translator.init(stale_env)
unavailable_schemas.snow_zhudao = true
selected_schema = nil
selected_candidate = Candidate("schema_menu", 0, 3, "冰雪鹮道", "")
context.input = "~~'dthd"
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(selected_schema == nil and context.input == "", "切换前必须再次检查已编译方案")
menu.translator.fini(stale_env)

-- 用户只启用四拼：其他方案即使有历史编译产物，也必须禁用。
unavailable_schemas.snow_zhudao = nil
schema_list = { { schema = "snow_sipin" } }
local single_env = { engine = engine }
menu.translator.init(single_env)
yielded = {}
menu.translator.func("dthd", segment, single_env)
assert(#yielded == 1 and yielded[1].comment == "未启用：请加入方案列表后重新部署")
selected_schema = nil
selected_candidate = yielded[1]
context.input = "~~'dthd"
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(selected_schema == nil and context.input == "", "旧编译产物不得绕过当前方案列表")
yielded = {}
menu.translator.func("dyjcw", segment, single_env)
assert(#yielded == 1 and yielded[1].text == "冰雪四拼" and yielded[1].comment == expected[7][3])
selected_candidate = yielded[1]
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(selected_schema == "snow_sipin", "当前启用的四拼仍可正常选择")
menu.translator.fini(single_env)

-- 菜单打开后移出列表，必须在确认时再次拦截。
schema_list = { { schema = "snow_zhudao" } }
local removed_env = { engine = engine }
menu.translator.init(removed_env)
schema_list = { { schema = "snow_sipin" } }
selected_schema = nil
selected_candidate = Candidate("schema_menu", 0, 3, "冰雪鹮道", "")
context.input = "~~'dthd"
context.select_notifier.callbacks[1](context)
context.select_notifier.callbacks[2](context)
assert(selected_schema == nil and context.input == "", "确认时不得选择已移出列表的方案")
menu.translator.fini(removed_env)

-- 和原生 switcher 一样尊重 schema_list 的 case 条件。
schema_list = { { schema = "snow_zhudao", case = { "mode/experimental" } } }
local conditional_env = { engine = engine }
menu.translator.init(conditional_env)
assert(not conditional_env.available_schemas.snow_zhudao, "未满足 case 条件的方案不能启用")
menu.translator.fini(conditional_env)
modes["mode/experimental"] = true
menu.translator.init(conditional_env)
assert(conditional_env.available_schemas.snow_zhudao, "满足 case 条件的方案必须可选")
menu.translator.fini(conditional_env)

schema_list = {}
local empty_env = { engine = engine }
menu.translator.init(empty_env)
assert(next(empty_env.available_schemas) == nil, "空列表不能回退到全部旧编译方案")
menu.translator.fini(empty_env)

print("schema_menu.test.lua: ok")
