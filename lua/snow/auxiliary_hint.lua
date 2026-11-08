-- 辅码提示与预编辑格式
-- 提供不依赖 Rime 对象的增量提示和分音节显示。

local auxiliary_hint = {}

---@param codes string[]
---@param suffix string
---@param maximum_length? integer
---@return string
function auxiliary_hint.next_codes(codes, suffix, maximum_length)
  local next_codes = {}
  local seen = {}
  local next_index = suffix:len() + 1
  local last_index = next_index + (maximum_length or 2) - 1
  for _, code in ipairs(codes) do
    if code:sub(1, suffix:len()) == suffix then
      local next_code = code:sub(next_index, last_index)
      if next_code ~= "" and not seen[next_code] then
        seen[next_code] = true
        table.insert(next_codes, next_code)
      end
    end
  end
  return table.concat(next_codes, "/")
end

---@param proxy string
---@return string[]
local function proxy_groups(proxy)
  local groups = {}
  for group in proxy:gmatch("[^ ]+") do
    table.insert(groups, (group:gsub("[?~]", "")))
  end
  return groups
end

---@param proxy string
---@param suffix string
---@param mode string
---@param positions integer[]
---@return string
function auxiliary_hint.format_preedit(proxy, suffix, mode, positions)
  local groups = proxy_groups(proxy)
  if #groups == 0 then return proxy end
  if suffix == "" then return table.concat(groups, " ") end
  if mode == "shape" then
    return table.concat(groups, " ") .. " 形[" .. suffix .. "]"
  end
  local attached = math.min(suffix:len(), #positions)
  for index = 1, attached do
    local position = positions[index]
    if groups[position] then
      groups[position] = groups[position] .. suffix:sub(index, index)
    end
  end
  local preedit = table.concat(groups, " ")
  if attached < suffix:len() then
    preedit = preedit .. " 笔[" .. suffix:sub(attached + 1) .. "]"
  end
  return preedit
end

return auxiliary_hint
