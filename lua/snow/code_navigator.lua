-- 三拼、键道编码导航处理器
--
-- 这两套方案会把多字词的辅码集中放在编码末尾，Rime 原生的
-- “按音节移动”无法稳定对应到原始输入中的字位。本处理器根据当前候选
-- 的字数还原逻辑字位，并直接设置原始输入的 caret_pos。

local snow = require "snow.snow"

local navigator = {}

local auxiliary_keys = {
  a = true,
  i = true,
  o = true,
  u = true,
  v = true,
}

---@param input string
---@param word_length integer
---@return integer[]
function navigator.logical_positions(input, word_length)
  local input_length = #input
  local positions = {}
  if input_length == 0 or word_length < 1 then
    return positions
  end

  if word_length == 1 then
    return { input_length }
  end

  if word_length == 2 then
    if input_length >= 4 then
      -- 二字全码：A1A1 A2A2 [B2 [B1]]。
      positions[1] = 2
      positions[2] = 4
      if input_length >= 5 then positions[2] = 5 end
      if input_length >= 6 then positions[1] = 6 end
      return positions
    end

    if input_length >= 2 and auxiliary_keys[input:sub(2, 2)] then
      -- 三拼 630：A1 B2 [B1]。
      positions[1] = input_length >= 3 and 3 or 1
      positions[2] = 2
      return positions
    end
  end

  -- 简码无法恢复不存在的字位；已有的每个物理码位仍可作为逻辑落点。
  if input_length < word_length then
    for index = 1, input_length do
      positions[index] = index
    end
    return positions
  end

  -- 三字及以上：A1...An [Bn [B1 [B2]]]。
  for index = 1, word_length do
    positions[index] = index
  end
  local auxiliary_count = math.min(input_length - word_length, 3)
  if auxiliary_count >= 1 then positions[word_length] = word_length + 1 end
  if auxiliary_count >= 2 then positions[1] = word_length + 2 end
  if auxiliary_count >= 3 and word_length >= 2 then positions[2] = word_length + 3 end
  return positions
end

---@param digit string
---@param word_length integer
---@return integer?
function navigator.index_for_digit(digit, word_length)
  local direct = {
    ["1"] = 1,
    ["4"] = 2,
    ["5"] = 3,
    ["6"] = 4,
  }
  local index = direct[digit]
  if index and index <= word_length then
    return index
  end
  return nil
end

---@class CodeNavigatorEnv: Env
---@field left_key KeyEvent
---@field next_key KeyEvent
---@field previous_key KeyEvent
---@field right_key KeyEvent
---@field snapshot_input string?
---@field snapshot_start integer?
---@field snapshot_end integer?
---@field positions integer[]?
---@field logical_index integer?
---@field is_sipin boolean
---@field logical_left_key KeyEvent
---@field logical_right_key KeyEvent

---@param env CodeNavigatorEnv
local function clear_snapshot(env)
  env.snapshot_input = nil
  env.snapshot_start = nil
  env.snapshot_end = nil
  env.positions = nil
  env.logical_index = nil
end

---@param context Context
---@param env CodeNavigatorEnv
---@return boolean
local function prepare_snapshot(context, env)
  if env.snapshot_input == context.input and env.snapshot_start and env.snapshot_end then
    return true
  end

  clear_snapshot(env)
  local segment = context.composition:toSegmentation():back()
  if not segment then return false end

  local start_pos = segment.start
  local end_pos = segment._end
  if end_pos <= start_pos then return false end

  env.snapshot_input = context.input
  env.snapshot_start = start_pos
  env.snapshot_end = end_pos

  local candidate = context:get_selected_candidate()
  if not candidate then return true end
  local word_length = utf8.len(candidate.text)
  if not word_length or word_length < 1 then return true end

  local input = context.input:sub(start_pos + 1, end_pos)
  env.positions = navigator.logical_positions(input, word_length)
  for index, relative_pos in ipairs(env.positions) do
    if start_pos + relative_pos == context.caret_pos then
      env.logical_index = index
      break
    end
  end
  return true
end

---@param context Context
---@param env CodeNavigatorEnv
---@param position integer
local function move_to(context, env, position)
  context.caret_pos = position
  env.logical_index = nil
  if env.positions and env.snapshot_start then
    for index, relative_pos in ipairs(env.positions) do
      if env.snapshot_start + relative_pos == position then
        env.logical_index = index
        break
      end
    end
  end
end

---@param env CodeNavigatorEnv
function navigator.init(env)
  env.left_key = KeyEvent("Control+u")
  env.previous_key = KeyEvent("Control+i")
  env.next_key = KeyEvent("Control+o")
  env.right_key = KeyEvent("Control+p")
  env.logical_left_key = KeyEvent("Shift+Left")
  env.logical_right_key = KeyEvent("Shift+Right")
  env.is_sipin = env.engine.schema.schema_id == "snow_sipin"
  clear_snapshot(env)
end

---@param key KeyEvent
---@param env CodeNavigatorEnv
function navigator.func(key, env)
  local context = env.engine.context
  if key:release() or not context:is_composing() then
    return snow.kNoop
  end

  local is_left = key:eq(env.left_key)
  local is_next = key:eq(env.next_key)
  local is_previous = key:eq(env.previous_key)
  local is_right = key:eq(env.right_key)
  local digit = nil
  if key.modifier == 0 and key.keycode >= 0x30 and key.keycode <= 0x39 then
    digit = string.char(key.keycode)
  end
  local is_direct = not env.is_sipin
      and (digit == "1" or digit == "4" or digit == "5" or digit == "6" or digit == "7")

  if not (is_left or is_next or is_previous or is_right or is_direct) then
    clear_snapshot(env)
    return snow.kNoop
  end
  if is_direct and not context:has_menu() then
    return snow.kNoop
  end
  if not prepare_snapshot(context, env) then
    return snow.kNoop
  end
  if is_direct and #(env.positions or {}) <= 1 then
    -- 单字后的 1 仍交给辅助码处理器作为部首引导键。
    return snow.kNoop
  end

  local start_pos = env.snapshot_start or 0
  local end_pos = env.snapshot_end or #context.input
  if is_left then
    local position = context.caret_pos <= start_pos and end_pos or context.caret_pos - 1
    move_to(context, env, position)
    return snow.kAccepted
  elseif is_right then
    local position = context.caret_pos >= end_pos and start_pos or context.caret_pos + 1
    move_to(context, env, position)
    return snow.kAccepted
  end

  -- 四拼的音节边界由 Rime 的 navigator 精确掌握；转发方向键即可。
  -- 三拼和键道则继续使用下面按候选字数还原的逻辑字位。
  if env.is_sipin then
    env.engine:process_key(is_next and env.logical_right_key or env.logical_left_key)
    return snow.kAccepted
  end

  local positions = env.positions or {}
  if is_direct then
    if digit == "7" then
      move_to(context, env, end_pos)
      return snow.kAccepted
    end
    local index = navigator.index_for_digit(digit, #positions)
    if not index or not positions[index] then
      return snow.kAccepted
    end
    move_to(context, env, start_pos + positions[index])
    return snow.kAccepted
  end

  if #positions == 0 then
    return snow.kAccepted
  end
  local index = env.logical_index
  if not index then
    index = is_next and 0 or 1
  end
  if is_next then
    index = index % #positions + 1
  else
    index = (index - 2) % #positions + 1
  end
  move_to(context, env, start_pos + positions[index])
  return snow.kAccepted
end

return navigator
