-- 提示过滤器
-- 按 21×21 方案的五辅语义提示简词，并为长简拼候选标注 630 编码。

local snow = require "snow.snow"
local auxiliary_semantics = require "snow.auxiliary_semantics"

local filter = {}

---@class HintEnv: Env
---@field fixed table<string, string>
---@field reverse_630 table<string, string>
---@field shortcut_keys string
---@field shortcut_pattern string
---@field phrase_pattern string

---@param env HintEnv
function filter.init(env)
  local id = env.engine.schema.schema_id
  local semantics = auxiliary_semantics["21x21"]
  local uses_tone = id == "snow_lanpin" or id == "snow_sanpin"
  env.shortcut_keys = uses_tone and semantics.tone_keys_by_tone or semantics.stroke_keys_by_stroke
  local initials = "bpmfdtnlgkhjqxzcsrywe"
  local initial_pattern = "[" .. initials .. "]"
  local shortcut_key_pattern = "[" .. env.shortcut_keys .. "]"
  env.shortcut_pattern = initial_pattern .. shortcut_key_pattern .. "?"
  env.phrase_pattern = initial_pattern .. "{3,}" .. shortcut_key_pattern .. "*"
  env.fixed = snow.table_from_tsv(rime_api.get_user_data_dir() .. ("/%s.fixed.txt"):format(id))
  ---@type table<string, string>
  env.reverse_630 = {}
  for key, value in pairs(env.fixed) do
    if rime_api.regex_match(key, initial_pattern .. shortcut_key_pattern .. "{1,2}") then
      env.reverse_630[value] = key
    end
  end
end

---@param translation Translation
---@param env HintEnv
function filter.func(translation, env)
  local input = snow.current(env.engine.context) or ""
  local shape_input = env.engine.context:get_property("shape_input")
  local full_input = input
  if shape_input then
    full_input = full_input .. shape_input
  end
  local first = true
  if rime_api.regex_match(full_input, env.shortcut_pattern) then
    -- 一码，提示 sb 简词
    for candidate in translation:iter() do
      if first then
        yield(candidate)
        for letter in env.shortcut_keys:gmatch(".") do
          local code = full_input .. letter
          local word = env.fixed[code]
          if word then
            local hint_candidate = Candidate("hint", candidate._start, candidate._end, word, code)
            hint_candidate.preedit = full_input
            yield(hint_candidate)
          end
        end
      else
        yield(candidate)
      end
      first = false
    end
  elseif rime_api.regex_match(full_input, env.phrase_pattern) then
    -- 四码，提示所有简词
    for candidate in translation:iter() do
      if env.reverse_630[candidate.text] then
        local code = env.reverse_630[candidate.text]
        snow.comment(candidate, ("[630: %s]"):format(code))
      end
      yield(candidate)
    end
  else
    -- 其他情况，直接返回
    local segment = env.engine.context.composition:toSegmentation():back()
    local is_not_first_segment = segment and segment.start ~= 0 or false
    for candidate in translation:iter() do
      -- 造词过程中屏蔽二简词
      if is_not_first_segment and candidate:get_dynamic_type() == "Simple" then
        goto continue
      end
      yield(candidate)
      ::continue::
    end
  end
end

---@param segment Segment
---@param env Env
function filter.tags_match(segment, env)
  return segment:has_tag("abc")
end

return filter
