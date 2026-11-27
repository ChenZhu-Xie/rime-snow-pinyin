-- 单音节的「×是」自适应上屏。通过当前引擎试查标准词码，复用完整过滤链。
local snow = require "snow.snow"
local priority = require "snow.candidate_priority"
local fix = require "snow.fix"

local append = {}

---@class AppendShiRoute
---@field code string
---@field readings table<string, boolean>
---@field system boolean

---@class AppendShiEnv: Env
---@field shi_routes table<string, AppendShiRoute[]>|nil
---@field shi_memory Memory|nil
---@field shi_pinyin ReverseLookup|nil
---@field shi_fixed FixEnv|nil
---@field shi_profile_remaining integer|nil

---@param env AppendShiEnv
local function load_routes(env)
  env.shi_profile_remaining = os.getenv("SNOW_APPEND_PROFILE") == "1" and 2 or 0
  env.shi_routes = {}
  local path = rime_api.get_user_data_dir() .. "/lua/snow/append_shi_" .. env.engine.schema.schema_id .. ".txt"
  local file = io.open(path, "r")
  if not file then return end
  for line in file:lines() do
    local input, code, readings, system = line:match("^([^#\t]+)\t([^\t]+)\t([^\t]+)\t([01])$")
    if input and code and readings then
      ---@type AppendShiRoute
      local route = { code = code, readings = {}, system = system == "1" }
      for reading in readings:gmatch("%S+") do route.readings[reading] = true end
      env.shi_routes[input] = env.shi_routes[input] or {}
      table.insert(env.shi_routes[input], route)
    end
  end
  file:close()
  env.shi_memory = Memory(env.engine, env.engine.schema, "translator")
  env.shi_pinyin = ReverseLookup("snow_pinyin")
  env.shi_fixed = { engine = env.engine, name_space = "translator" }
  fix.init(env.shi_fixed)
end

---@param route AppendShiRoute
---@param env AppendShiEnv
local function route_priority(route, env)
  if env.shi_fixed then
    for _, word in ipairs(fix.get_customized_list(env.shi_fixed, route.code)) do
      if utf8.len(word) == 2 and word:sub(-3) == "是" then return 2 end
    end
  end
  local user_dict = env.shi_memory and env.shi_memory.user_dict
  if user_dict then
    for reading in pairs(route.readings) do
      local entries = user_dict:lookup_words(reading .. " shi4", false, 0)
      for entry in entries:iter() do
        if utf8.len(entry.text) == 2 and entry.text:sub(-3) == "是" then return 1 end
      end
    end
  end
  return route.system ~= false and 0 or -1
end

---@param candidate Candidate
---@param route AppendShiRoute
---@param env AppendShiEnv
local function matches(candidate, route, env)
  if utf8.len(candidate.text) ~= 2 or candidate.text:sub(-3) ~= "是" then return false end
  local genuine = candidate:get_genuine()
  if genuine.type == "sentence" then return false end
  local phrase = genuine:to_phrase()
  if phrase and env.shi_memory then
    local readings = env.shi_memory:decode(phrase.entry.code)
    return #readings == 2 and route.readings[readings[1]] == true and readings[2] == "shi4"
  end
  -- 手动固定的新词可能没有原生 Phrase，仍须验证首字读音。
  if genuine.type ~= "fixed" or not env.shi_pinyin then return false end
  local first = candidate.text:sub(1, utf8.offset(candidate.text, 2) - 1)
  for reading in env.shi_pinyin:lookup(first):gmatch("%S+") do
    if route.readings[reading] then return true end
  end
  return false
end

