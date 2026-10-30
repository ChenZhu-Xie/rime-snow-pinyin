-- 模拟码表翻译器
-- 适用于：冰雪三拼、冰雪键道

local snow = require "snow.snow"

---@class TableLikeEnv: Env
---@field translator Translator
---@field pattern string
---@field pattern2 string
---@field preserve_t12_proxy_quality boolean

---@param candidate Candidate
---@param proxy string
---@param preserve_proxy_quality boolean
---@return Candidate
local function prepare(candidate, proxy, preserve_proxy_quality)
  local proxy_bonus = 0
  if preserve_proxy_quality then
    local proxy_segment = proxy:sub(1, candidate._end - candidate._start)
    local real_segment = proxy_segment:gsub("[ ?~]", "")
    local real_input_length = proxy:gsub("[ ?~]", ""):len()
    local filler_length = proxy_segment:len() - real_segment:len()
    if filler_length > 0 and real_input_length > 0 then
      proxy_bonus = filler_length / real_input_length
    end
  end
  candidate = snow.prepare(candidate, proxy)
  candidate.quality = candidate.quality + proxy_bonus
  return candidate
end

---@param proxy string
---@param segment Segment
---@param env TableLikeEnv
---@param preserve_proxy_quality boolean
---@param accept? fun(candidate: Candidate): boolean
local function translate(proxy, segment, env, preserve_proxy_quality, accept)
  -- 代理码不是合法拼写时 query 返回 nil，这一路当作没有候选
  local translation = env.translator:query(proxy, segment)
  if not translation then
    return
  end
  for candidate in translation:iter() do
    candidate = prepare(candidate, proxy, preserve_proxy_quality)
    if not accept or accept(candidate) then
      yield(candidate)
    end
  end
end

local t12 = {}

---@param env TableLikeEnv
function t12.init(env)
  -- 翻译器持有 engine，不能跨会话共享，否则原会话销毁后会访问失效的引擎
  env.translator = Component.Translator(env.engine, "translator", "script_translator")
  env.pattern = env.engine.schema.config:get_string("translator/t1_pattern") or "^.+$"
  env.pattern2 = env.engine.schema.config:get_string("translator/t2_pattern") or "^.+$"
  env.preserve_t12_proxy_quality =
      env.engine.schema.config:get_bool("translator/t12_preserve_proxy_quality") or false
end

---@param input string
---@param segment Segment
---@param env TableLikeEnv
function t12.func(input, segment, env)
  -- 六码二字词选完首字后，剩下「声₂韵₂调₂调₁」。末码已记在首字读音里，
  -- 查第二字时忽略它，确认时一并消耗；原始输入不变，退格仍可撤销首字选择。
  local previous = env.engine.context.composition:toSegmentation():get_at(-2)
  local selected = previous and previous:get_selected_candidate()
  if previous and previous._end == segment.start and selected
      and selected:get_genuine().type == "sanpin_partial" and input:len() == 4 then
    translate(input:sub(1, -2), segment, env, env.preserve_t12_proxy_quality, function(candidate)
      if candidate._end ~= segment._end - 1 then
        return false
      end
      candidate._end = segment._end
      return true
    end)
    return
  end
  -- 一字词与整句模式
  if rime_api.regex_match(input, env.pattern) or not env.engine.context:get_option("popping") then
    translate(input, segment, env, env.preserve_t12_proxy_quality)
    if input:len() == 2 then
      local proxy = ("%s %s"):format(input:sub(1, 1), input:sub(2))
      translate(proxy, segment, env, env.preserve_t12_proxy_quality)
    end
  end
  -- 二字词
  if rime_api.regex_match(input, env.pattern2) then
    local proxy = ("%s %s"):format(input:sub(1, 2), input:sub(3))
    if input:len() == 6 then
      proxy = ("%s%s %s"):format(input:sub(1, 2), input:sub(-1, -1), input:sub(3, -2))
    end
    translate(proxy, segment, env, env.preserve_t12_proxy_quality, function(candidate)
      local length = utf8.len(candidate.text)
      if length == 1 and input:len() == 6 and candidate._end == segment.start + 3 then
        -- 首字只消耗连续的声韵两码，其声调仍留在原始输入的末尾。
        candidate._end = segment.start + 2
        candidate.type = "sanpin_partial"
        candidate.preedit = input:sub(1, 2) .. " "
      end
      return length <= 2
    end)
  end
end

---@param env TableLikeEnv
function t12.fini(env)
  env.translator = nil
  collectgarbage()
end

local jianpin = {}

---@param env TableLikeEnv
function jianpin.init(env)
  env.translator = Component.Translator(env.engine, "jianpin", "script_translator")
  env.pattern = env.engine.schema.config:get_string("translator/jianpin_pattern") or "^.+$"
end

---@param input string
---@param segment Segment
---@param env TableLikeEnv
function jianpin.func(input, segment, env)
  if not rime_api.regex_match(input, env.pattern) then
    return
  end
  local tones = input:match("[ivuao]+$") or ""
  local sound_input = tones == "" and input or input:sub(1, -tones:len() - 1)
  ---@type string[]
  local groups = {}
  for group in sound_input:gmatch("[bpmfdtnlgkhjqxzcsrywe][A-Z]?") do
    table.insert(groups, group)
  end
  local initial_count = #groups
  -- 后置声调依次分配给最后、第一、第二个音节
  for i, group in ipairs(groups) do
    local tone = i == initial_count and tones:sub(1, 1) or tones:sub(i + 1, i + 1)
    groups[i] = group .. (tone ~= "" and "?" .. tone or "")
  end
  local proxy = table.concat(groups)
  translate(proxy, segment, env, false, function(candidate)
    return utf8.len(candidate.text) >= initial_count and candidate.type ~= "sentence"
  end)
end

---@param env TableLikeEnv
function jianpin.fini(env)
  env.translator = nil
  collectgarbage()
end

local initial_pair = {}

---@param env TableLikeEnv
function initial_pair.init(env)
  env.translator = Component.Translator(env.engine, "jianpin", "script_translator")
  env.pattern = env.engine.schema.config:get_string("translator/vacant_initial_pattern") or "^$"
end

---@param input string
---@param segment Segment
---@param env TableLikeEnv
function initial_pair.func(input, segment, env)
  if not rime_api.regex_match(input, env.pattern) then
    return
  end
  translate(input, segment, env, false, function(candidate)
    if utf8.len(candidate.text) ~= 2 or candidate.type == "sentence" then
      return false
    end
    candidate.type = "initial_pair"
    return true
  end)
end

---@param env TableLikeEnv
function initial_pair.fini(env)
  env.translator = nil
  collectgarbage()
end

return {
  t12 = t12,
  jianpin = jianpin,
  initial_pair = initial_pair,
}
