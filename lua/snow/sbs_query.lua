-- 声辅声查询复用
-- 同一声母骨架的补辅和退格复用原生惰性候选流，不重复展开省略音节。

local query = {}

---@class SbsQueryEntry
---@field translation Translation|nil
---@field iterator fun(translation: Translation): Candidate?
---@field rows { candidate: Candidate, comment: string, preedit: string }[]
---@field exhausted boolean
---@field reusable boolean

---@class SbsQueryCache
---@field entries table<string, SbsQueryEntry>
---@field keys string[]

---@return SbsQueryCache
function query.new()
  return { entries = {}, keys = {} }
end

---@param cache SbsQueryCache
function query.clear(cache)
  cache.entries = {}
  cache.keys = {}
end

---@param cache SbsQueryCache
---@param native Translator
---@param proxy string
---@param segment Segment
---@return Translation?, (fun(translation: Translation): Candidate?)?, (fun(candidate: Candidate): Candidate)?
function query.open(cache, native, proxy, segment)
  local key = tostring(segment.start) .. "\t" .. proxy
  local entry = cache.entries[key]
  if not entry or not entry.reusable then
    local translation = native:query(proxy, segment)
    if not translation then return nil end
    entry = { translation = translation, iterator = translation:iter(), rows = {},
      exhausted = false, reusable = true }
    cache.entries[key] = entry
  end
  for index, value in ipairs(cache.keys) do
    if value == key then table.remove(cache.keys, index); break end
  end
  cache.keys[#cache.keys + 1] = key
  -- 只保留最近两个声母骨架（三字及其四字分支），不会按历史输入无限增长。
  while #cache.keys > 2 do cache.entries[table.remove(cache.keys, 1)] = nil end
  local current = entry
  local index = 0
  ---@type { candidate: Candidate, comment: string, preedit: string }|nil
  local pending
  local function next_candidate()
    index = index + 1
    local row = current.rows[index]
    if not row then
      if current.exhausted or not current.translation then return nil end
      local candidate = current.iterator(current.translation)
      if not candidate then
        current.exhausted = true
        return nil
      end
      row = { candidate = candidate, comment = candidate.comment, preedit = candidate.preedit }
      -- 极大词桶继续完整迭代，只停止留存；下一次查询重新打开，不能截断候选。
      if index <= 8192 then current.rows[index] = row else current.reusable = false end
    end
    pending = row
    return row.candidate
  end
  local function copy_candidate(candidate)
    -- 只给真正通过辅码筛选的候选创建 Shadow，拒绝项直接跳过。
    -- comment/preedit 的 Lua setter 会落到 genuine，复用前恢复原生展示字段。
    if pending and pending.candidate == candidate then
      candidate.comment = pending.comment
      candidate.preedit = pending.preedit
    end
    return ShadowCandidate(candidate, candidate.type)
  end
  return current.translation, next_candidate, copy_candidate
end

return query
