-- 单音节的「×是」自适应上屏，直接合并系统词索引与实时用户词。
local snow = require "snow.snow"
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
---@field shi_words table<string, table<string, number>>|nil
---@field shi_converter Opencc|nil

---@param env AppendShiEnv
local function load_routes(env)
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
  env.shi_words = {}
  local words = assert(io.open(rime_api.get_user_data_dir() .. "/lua/snow/append_shi_words.txt", "r"))
  for line in words:lines() do
    local reading, word, weight = line:match("^([^#\t]+)\t([^\t]+)\t([%d.eE+-]+)$")
    if reading and word and weight then
      env.shi_words[reading] = env.shi_words[reading] or {}
      env.shi_words[reading][word] = tonumber(weight) or 0
    end
  end
  words:close()
  env.shi_converter = Opencc("s2t.json")
  env.shi_memory = Memory(env.engine, env.engine.schema, "translator")
  env.shi_pinyin = ReverseLookup("snow_pinyin")
  env.shi_fixed = { engine = env.engine, name_space = "translator" }
  fix.init(env.shi_fixed)
end

---@class AppendShiWord
---@field text string
---@field weight number
---@field learned boolean
---@field pin integer|nil
---@field postponed boolean

local function valid(text)
  return utf8.len(text) == 2 and text:sub(-3) == "是"
end

---@param a AppendShiWord
---@param b AppendShiWord
local function better(a, b)
  if (a.pin ~= nil) ~= (b.pin ~= nil) then return a.pin ~= nil end
  if a.pin and b.pin and a.pin ~= b.pin then return a.pin < b.pin end
  if not a.pin and a.postponed ~= b.postponed then return not a.postponed end
  if a.learned ~= b.learned then return a.learned end
  if a.weight ~= b.weight then return a.weight > b.weight end
  return a.text < b.text
end

---@param env AppendShiEnv
---@return boolean
function append.commit(env)
  local context = env.engine.context
  local segment = context.composition:toSegmentation():back()
  if not segment or segment.start ~= 0 or segment._end ~= #context.input
      or context.caret_pos ~= #context.input or not segment:has_tag("abc")
      or context:get_property("shape_input") ~= "" then return false end
  local ok, result = pcall(function()
    if not env.shi_routes then load_routes(env) end
    local routes = env.shi_routes and env.shi_routes[context.input]
    if not routes then return false end
    local known = {}
    if context:get_option("popping") then
      for length, word in (context:get_property("snow_postpone_known") or ""):gmatch("(%d+)\t([^\n]+)") do
        known[word] = tonumber(length)
      end
    end
    ---@type AppendShiWord|nil
    local best
    local user_cache = {}
    for _, route in ipairs(routes) do
      ---@type table<string, AppendShiWord>
      local candidates = {}
      local function add(text, weight, learned)
        if not valid(text) then return end
        local value = { text = text, weight = weight, learned = learned,
          postponed = (known[text] or math.huge) < #route.code }
        if not candidates[text] or better(value, candidates[text]) then candidates[text] = value end
      end
      local readings = {}
      for reading in pairs(route.readings) do readings[#readings + 1] = reading end
      table.sort(readings)
      for _, reading in ipairs(readings) do
        for word, weight in pairs((env.shi_words or {})[reading] or {}) do add(word, weight, false) end
        if user_cache[reading] == nil then
          local words = {}
          local user_dict = env.shi_memory and env.shi_memory.user_dict
          if user_dict then
            for entry in user_dict:lookup_words(reading .. " shi4", false, 0):iter() do
              if valid(entry.text) then words[entry.text] = math.max(words[entry.text] or -math.huge, entry.weight) end
            end
          end
          user_cache[reading] = words
        end
        for word, weight in pairs(user_cache[reading]) do add(word, weight, true) end
      end
      if env.shi_fixed then
        for index, word in ipairs(fix.get_customized_list(env.shi_fixed, route.code)) do
          if valid(word) then
            if not candidates[word] and env.shi_pinyin then
              local first = word:sub(1, utf8.offset(word, 2) - 1)
              for reading in env.shi_pinyin:lookup(first):gmatch("%S+") do
                if route.readings[reading] then add(word, 0, false); break end
              end
            end
            if candidates[word] then candidates[word].pin = candidates[word].pin or index end
          end
        end
      end
      for _, candidate in pairs(candidates) do
        if not best or better(candidate, best) then best = candidate end
      end
    end
    if not best then return false end
    local text = best.text
    if context:get_option("traditionalization") and env.shi_converter then
      text = env.shi_converter:convert_text(text)
    end
    -- 不触碰输入、菜单、选择通知或学习接口，只直接上屏结果。
    snow.commit_text(env.engine, text)
    context:clear()
    return true
  end)
  if not ok then log.error("append_shi: " .. tostring(result)) end
  return ok and result == true
end

---@param env AppendShiEnv
function append.fini(env)
  env.shi_routes = nil
  env.shi_words = nil
  env.shi_converter = nil
  if env.shi_fixed then fix.fini(env.shi_fixed) end
  env.shi_fixed = nil
  if env.shi_memory then env.shi_memory:disconnect() end
  env.shi_memory = nil
  env.shi_pinyin = nil
  collectgarbage()
end

return append
