-- 键位图显隐处理器
-- 桌面端以空闲的单字母键切换常驻键位图窗口，切换方案时让已显示的窗口跟随更新；移动端由输入法皮肤提供键位图页。

local snow = require "snow.snow"

---@class KeymapEnv: Env
---@field keycode integer
---@field image_path string
---@field command_path string
---@field alive_path string
---@field helper_path string
---@field platform string
---@field available boolean
---@field serial integer

local processor = {}
local HELPER_ALIVE_SECONDS = 15
local HELPER_RETRY_SECONDS = 5

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

---@param value string
---@return string
local function shell_quote(value)
  return "'" .. value:gsub("'", "'\\''") .. "'"
end

---@param env KeymapEnv
---@return boolean
local function helper_alive(env)
  local alive = io.open(env.alive_path, "rb")
  if not alive then return false end
  local timestamp = tonumber(alive:read("*a"))
  alive:close()
  if not timestamp then return false end
  local now = os.time()
  return timestamp >= now - HELPER_ALIVE_SECONDS and timestamp <= now + HELPER_ALIVE_SECONDS
end

---@param user_dir string
---@return string, string
local function desktop_helper(user_dir)
  local code_name = rime_api.get_distribution_code_name():lower()
  local windows_path = user_dir:match("^%a:[/\\]") or user_dir:sub(1, 2) == "\\\\"
  if windows_path or code_name:find("weasel", 1, true) then
    return "windows", "snow-keymap-windows.exe"
  elseif code_name:find("squirrel", 1, true) then
    return "macos", "snow-keymap-macos"
  elseif code_name:find("fcitx", 1, true) or code_name:find("ibus", 1, true) then
    return "linux", "snow-keymap-linux"
  end
  return "", ""
end

---@param env KeymapEnv
local function launch(env)
  local command
  if env.platform == "windows" then
    command = table.concat({
      "start", '""', "/b", command_quote(env.helper_path),
      "--command-file", command_quote(env.command_path),
    }, " ")
  else
    command = table.concat({
      shell_quote(env.helper_path), "--command-file", shell_quote(env.command_path),
      ">/dev/null", "2>&1", "&",
    }, " ")
  end
  os.execute(command)
  snow.keymap_helper_launch_time = os.time()
end

---@param env KeymapEnv
---@param action "follow"|"toggle"
---@return boolean
local function write_command(env, action)
  env.serial = env.serial + 1
  local command = io.open(env.command_path, "wb")
  if not command then return false end
  command:write(("%s\t%s:%.6f:%d\t%s"):format(
    action, env.engine.schema.schema_id, os.clock(), env.serial, env.image_path))
  command:close()
  return true
end

---@param env KeymapEnv
function processor.init(env)
  local key = env.engine.schema.config:get_string("keymap/key") or ""
  local image = env.engine.schema.config:get_string("keymap/image") or ""
  env.keycode = key:len() == 1 and key:byte() or 0
  env.serial = 0
  env.available = false
  env.helper_path = ""
  env.image_path = ""
  env.command_path = ""
  env.alive_path = ""
  env.platform = ""
  local user_dir = rime_api.get_user_data_dir()
  local helper_name
  env.platform, helper_name = desktop_helper(user_dir)
  if env.platform == "" or env.keycode == 0 or image == "" then return end
  env.helper_path = user_dir .. "/lua/snow/bin/" .. helper_name
  env.image_path = user_dir .. "/lua/snow/keymaps/" .. image
  local temporary = os.getenv("TEMP") or os.getenv("TMPDIR") or os.getenv("TMP") or user_dir
  local user_suffix = ""
  if env.platform ~= "windows" then
    user_suffix = "-" .. (os.getenv("USER") or "user"):gsub("[^%w_.-]", "_")
  end
  env.command_path = temporary .. "/snow-pinyin-keymap-v2" .. user_suffix .. ".command"
  env.alive_path = env.command_path .. ".alive"
  env.available = exists(env.helper_path) and exists(env.image_path)
  snow.keymap_keys[env.engine.schema.schema_id] = env.available and env.keycode or nil
  if env.available then
    write_command(env, "follow")
  end
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
  if not write_command(env, "toggle") then return snow.kNoop end
  if not helper_alive(env)
      and os.time() - snow.keymap_helper_launch_time >= HELPER_RETRY_SECONDS then
    launch(env)
  end
  return snow.kAccepted
end

return processor
