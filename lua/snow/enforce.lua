-- 组词规则过滤器

local snow = require "snow.snow"

local filter = {}

---@class EnforceEnv: Env
---@field vacant_initial_pattern string

---@param env EnforceEnv
function filter.init(env)
  env.vacant_initial_pattern =
      env.engine.schema.config:get_string("translator/vacant_initial_pattern") or "^$"
end

---@param translation Translation
---@param env EnforceEnv
function filter.func(translation, env)
  local input = snow.current(env.engine.context) or ""
  local shape_input = env.engine.context:get_property("shape_input")
  local full_input = input
  if shape_input then
    full_input = full_input .. shape_input
  end
  local jianpin = input:gsub("([a-z][A-Z]?)", "%1 "):sub(1, -2)
  local shuangpin = input:gsub("(..)", "%1 "):sub(1, -2)
  -- 整句模式下，不允许简拼组词，其余都可以接受
  if not env.engine.context:get_option("popping") then
    for candidate in translation:iter() do
      local is_sentence = candidate:get_dynamic_type() == "Sentence"
      if is_sentence and candidate.preedit == jianpin then
        goto continue
      end
      yield(candidate)
      ::continue::
    end
    return
  end
  for candidate in translation:iter() do
    local is_phrase = candidate:get_dynamic_type() == "Phrase" or candidate:get_dynamic_type() == "Sentence"
    local is_normal_spelling = false
    local preedit = rime_api.regex_replace(candidate.preedit, " 形.+$", "")
    local is_character = utf8.len(candidate.text) == 1 and preedit:len() == 2
    if rime_api.regex_match(input, env.vacant_initial_pattern) and utf8.len(candidate.text) == 2 then
      -- 天然空音码的 AA 表示两个声母，后续一码仅用于筛选。
      is_normal_spelling = candidate.type == "initial_pair" or preedit == jianpin
    elseif input:find("[A-Z]") then
      -- 大写韵母与前一个声母构成同一音节，仅用于三字及以上词
      is_normal_spelling = preedit == jianpin and utf8.len(candidate.text) >= 3
    elseif rime_api.regex_match(full_input, "[bpmfdtnlgkhjqxzcsrywe]{2}[vioua]*") then
      -- 两码时一定是双拼
      is_normal_spelling = preedit == shuangpin
    elseif rime_api.regex_match(full_input, "[bpmfdtnlgkhjqxzcsrywe]{4}[vioua]*") then
      -- 四码时可能是双拼，也可能是简拼
      is_normal_spelling = preedit == jianpin or preedit == shuangpin or is_character
    else
      -- 其他情况是简拼
      is_normal_spelling = preedit == jianpin
    end
    if not is_phrase or is_normal_spelling then
      yield(candidate)
    end
  end
end

---@param segment Segment
---@param env Env
function filter.tags_match(segment, env)
  return segment:has_tag("abc")
end

return filter
