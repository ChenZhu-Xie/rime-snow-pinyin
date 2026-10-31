-- 辅助码处理器
-- 本处理器接受辅助码按键，把它们放到上下文中

local snow = require "snow.snow"
local vacancy = require "snow.vacancy"

---@param env Env
local function update(env)
  env.engine.context:refresh_non_confirmed_composition()
end

---@class ShapeConfig
---@field match string?
---@field match_shape string?
---@field reject_combined string?
---@field accept string
---@field block boolean
---@field status string?
---@field vacant boolean

---@class ShapeProcessorEnv: Env
---@field config ShapeConfig[]
---@field select_connection Connection
---@field commit_connection Connection
---@field vacancy_translator Translator|nil
---@field vacancy_memory Memory|nil
---@field vacancy_projection Projection|nil
---@field vacancy_cache table<string, boolean>

local processor = {}

---@param env ShapeProcessorEnv
function processor.init(env)
  local shape_config = env.engine.schema.config:get_list("speller/shape")
  if not shape_config then return end
  local function clear()
    env.engine.context:set_property("shape_input", "")
    env.engine.context:set_property("shape_status", "")
    update(env)
  end
  local context = env.engine.context
  env.select_connection = context.select_notifier:connect(clear)
  env.commit_connection = context.commit_notifier:connect(clear)
  env.config = {}
  env.vacancy_cache = {}
  for i = 1, shape_config.size do
    local item = shape_config:get_at(i - 1)
    if not item then goto continue end
    local value = item:get_map()
    if not value then goto continue end
    local match = value:get_value("match")
    local match_config = value:get_value("match_config")
    local match_shape = value:get_value("match_shape")
    local reject_combined = value:get_value("reject_combined")
    local reject_combined_config = value:get_value("reject_combined_config")
    local status = value:get_value("status")
    local vacant = value:get_value("vacant")
    ---@type ShapeConfig
    local parsed = {
      match = match and match:get_string()
          or match_config and env.engine.schema.config:get_string(match_config:get_string()),
      match_shape = match_shape and match_shape:get_string(),
      reject_combined = reject_combined and reject_combined:get_string()
          or reject_combined_config
              and env.engine.schema.config:get_string(reject_combined_config:get_string()),
      accept = value:get_value("accept"):get_string() or "",
      block = value:get_value("block") and value:get_value("block"):get_bool() or false,
      status = status and status:get_string(),
      vacant = vacant and vacant:get_bool() or false,
    }
    if parsed.vacant and not env.vacancy_memory then
      env.vacancy_translator = Component.Translator(env.engine, "vacancy", "script_translator")
      env.vacancy_memory = Memory(env.engine, env.engine.schema, "vacancy")
      env.vacancy_projection = Projection(
        env.engine.schema.config:get_list("vacancy/canonical_format") or {})
    end
    table.insert(env.config, parsed)
    ::continue::
  end
end

---@param key_event KeyEvent
---@param env ShapeProcessorEnv
function processor.func(key_event, env)
  if not env.config then return snow.kNoop end
  local input = snow.current(env.engine.context) or ""
  if input:len() == 0 then
    env.engine.context:set_property("shape_input", "")
    env.engine.context:set_property("shape_status", "")
  end
  -- 追加编码
  local context = env.engine.context
  local shape_input = context:get_property("shape_input") or ""
  if key_event.modifier ~= 0 then
    return snow.kNoop
  end
  local segment = env.engine.context.composition:toSegmentation():back()
  if not segment then
    return snow.kNoop
  end
  if not segment:has_tag("abc") then
    return snow.kNoop
  end
  if key_event.keycode == snow.kBackSpace and shape_input ~= "" then
    -- 冰雪一拼一次删掉整个辅助码
    shape_input = env.engine.schema.schema_id == "snow_yipin" and "" or shape_input:sub(1, -2)
    if shape_input == "" then
      context:set_property("shape_status", "")
    end
    goto update
  else
    local key_char = utf8.char(key_event.keycode)
    for _, rule in ipairs(env.config) do
      if rule.match and not rime_api.regex_match(input, rule.match) then
        goto continue
      end
      if not rime_api.regex_match(key_char, rule.accept) then
        goto continue
      end
      if rule.vacant then
        if input:len() ~= 2 or not env.vacancy_translator or not env.vacancy_memory
            or not env.vacancy_projection
            or not vacancy.is_empty(input, segment, env.vacancy_translator,
              env.vacancy_memory, env.vacancy_projection, env.vacancy_cache) then
          goto continue
        end
      end
      if rule.match_shape and not rime_api.regex_match(shape_input, rule.match_shape) then
        goto continue
      end
      if rule.reject_combined and rime_api.regex_match(input .. key_char, rule.reject_combined) then
        goto continue
      end
      if rule.block then
        return snow.kAccepted
      end
      shape_input = shape_input .. key_char
      context:set_property("shape_status", rule.status or "")
      goto update
      ::continue::
    end
    return snow.kNoop
  end
  ::update::
  context:set_property("shape_input", shape_input)
  update(env)
  return snow.kAccepted
end

---@param env ShapeProcessorEnv
function processor.fini(env)
  if env.select_connection then env.select_connection:disconnect() end
  if env.commit_connection then env.commit_connection:disconnect() end
  env.vacancy_translator = nil
  env.vacancy_memory = nil
  env.vacancy_projection = nil
  collectgarbage()
end

return processor