---@param env AppendShiEnv
---@return boolean
function append.commit(env)
  local context = env.engine.context
  local segment = context.composition:toSegmentation():back()
  -- 不改动已有选词、反查、回头补码和形辅上下文；这些仍按以词定字处理。
  if not segment or segment.start ~= 0 or segment._end ~= #context.input
      or context.caret_pos ~= #context.input or not segment:has_tag("abc")
      or context:get_property("shape_input") ~= "" then return false end
  if not env.shi_routes then load_routes(env) end
  local routes = env.shi_routes and env.shi_routes[context.input]
  if not routes then return false end
  local input, selected_index = context.input, segment.selected_index
  local previous_scope = context:get_property("snow_append_query")
  context:set_property("snow_append_query", "1")
  ---@type Candidate|nil
  local best
  ---@type table<string, UserPhraseWeight>
  local weights = {}
  local ok, message = pcall(function()
    local profiling = (env.shi_profile_remaining or 0) > 0
    if profiling then env.shi_profile_remaining = env.shi_profile_remaining - 1 end
    local started = profiling and os.clock() or 0
    local ordered = {}
    for index, route in ipairs(routes) do
      local rank = route_priority(route, env)
      if rank >= 0 then table.insert(ordered, { route = route, rank = rank, index = index }) end
    end
    table.sort(ordered, function(a, b)
      return a.rank > b.rank or a.rank == b.rank and a.index < b.index
    end)
    if profiling then
      log.warning(("append_shi profile routes=%d priority_cpu_ms=%.3f"):format(
        #ordered, (os.clock() - started) * 1000))
    end
    for _, item in ipairs(ordered) do
      local route = item.route
      -- 与 better_across_routes 的优先级完全一致：只有确定不能胜出时才剪枝。
      local best_pinned = best and (best.comment:find(snow.fixed_symbol, 1, true)
          or best.comment:find(snow.fixed_notfound_symbol, 1, true))
      if best_pinned and item.rank < 2 then break end
      if best and item.rank == 0 and priority.is_learned_phrase(best, env.shi_memory, weights) then break end
      local query_start = profiling and os.clock() or 0
      context.input = route.code
      local compose_end = profiling and os.clock() or 0
      local scanned = 0
      local current = context.composition:toSegmentation():back()
      if current and current.start == 0 and current._end == #route.code then
        local index = 0
        while current.menu:prepare(index + 1) > index do
          local candidate = current.menu:get_candidate_at(index)
          scanned = scanned + 1
          if candidate._end < #route.code then break end
          if candidate._end == #route.code and matches(candidate, route, env) then
            -- 每一路仅取最终菜单中首个匹配词；非「×是」的 pin 不参与比较。
            local pinned = candidate.comment:find(snow.fixed_symbol, 1, true)
                or candidate.comment:find(snow.fixed_notfound_symbol, 1, true)
            local best_pinned = best and (best.comment:find(snow.fixed_symbol, 1, true)
                or best.comment:find(snow.fixed_notfound_symbol, 1, true))
            if not best or (pinned and not best_pinned)
                or (not not pinned == not not best_pinned
                  and priority.better_across_routes(candidate, best, env.shi_memory, weights)) then
              best = candidate
            end
            break
          end
          index = index + 1
        end
      end
      if profiling then
        log.warning(("append_shi profile code=%s compose_cpu_ms=%.3f scan_cpu_ms=%.3f scanned=%d"):format(
          route.code, (compose_end - query_start) * 1000, (os.clock() - compose_end) * 1000, scanned))
      end
    end
    if best then
      -- 快捷上屏只读标准词码排序。不能 select/commit，否则原生 Memory
      -- 和 learned_priority 的 commit_notifier 都可能把本次上屏写成学习。
      snow.commit_text(env.engine, best.text)
      context:clear()
      return true
    end
    return false
  end)
  if not ok or not message then
    context.input = input
    context:highlight(selected_index)
  end
  context:set_property("snow_append_query", previous_scope)
  if not ok then log.error("append_shi: " .. tostring(message)) end
  return ok and message == true
end

---@param env AppendShiEnv
function append.fini(env)
  env.shi_routes = nil
  if env.shi_fixed then fix.fini(env.shi_fixed) end
  env.shi_fixed = nil
  if env.shi_memory then env.shi_memory:disconnect() end
  env.shi_memory = nil
  env.shi_pinyin = nil
  collectgarbage()
end

return append
