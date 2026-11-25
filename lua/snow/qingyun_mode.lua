-- 清韵单字模式处理器
-- 菜单切换设置持续模式，Shift+Tab 临时切换并在上屏后恢复。

local snow = require "snow.snow"

---@class QingyunModeEnv: Env
---@field character_default boolean
---@field internal_change boolean
---@field temporary_key KeyEvent
---@field option_connection Connection
---@field commit_connection Connection

local processor = {}

---@param env QingyunModeEnv
function processor.init(env)
  local context = env.engine.context
  env.character_default = context:get_option("character")
  env.internal_change = false
  env.temporary_key = KeyEvent("Shift+Tab")
  env.option_connection = context.option_update_notifier:connect(function(ctx, name)
    if name == "character" and not env.internal_change then
      env.character_default = ctx:get_option("character")
    end
  end)
  env.commit_connection = context.commit_notifier:connect(function(ctx)
    env.internal_change = true
    ctx:set_option("character", env.character_default)
    env.internal_change = false
  end)
end

---@param key_event KeyEvent
---@param env QingyunModeEnv
function processor.func(key_event, env)
  local context = env.engine.context
  if not key_event:release() and key_event:eq(env.temporary_key) and context:has_menu() then
    env.internal_change = true
    context:set_option("character", not context:get_option("character"))
    env.internal_change = false
    return snow.kAccepted
  end
  return snow.kNoop
end

---@param env QingyunModeEnv
function processor.fini(env)
  env.option_connection:disconnect()
  env.commit_connection:disconnect()
end

return processor
