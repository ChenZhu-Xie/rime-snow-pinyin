-- 单字短部件补码
-- 与星空键道单字码表一致：不足四辅时重复一次末码，不影响词语取辅。
local completion = {}

---@param code string
---@return string
function completion.single(code)
  if #code > 0 and #code < 4 then return code .. code:sub(-1) end
  return code
end

return completion
