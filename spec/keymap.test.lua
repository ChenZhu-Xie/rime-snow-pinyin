package.path = "./lua/?.lua;" .. package.path

local snow = { kNoop = 2, kAccepted = 1, keymap_keys = {}, keymap_helper_launch_time = 0 }
package.preload["snow.snow"] = function() return snow end
rime_api = {
  get_user_data_dir = function() return "C:/Rime Data" end,
  get_distribution_code_name = function() return "Weasel" end,
}

-- 只模拟命令文件协议，不启动 helper，也不改动本机临时目录里的实际命令。
local commands = {}
local launches = 0
local shell_launches = 0
local helper_running = true
local launcher_available = true
local warnings = {}
local original_open = io.open
local original_execute = os.execute
local original_loadlib = package.loadlib
log = { warning = function(message) table.insert(warnings, message) end }
package.loadlib = function(path, symbol)
  assert(path == "C:/Rime Data/lua/snow/bin/snow_keymap_launcher.dll")
  assert(symbol == "snow_keymap_launch")
  if not launcher_available then return nil, "missing test DLL" end
  return function() launches = launches + 1 end
end
io.open = function(path, mode)
  if mode == "wb" then
    return {
      write = function(_, command) table.insert(commands, command) end,
      close = function() end,
    }
  end
  if path:match("%.alive$") and not helper_running then return nil end
  return {
    read = function() return tostring(os.time()) end,
    close = function() end,
  }
end
os.execute = function() shell_launches = shell_launches + 1 end

local function context()
  local properties = {}
  return {
    input = "",
    ascii_mode = false,
    get_option = function(self) return self.ascii_mode end,
    get_property = function(_, key) return properties[key] or "" end,
    set_property = function(_, key, value) properties[key] = value end,
  }
end

local function environment(ctx, schema_id, key)
  return { engine = {
    context = ctx,
    schema = {
      schema_id = schema_id,
      config = { get_string = function(_, path)
        if path == "keymap/key" then return key end
        if path == "keymap/image" then return schema_id .. ".svg" end
      end },
    },
  } }
end

local function key_event(key, modifier, released)
  return {
    keycode = key:byte(),
    modifier = modifier or 0,
    release = function() return released or false end,
  }
end

local keymap = require "snow.keymap"
local editor_context = context()
local editor_env = environment(editor_context, "snow_shenyun_shape", "e")
keymap.init(editor_env)
assert(#commands == 0, "新会话初始化不能覆盖已有键位图")
assert(keymap.func(key_event("e"), editor_env) == snow.kAccepted)
assert(#commands == 1 and commands[1]:match("^toggle\tsnow_shenyun_shape:"))
local requested = commands[1]

-- helper 或其他应用首次获得会话时，初始四拼不能覆盖刚请求的鹤道图。
local other_env = environment(context(), "snow_sipin", "e")
keymap.init(other_env)
assert(#commands == 1 and commands[1] == requested,
  "另一个会话的默认四拼不能抢写当前鹤道图")

-- 同一个 context 切换方案，仍应立即让已显示的图跟随。
local switched_env = environment(editor_context, "snow_sanpin", "v")
keymap.init(switched_env)
assert(#commands == 2 and commands[2]:match("^follow\tsnow_sanpin:"),
  "当前会话切换兰拼时仍须更新浮窗")
assert(launches == 0, "跟随命令和存活 helper 不应启动新进程")

local count = #commands
assert(keymap.func(key_event("v", 0, true), switched_env) == snow.kNoop)
assert(keymap.func(key_event("v", 1), switched_env) == snow.kNoop)
assert(keymap.func(key_event("e"), switched_env) == snow.kNoop)
editor_context.input = "abc"
assert(keymap.func(key_event("v"), switched_env) == snow.kNoop)
editor_context.input = ""
editor_context.ascii_mode = true
assert(keymap.func(key_event("v"), switched_env) == snow.kNoop)
assert(#commands == count, "释放、修饰键、有输入和英文模式均不能改变浮窗")
editor_context.ascii_mode = false
assert(keymap.func(key_event("v"), switched_env) == snow.kAccepted)
assert(commands[#commands]:match("^toggle\tsnow_sanpin:"))

-- 首次启动只调用原生 DLL；心跳尚未建立时，重复按键不能再启动一份。
helper_running = false
assert(keymap.func(key_event("v"), switched_env) == snow.kAccepted)
assert(launches == 1 and shell_launches == 0, "Windows 首次打开不能创建命令行进程")
assert(keymap.func(key_event("v"), switched_env) == snow.kAccepted)
assert(launches == 1, "心跳建立前应限制重复启动")

-- 打包缺失 DLL 时保留正常字母输入，并给出诊断日志。
launcher_available = false
local unavailable = environment(context(), "snow_jiandao", "v")
keymap.init(unavailable)
count = #commands
assert(not unavailable.available)
assert(keymap.func(key_event("v"), unavailable) == snow.kNoop)
assert(#commands == count and #warnings == 1 and warnings[1]:find("missing test DLL", 1, true))

-- Unix 仍沿用后台启动，初始化时也不应加载 Windows DLL。
rime_api.get_user_data_dir = function() return "/home/rime" end
rime_api.get_distribution_code_name = function() return "ibus" end
snow.keymap_helper_launch_time = 0
local linux = environment(context(), "snow_sanpin", "v")
keymap.init(linux)
assert(linux.available and linux.launch_helper == nil)
assert(keymap.func(key_event("v"), linux) == snow.kAccepted)
assert(launches == 1 and shell_launches == 1)

io.open = original_open
os.execute = original_execute
package.loadlib = original_loadlib
print("keymap.test.lua: ok")
