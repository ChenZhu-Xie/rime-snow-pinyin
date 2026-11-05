-- 键位图显隐处理器
-- Windows 下以空闲的单字母键切换常驻键位图窗口，其他平台保持原按键行为。

local snow = require "snow.snow"

---@class KeymapEnv: Env
---@field keycode integer
---@field image_path string
---@field command_path string
---@field helper_path string
---@field available boolean
---@field launched boolean
---@field serial integer

local processor = {}

---@param path string
---@return boolean
local function exists(path)
  local file = io.open(path, "rb")
  if not file then return false end
  file:close()
  return true
end

---@param value string
---@return string
local function command_quote(value)
  return '"' .. value:gsub('"', '""') .. '"'
end

---@param env KeymapEnv
local function launch(env)
  local command = table.concat({
    "start", '""', "/b", "powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive",
    "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File",
    command_quote(env.helper_path), "-CommandFile", command_quote(env.command_path),
  }, " ")
  os.execute(command)
  env.launched = true
end

---@param env KeymapEnv
function processor.init(env)
  local key = env.engine.schema.config:get_string("keymap/key") or ""
  local image = env.engine.schema.config:get_string("keymap/image") or ""
  env.keycode = key:len() == 1 and key:byte() or 0
  env.serial = 0
  env.launched = false
  env.available = false
  env.helper_path = ""
  env.image_path = ""
  env.command_path = ""
  local user_dir = rime_api.get_user_data_dir()
  local windows_path = user_dir:match("^%a:[/\\]") or user_dir:sub(1, 2) == "\\\\"
  if not windows_path or env.keycode == 0 or image == "" then return end
  env.helper_path = user_dir .. "/lua/snow/keymap-window.ps1"
  env.image_path = user_dir .. "/lua/snow/keymaps/" .. image
  local temporary = os.getenv("TEMP") or os.getenv("TMP") or user_dir
  env.command_path = temporary .. "/snow-pinyin-keymap.command"
  env.available = exists(env.helper_path) and exists(env.image_path)
  snow.keymap_keys[env.engine.schema.schema_id] = env.available and env.keycode or nil
end

---@param key_event KeyEvent
---@param env KeymapEnv
function processor.func(key_event, env)
  if not env.available or key_event:release() or key_event.modifier ~= 0
      or key_event.keycode ~= env.keycode then
    return snow.kNoop
  end
  local context = env.engine.context
  if context:get_option("ascii_mode") or context.input ~= "" then return snow.kNoop end
  env.serial = env.serial + 1
  local command = io.open(env.command_path, "wb")
  if not command then return snow.kNoop end
  command:write(("%s:%.6f:%d\t%s"):format(
    env.engine.schema.schema_id, os.clock(), env.serial, env.image_path))
  command:close()
  if not env.launched then launch(env) end
  return snow.kAccepted
end

return processor
