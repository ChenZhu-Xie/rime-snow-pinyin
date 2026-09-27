-- 占位音节与已确认伪词过滤器。
--
-- 占位音节来自 snow_pinyin.dict.yaml，只用于让代数规则覆盖扩展拼音，
-- 不应暴露给用户。不同 librime/librime-lua 版本可能把它们包装成不同的
-- Candidate 动态类型，因此这里不能依赖 Phrase 类型判断。

local filter = {}

local rejected_text = {
  ["四但"] = true,
  ["人从"] = true,
}

---@param env Env
function filter.init(env)
end

---@param translation Translation
---@param env Env
function filter.func(translation, env)
  for candidate in translation:iter() do
    local text = candidate.text
    local is_placeholder = rime_api.regex_match(text, "^\\([a-z]+[0-9?]*\\)$")
    if is_placeholder or rejected_text[text] then
      goto continue
    end
    yield(candidate)
    ::continue::
  end
end

return filter
