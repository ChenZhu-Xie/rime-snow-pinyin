-- 并击顶功处理器
-- 由于 Rime chord_composer 的特殊性，不能复用串击的顶功处理器

local snow = require "snow.snow"

local processor = {}

---@class ComboPoppingEnv: Env
---@field active boolean
---@field buffer_command boolean
---@field option_connection Connection
---@field commit_connection Connection

---@param env ComboPoppingEnv
function processor.init(env)
  env.active = true
  env.buffer_command = false
  local context = env.engine.context
  env.option_connection = context.option_update_notifier:connect(function(ctx, name)
    if name == "buffered" then
      ctx:set_option("_auto_commit", not ctx:get_option("buffered"))
    end
  end)
  env.commit_connection = context.commit_notifier:connect(function(ctx)
    if ctx:get_option("buffered") then
      ctx:set_option("buffered", false)
    end
  end)
end

---@param key_event KeyEvent
---@param env ComboPoppingEnv
function processor.func(key_event, env)
  local incoming = utf8.char(key_event.keycode)
  local context = env.engine.context
  local buffered = context:get_option("buffered")
  if key_event:release() or key_event:alt() or key_event:ctrl() or key_event:caps() then
    return snow.kNoop
  end
  -- 取出输入中当前正在翻译的一部分
  local input = snow.current(context) or ""
  -- 左手一简并击本来就以 o 为内部顶功标记；jio 先输出 ~ 作区分，再把后续 o 交给翻译器。
  if input == "" and incoming == "~" then
    env.buffer_command = true
    return snow.kAccepted
  elseif env.buffer_command and not key_event:release() then
    env.buffer_command = false
    if input == "" and incoming == "o" and not key_event:alt() and not key_event:ctrl() then
      return snow.kNoop
    end
  end
  if rime_api.regex_match(input, "([bpmfdtnlgkhzcsr]j?[iuv]?(a|ai|an|ang|ao|e|ei|en|eng|ou)?[wyxq])*") then
    if incoming == "u" then -- 在完整音节后面出现 u，表示追加
      env.active = false
      return snow.kAccepted
    elseif incoming == "i" or incoming == "o" then -- 在完整音节后面出现 i，表示标点符号
      -- 这是下一组并击的第一个合成按键，输入统计已经把这组并击记下了，要转给下一个词
      snow.handover = 1
      context:confirm_current_selection()
      if not buffered then
        context:commit()
      end
      snow.handover = nil
      return incoming == "i" and snow.kNoop or snow.kAccepted
    elseif rime_api.regex_match(incoming, "[a-z]") then
      if env.active and context:get_option("popping") then
        snow.handover = 1
        context:confirm_current_selection()
        if not buffered then
          context:commit()
        end
        snow.handover = nil
      else
        env.active = true
      end
    end
    return snow.kNoop
  else
    return snow.kNoop
  end
end

---@param env ComboPoppingEnv
function processor.fini(env)
  env.option_connection:disconnect()
  env.commit_connection:disconnect()
end

return processor
