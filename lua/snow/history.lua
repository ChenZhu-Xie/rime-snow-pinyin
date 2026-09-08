-- 上屏历史翻译器与处理器 (History Translator & Processor)
-- 1. 记录上屏历史，过滤纯空格与空白，避免空格与退格打断历史，并支持超过 5 条（默认 20 条）的查询与多页翻页
-- 2. 在 i 历史列表激活时，支持通过 Alt+2/3/4/5/6 或 Alt+2/3/8/9/0 快速选定对应非首候选（兼顾不同方案，避免占用 i+数字 的原有符号功能）

local snow = require "snow.snow"

local history = {}

-- 模块级共享历史记录，跨方案切换时保持连续性
local shared_history = {}

---@class HistoryEnv: Env
---@field connection Connection
---@field input_key string
---@field max_records integer
---@field size integer
---@field initial_quality number
---@field tag string

---@param env HistoryEnv
function history.init(env)
  local config = env.engine.schema.config
  env.input_key = config:get_string("history/input") or "i"
  env.tag = config:get_string("history/tag") or "history"
  -- 可查询并展示的条数，默认 20 条，可由 history/size 调整
  env.size = config:get_int("history/size") or 20
  -- 内存最大保留记录数，默认 100 条
  env.max_records = config:get_int("history/max_records") or 100
  env.initial_quality = config:get_double("history/initial_quality") or 1000

  -- 监听上屏提交事件
  if not env.connection then
    env.connection = env.engine.context.commit_notifier:connect(function(ctx)
      local commit_text = ctx:get_commit_text()
      if not commit_text or commit_text == "" then
        return
      end

      -- 过滤纯空白字符（如空格、换行、制表符）及查询引导键本身（如 "i"）
      if commit_text:match("^%s+$") or commit_text == env.input_key then
        return
      end

      -- 如果已存在相同历史项，先移除旧位置（MRU: 最近使用的项置顶）
      for i, item in ipairs(shared_history) do
        if item == commit_text then
          table.remove(shared_history, i)
          break
        end
      end

      -- 插入最新记录到队列最前端
      table.insert(shared_history, 1, commit_text)

      -- 超出最大缓存上限时淘汰最旧的一条
      if #shared_history > env.max_records then
        table.remove(shared_history)
      end
    end)
  end
end

--- 作为翻译器：当匹配引导键或 tag 时生成历史候选词
---@param input string
---@param segment Segment
---@param env HistoryEnv
function history.translate(input, segment, env)
  -- 匹配 tag 或对应的引导键
  if not segment:has_tag(env.tag) and input ~= env.input_key then
    return
  end

  local count = 0
  for _, text in ipairs(shared_history) do
    count = count + 1
    local cand = Candidate(env.tag, segment.start, segment._end, text, "")
    -- 递减微小 quality 确保候选顺序严格按照时间倒序
    cand.quality = env.initial_quality - (count * 0.001)
    yield(cand)
    if count >= env.size then
      break
    end
  end
end

--- 作为处理器：在 i 面板激活时拦截 Alt+数字 快捷键进行选词
---@param key KeyEvent
---@param env HistoryEnv
function history.process(key, env)
  local context = env.engine.context
  -- 当且仅当有候选菜单且输入缓冲区为历史引导键时生效
  if not (context:has_menu() and context.input == env.input_key) then
    return snow.kNoop
  end

  -- 忽略释放按键事件
  if key:release() then
    return snow.kNoop
  end

  -- 处理 Ctrl+数字 或 Alt+数字 快捷选词（同时兼容 23456 和 23890 方案，不影响纯数字的 i+数字 符号功能）
  if key:ctrl() or key:alt() then
    local char = ""
    if key.keycode >= 0x30 and key.keycode <= 0x39 then
      char = string.char(key.keycode)
    end
    local repr = key:repr()

    local target_slot = nil
    -- 第 2 候选：2
    if char == "2" or repr:find("2$") then
      target_slot = 1
    -- 第 3 候选：3
    elseif char == "3" or repr:find("3$") then
      target_slot = 2
    -- 第 4 候选：4 (23456方案) 或 8 (23890方案)
    elseif char == "4" or char == "8" or repr:find("4$") or repr:find("8$") then
      target_slot = 3
    -- 第 5 候选：5 (23456方案) 或 9 (23890方案)
    elseif char == "5" or char == "9" or repr:find("5$") or repr:find("9$") then
      target_slot = 4
    -- 第 6 候选：6 (23456方案) 或 0 (23890方案)
    elseif char == "6" or char == "0" or repr:find("6$") or repr:find("0$") then
      target_slot = 5
    end

    if target_slot then
      if context:select(target_slot) then
        return snow.kAccepted
      end
      -- 备选回退：通过 Candidate 直接上屏并清空上下文
      local seg = context.composition:back()
      if seg then
        local cand = seg:get_candidate_at(target_slot)
        if cand then
          env.engine:commit_text(cand.text)
          context:clear()
          return snow.kAccepted
        end
      end
    end
  end

  return snow.kNoop
end

--- 统一入口：根据入参类型自动分发至 translate 或 process
---@param arg1 string | KeyEvent
---@param arg2 Segment | HistoryEnv
---@param arg3? HistoryEnv
function history.func(arg1, arg2, arg3)
  if type(arg1) == "string" then
    return history.translate(arg1, arg2, arg3)
  else
    return history.process(arg1, arg2)
  end
end

---@param env HistoryEnv
function history.fini(env)
  if env.connection then
    env.connection:disconnect()
    env.connection = nil
  end
end

return history
