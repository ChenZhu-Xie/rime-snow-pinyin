-- 声辅声路由
-- 第二字首辅嵌入第二键，三字词按 2123、四字词按 214 取辅。

local sbs = {}

---@param length integer
---@return integer[]
function sbs.positions(length)
  return length == 3 and { 2, 1, 2, 3 } or { 2, 1, 4 }
end

---@param input string
---@param initial_keys string
---@param auxiliary_keys string
---@return integer?, string?, string?
function sbs.route(input, initial_keys, auxiliary_keys)
  if #input < 3 or #input > 6
      or not initial_keys:find(input:sub(1, 1), 1, true)
      or not auxiliary_keys:find(input:sub(2, 2), 1, true)
      or not initial_keys:find(input:sub(3, 3), 1, true) then return nil end
  local length = 3
  local start = 4
  if #input >= 4 and initial_keys:find(input:sub(4, 4), 1, true) then
    length = 4
    start = 5
  end
  for index = start, #input do
    if not auxiliary_keys:find(input:sub(index, index), 1, true) then return nil end
  end
  local proxy = input:sub(1, 1):upper() .. "?" .. input:sub(3, length == 4 and 4 or 3):upper()
  return length, proxy, input:sub(2, 2) .. input:sub(start)
end

---@param options string[][]
---@param length integer
---@return string[]
function sbs.codes(options, length)
  -- 先固定各字完整辅码，重复字位必须继续同一条笔顺，不能拼接两种字形。
  ---@type string[][]
  local combinations = { {} }
  for position = 1, length do
    ---@type string[][]
    local expanded = {}
    for _, prefix in ipairs(combinations) do
      for _, code in ipairs(options[position] or { "" }) do
        ---@type string[]
        local value = { table.unpack(prefix) }
        value[position] = code
        table.insert(expanded, value)
      end
    end
    combinations = expanded
  end
  ---@type string[]
  local result = {}
  ---@type table<string, boolean>
  local seen = {}
  for _, combination in ipairs(combinations) do
    ---@type table<integer, integer>
    local used = {}
    local code = ""
    for _, position in ipairs(sbs.positions(length)) do
      used[position] = (used[position] or 0) + 1
      local key = combination[position]:sub(used[position], used[position])
      if key == "" then break end -- 缺辅即停止，不能挪用下一字补位。
      code = code .. key
    end
    if code ~= "" and not seen[code] then
      seen[code] = true
      table.insert(result, code)
    end
  end
  return result
end

return sbs
