-- 简体模式排序过滤器
--
-- 主词典为了覆盖生僻字读音，保留了少量繁体原字词条。Rime 的 simplifier
-- 在开关关闭时只会原样放行，因此这些词条仍可能混入默认简体候选。这里用
-- t2s 判断候选是否已经是简体，并把繁体原字后置；不删除词条。切到繁体
-- 模式后则保持原序，交回 simplifier 正常转换。

local filter = {}

---@class SimplifiedEnv: Env
---@field converter Opencc?
---@field cache table<string, boolean>

---@param env SimplifiedEnv
function filter.init(env)
  env.converter = Opencc("t2s.json")
  env.cache = {}
end

---@param translation Translation
---@param env SimplifiedEnv
function filter.func(translation, env)
  local traditional = env.engine.context:get_option("traditionalization")
  local postponed = {}
  for candidate in translation:iter() do
    local simplified = env.cache[candidate.text]
    if simplified == nil and env.converter then
      simplified = env.converter:convert_text(candidate.text) == candidate.text
      env.cache[candidate.text] = simplified
    end
    -- 精简测试环境（例如 Mira）可能不附带 OpenCC 的 t2s.json。
    -- 此时保持原序，避免过滤器因初始化失败而吞掉全部候选。
    if traditional or not env.converter or simplified then
      yield(candidate)
    else
      table.insert(postponed, candidate)
    end
  end
  for _, candidate in ipairs(postponed) do
    yield(candidate)
  end
end

function filter.fini(env)
  env.converter = nil
  env.cache = nil
end

return filter
