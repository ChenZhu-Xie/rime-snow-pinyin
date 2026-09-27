-- 简体模式排序过滤器
--
-- 主词典为了覆盖生僻字读音，保留了少量繁体原字词条。Rime 的 simplifier
-- 在开关关闭时只会原样放行，因此这些词条仍可能混入默认简体候选。这里用
-- t2s 判断候选是否已经是简体，并把繁体原字后置；不删除词条。切到繁体
-- 模式后则保持原序，交回 simplifier 正常转换。

local filter = {}

---@class SimplifiedEnv: Env
---@field converter Opencc

---@param env SimplifiedEnv
function filter.init(env)
  env.converter = Opencc("t2s.json")
end

---@param translation Translation
---@param env SimplifiedEnv
function filter.func(translation, env)
  local traditional = env.engine.context:get_option("traditionalization")
  local postponed = {}
  for candidate in translation:iter() do
    if traditional or env.converter:convert_text(candidate.text) == candidate.text then
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
end

return filter
