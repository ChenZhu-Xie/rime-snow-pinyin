-- 词长直选处理器
-- 四主码阶段按指定类别选择最终候选；保留原生学习、缓冲与上屏统计。

local snow = require "snow.snow"
local vacancy = require "snow.vacancy"

---@class SelectWordLengthEnv: Env
---@field layout string|nil
---@field initial_keys string
---@field auxiliary_keys string
---@field vacancy_translator Translator|nil
---@field vacancy_memory Memory|nil
---@field vacancy_projection Projection|nil
---@field vacancy_cache table<string, boolean>

local processor = {}

---@type table<string, boolean>
local word_types = {
  phrase = true,
  user_phrase = true,
  completion = true,
  table = true,
  user_table = true,
  fixed = true,
  initial_pair = true,
  sanpin_partial = true,
}

---@param input string
---@param segment Segment
---@param env SelectWordLengthEnv
---@return boolean
local function four_main_codes(input, segment, env)
  if env.layout == "21x26" then
    if input:len() < 4 or not env.initial_keys:find(input:sub(1, 1), 1, true)
        or not input:sub(2, 2):match("^[a-z]$")
        or not env.initial_keys:find(input:sub(3, 3), 1, true)
        or not input:sub(4, 4):match("^[a-z]$") then
      return false
    end
    for index = 5, input:len() do
      if not env.auxiliary_keys:find(input:sub(index, index), 1, true) then return false end
    end
    local second_initial = env.initial_keys:find(input:sub(2, 2), 1, true) ~= nil
    -- SBSU 同时承载二字全码与声辅声三／四字词，AU 空桶不再决定入口是否成立。
    if not second_initial then return true end
    if second_initial and env.initial_keys:find(input:sub(4, 4), 1, true) then return true end
    local translator, memory, projection = env.vacancy_translator, env.vacancy_memory, env.vacancy_projection
    if not translator or not memory or not projection then return false end
    -- 与 shenyun 共用系统词典占桶口径；AAA+B 的第四键仍然是三主码的辅码。
    if vacancy.is_empty(input:sub(3, 4), segment, translator, memory, projection, env.vacancy_cache) then
      return false
    end
    return second_initial
        or not vacancy.is_empty(input:sub(1, 2), segment, translator, memory, projection, env.vacancy_cache)
  elseif env.layout ~= "21x21" then
    return false
  end

  -- 兰拼的调辅在 input 末尾，兰道的形辅另存 shape_input；两者都不增加主码数。
  local sound = input:gsub("[avuio]+$", "")
  local count = 0
  local uppercase = false
  for index = 1, sound:len() do
    local char = sound:sub(index, index)
    if env.initial_keys:find(char, 1, true) then
      count = count + 1
      uppercase = false
      if count > 4 then return false end
    elseif char:match("^[A-Z]$") and env.initial_keys:find(char:lower(), 1, true)
        and count > 0 and count < 4 and not uppercase then
      uppercase = true
    else
      return false
    end
  end
  return count == 4
end

---@param menu Menu
---@param segment Segment
---@param four boolean
---@param env SelectWordLengthEnv
---@return integer|nil
local function candidate_index(menu, segment, four, env)
  ---@type integer|nil
  local fallback
  local index = 0
  while menu:prepare(index + 1) > index do
    local candidate = menu:get_candidate_at(index)
    if candidate and candidate._start == segment.start and candidate._end == segment._end
        and candidate.type ~= "sentence" and word_types[candidate:get_genuine().type] then
      local length = utf8.len(candidate.text)
      if four then
        if length == 4 then return index end
      elseif length then
        local primary = env.layout == "21x21" and length >= 5
            or env.layout == "21x26" and length == 3
        if primary then return index end
        local secondary = env.layout == "21x21" and length == 2
            or env.layout == "21x26" and length >= 5
        if secondary and fallback == nil then fallback = index end
      end
    end
    index = index + 1
  end
  return fallback
end

---@param env SelectWordLengthEnv
function processor.init(env)
  local config = env.engine.schema.config
  env.layout = config:get_string("word_length/layout")
  env.initial_keys = config:get_string("speller/initials") or ""
  env.auxiliary_keys = env.layout == "21x26" and "aeuio" or "avuio"
  env.vacancy_cache = {}
  if env.layout == "21x26" then
    env.vacancy_translator = Component.Translator(env.engine, "vacancy", "script_translator")
    env.vacancy_memory = Memory(env.engine, env.engine.schema, "vacancy")
    env.vacancy_projection = Projection(config:get_list("vacancy/canonical_format") or {})
  end
end

---@param key_event KeyEvent
---@param env SelectWordLengthEnv
function processor.func(key_event, env)
  if snow.redispatching or key_event:release()
      or key_event.modifier ~= 0 and key_event.modifier ~= snow.kShift then
    return snow.kNoop
  end
  local code = key_event.keycode
  local shifted = key_event.modifier == snow.kShift
  local four = code == 60 or code == 0x300A or shifted and code == 44
  local other = code == 62 or code == 0x300B or shifted and code == 46
  if not four and not other then return snow.kNoop end

  local context = env.engine.context
  if context:get_option("ascii_mode") then return snow.kNoop end
  local segmentation = context.composition:toSegmentation()
  local segment = segmentation:back()
  if not segment or not segment:has_tag("abc") or context.caret_pos ~= segment._end
      or segment._end ~= context.input:len() then
    return snow.kNoop
  end
  local input = snow.current(context)
  if not input or not four_main_codes(input, segment, env) then return snow.kNoop end

  local menu = segment.menu
  local index = menu and candidate_index(menu, segment, four, env) or nil
  if index ~= nil then
    -- 与空格的 popping 入口一致，避免已确认的缓冲片段阻断原生造词。
    for _, part in ipairs(segmentation:get_segments()) do
      if part.status == snow.kConfirmed then part.status = snow.kSelected end
    end
    local buffered = context:get_option("buffered")
    if context:select(index) and not buffered then context:commit() end
  end
  -- 在有效四主码范围内没有目标词长时，保留输入而不是误选或打出书名号。
  return snow.kAccepted
end

---@param env SelectWordLengthEnv
function processor.fini(env)
  env.vacancy_translator = nil
  env.vacancy_memory = nil
  env.vacancy_projection = nil
  collectgarbage()
end

return processor
