-- 声声空桶提示过滤器
-- 一级固顶候选之后逐桶提示二字词，再保留原生单字的频率顺序。

local snow = require "snow.snow"
local hints = require "snow.shenyun_hints"

---@class ShenyunHintEnv: Env
---@field hints table<string, ShenyunHint[]>
---@field initial_keys string
---@field fixed table<string, string[]>

local filter = {}

---@param env ShenyunHintEnv
function filter.init(env)
  env.hints = hints[env.engine.schema.schema_id] or {}
  env.initial_keys = env.engine.schema.config:get_string("translator/shenyun_initial_keys") or ""
  env.fixed = snow.read_dictionary(snow.get_dictionary_path(env))
end

---@param segment Segment
---@param env ShenyunHintEnv
function filter.tags_match(segment, env)
  local input = snow.current(env.engine.context) or ""
  local shape_input = env.engine.context:get_property("shape_input") or ""
  return segment:has_tag("abc") and input:len() == 1 and shape_input == ""
      and env.initial_keys:find(input, 1, true) ~= nil
end

---@param translation Translation
---@param env ShenyunHintEnv
function filter.func(translation, env)
  local input = snow.current(env.engine.context) or ""
  -- 数字别名属于一级固顶前缀，不能被空桶提示插到后面。
  local fixed_count = math.max(#(env.fixed[input] or {}), 1)
  local index = 0
  for candidate in translation:iter() do
    yield(candidate)
    index = index + 1
    if index == fixed_count then
      for _, hint in ipairs(env.hints[input] or {}) do
        local completion = Candidate("hint", candidate._start, candidate._end, hint.text, hint.code)
        completion.preedit = input
        yield(completion)
      end
    end
  end
end

return filter
