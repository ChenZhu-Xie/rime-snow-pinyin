-- 声声二字词辅码
-- 标准二字词辅序反向，每字连续取前两辅；缺码时停止，不挪用另一字补位。

local auxiliary_hint = require "snow.auxiliary_hint"

local initial_pair_aux = {}

--- 声声短路径不占用可由单字加尾字键构造的二字词。
---@param text string
---@return boolean
function initial_pair_aux.is_composable(text)
  if utf8.len(text) ~= 2 then return false end
  local last = text:sub(utf8.offset(text, -1))
  return last == "的" or last == "了" or last == "是"
end

---@param standard_order string
---@return integer[]
function initial_pair_aux.positions(standard_order)
  assert(standard_order == "12" or standard_order == "21", "二字词辅序必须为 12 或 21")
  return { standard_order:byte(1) - 48, standard_order:byte(2) - 48 }
end

---@param options string[][]
---@param standard_order string
---@return string[]
function initial_pair_aux.codes(options, standard_order)
  local positions = initial_pair_aux.positions(standard_order)
  local codes = { "" }
  for index = 2, 1, -1 do
    local position = positions[index]
    local expanded = {}
    for _, prefix in ipairs(codes) do
      -- 已缺少上一字的第二辅时，不继续拼接下一字，保持两码一字的边界。
      if prefix:len() < (2 - index) * 2 then
        table.insert(expanded, prefix)
      else
        for _, code in ipairs(options[position] or { "" }) do
          table.insert(expanded, prefix .. code:sub(1, 2))
        end
      end
    end
    codes = expanded
  end
  return codes
end

---@param codes string[]
---@param suffix string
---@param mode string
---@param standard_order string
---@return boolean, string, string
function initial_pair_aux.match(codes, suffix, mode, standard_order)
  local matched = false
  for _, code in ipairs(codes) do
    if code:sub(1, suffix:len()) == suffix then
      matched = true
      break
    end
  end
  local label = mode == "tone" and "调笔" or "形"
  local prompt = suffix ~= "" and (" %s[%s]"):format(label, suffix) or ""
  -- 稀疏四辅筛选会排除整桶中的多数词；它们无需生成后续提示和字位下标。
  if not matched then return false, prompt, "" end
  local next_codes = auxiliary_hint.next_codes(codes, suffix)
  local order = standard_order:reverse():gsub("(.)", "%1%1")
      :gsub("1", "₁"):gsub("2", "₂")
  local comment = next_codes ~= "" and ("〔%s%s %s〕"):format(label, order, next_codes) or ""
  return matched, prompt, comment
end

return initial_pair_aux
