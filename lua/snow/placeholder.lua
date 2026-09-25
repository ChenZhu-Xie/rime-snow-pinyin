local snow = require "snow.snow"
-- 占位音节过滤器

local filter = {}

---@param env Env
function filter.init(env)
end

---@param translation Translation
---@param env Env
function filter.func(translation, env)
  for candidate in translation:iter() do
    local is_phrase = candidate:get_dynamic_type() == "Phrase"
    local is_placeholder = rime_api.regex_match(candidate.text, "^\\([a-z]+\\d\\)$")
    if is_phrase and is_placeholder then
      goto continue
    end
    yield(candidate)
    ::continue::
  end
end

return filter
