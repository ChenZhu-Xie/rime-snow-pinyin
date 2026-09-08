-- 上屏历史翻译器 (History Translator)
-- 记录上屏历史，过滤纯空格与空白，避免空格与退格打断历史，并支持超过 5 条的查询

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

  -- 若初始时 shared_history 为空，尝试从 librime 现有的 commit_history 导入
  if #shared_history == 0 and env.engine.context.commit_history then
    local ok, iter = pcall(function() return env.engine.context.commit_history:iter() end)
    if ok and iter then
      for _, record in iter do
        if record and record.text and record.type ~= "thru" and not record.text:match("^%s+$") then
          table.insert(shared_history, 1, record.text)
        end
      end
    end
  end

  -- 监听上屏提交事件
  env.connection = env.engine.context.commit_notifier:connect(function(ctx)
    local commit_text = ctx:get_commit_text()
    if not commit_text or commit_text == "" then
      return
    end

    -- 过滤纯空白字符（如空格、换行、制表符），防止空格打断/污染上屏历史
    if commit_text:match("^%s+$") then
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

---@param input string
---@param segment Segment
---@param env HistoryEnv
function history.func(input, segment, env)
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

---@param env HistoryEnv
function history.fini(env)
  if env.connection then
    env.connection:disconnect()
    env.connection = nil
  end
end

return history
