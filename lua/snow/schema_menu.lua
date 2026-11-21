-- 可筛选方案选单
-- 以方案名和描述语的拼音声母筛选发布方案。

local snow = require "snow.snow"

---@class SchemaMenuEntry
---@field schema_id string
---@field name string
---@field comment string
---@field aliases string[]

---@class SchemaMenuProcessorEnv: Env
---@field prefix string
---@field sentinel string
---@field open_input string
---@field toggle_keys KeyEvent[]
---@field escape_key KeyEvent
---@field backspace_key KeyEvent
---@field confirm_keys KeyEvent[]
---@field swallowed_keys table<integer, boolean>

---@class SchemaMenuTranslatorEnv: Env
---@field prefix string
---@field sentinel string
---@field tag string
---@field selected_schema_id string|nil
---@field available_schemas table<string, boolean>
---@field enabled_schemas table<string, boolean>
---@field prepare_connection Connection
---@field select_connection Connection

local processor = {}
local translator = {}
local menu = { processor = processor, translator = translator }

---@type SchemaMenuEntry[]
menu.entries = {
  {
    schema_id = "snow_jiandao_classic",
    name = "冰雪键道",
    comment = "21²5⁴ 经典键道 二字词低重",
    aliases = { "bxjd", "jd", "jdjd", "ezcdc", "bxjdjdjdezcdc" },
  },
  {
    schema_id = "snow_sanpin_classic",
    name = "冰雪三拼",
    comment = "21²5ⁿ 经典三拼 单字简繁通打",
    aliases = { "bxsp", "sp", "jdsp", "dzjftd", "bxspjdspdzjftd" },
  },
  {
    schema_id = "snow_jiandao",
    name = "冰雪兰道",
    comment = "21²5⁴ 零飞键道 三四字词低重",
    aliases = { "bxld", "ld", "lfjd", "sszcdc", "bxldlfjdsszcdc" },
  },
  {
    schema_id = "snow_sanpin",
    name = "冰雪兰拼",
    comment = "21²5ⁿ 零飞三拼 人体工学",
    aliases = { "bxlp", "lp", "lfsp", "rtgx", "bxlplfsprtgx" },
  },
  {
    schema_id = "snow_shenyun_shape",
    name = "冰雪鹤道",
    comment = "21¹26¹5⁴ 无重键道 没有 630",
    aliases = { "bxhd", "hd", "wzjd", "myl", "bxhdwzjdmyl" },
  },
  {
    schema_id = "snow_shenyun_tone",
    name = "冰雪鹤拼",
    comment = "21¹26¹5ⁿ 无重三拼 顶功版廿六",
    aliases = { "bxhp", "hp", "wzsp", "dgbenl", "bxhpwzspdgbenl" },
  },
  {
    schema_id = "snow_sipin",
    name = "冰雪四拼",
    comment = "21¹5ⁿ 动态调频 多音节词王",
    aliases = { "bxsp", "sp", "dtdp", "dyjcw", "bxspdtdpdyjcw" },
  },
  {
    schema_id = "snow_yipin",
    name = "冰雪一拼",
    comment = "1200ⁿ95ᵐ 顶功并击 带调音节/击",
    aliases = { "bxyp", "yp", "dgbj", "dtyjj", "bxypdgbjdtyjj" },
  },
  {
    schema_id = "snow_qingyun",
    name = "冰雪清韵",
    comment = "21ᵐ9¹ 四码前缀 多字根字王",
    aliases = { "bxqy", "qy", "smqz", "dzgzw", "bxqysmqzdzgzw" },
  },
  {
    schema_id = "snow_zhudao",
    name = "冰雪鹮道",
    comment = "21¹26¹5⁴ 带调鹤道 键道形辅",
    aliases = { "bxhd", "hd", "dthd", "ddhd", "dtdp", "jdxf", "bxhddtdpjdxf" },
  },
  {
    schema_id = "snow_jiandao_toned",
    name = "冰雪莲道",
    comment = "21²5⁴ 带调兰道 性能之王",
    aliases = { "bxld", "ld", "dtld", "ddld", "dtjd", "ddjd", "zmhd", "bxlddtjdzmhd" },
  },
}

---@param query string
---@param alias string
---@return boolean
local function is_subsequence(query, alias)
  local query_index = 1
  for alias_index = 1, #alias do
    if alias:sub(alias_index, alias_index) == query:sub(query_index, query_index) then
      query_index = query_index + 1
      if query_index > #query then return true end
    end
  end
  return query == ""
end

---@param query string
---@return SchemaMenuEntry[]
function menu.filter_entries(query)
  query = query:lower()
  local exact = {}
  for _, entry in ipairs(menu.entries) do
    for _, alias in ipairs(entry.aliases) do
      if query == alias then
        table.insert(exact, entry)
        break
      end
    end
  end
  if #exact > 0 then return exact end
  local result = {}
  for _, entry in ipairs(menu.entries) do
    for _, alias in ipairs(entry.aliases) do
      if is_subsequence(query, alias) then
        table.insert(result, entry)
        break
      end
    end
  end
  return result
end

---@param name string
---@return string|nil
local function schema_id_for_name(name)
  for _, entry in ipairs(menu.entries) do
    if entry.name == name then return entry.schema_id end
  end
  return nil
end

---@param input string
---@param prefix string
---@return boolean
local function is_active(input, prefix)
  return input:sub(1, #prefix) == prefix
end

---@return table<string, boolean>
local function enabled_schemas()
  -- 和原生选单读取同一份已编译 default，不能把旧 build 产物当作当前启用列表。
  local config = Schema(".default").config
  ---@type table<string, boolean>
  local enabled = {}
  for index = 0, config:get_list_size("schema_list") - 1 do
    local path = "schema_list/@" .. index
    local schema_id = config:get_string(path .. "/schema")
    local conditions = config:get_list(path .. "/case")
    local active = true
    if conditions then
      for condition_index = 0, conditions.size - 1 do
        local condition = conditions:get_value_at(condition_index)
        if condition and condition.value and config:get_bool(condition.value) ~= true then
          active = false
          break
        end
      end
    end
    if schema_id and active then enabled[schema_id] = true end
  end
  return enabled
end

---@param env SchemaMenuProcessorEnv
function processor.init(env)
  local config = env.engine.schema.config
  env.prefix = config:get_string("schema_menu/prefix") or "~~"
  env.sentinel = config:get_string("schema_menu/sentinel") or "'"
  env.open_input = env.prefix .. env.sentinel
  env.toggle_keys = { KeyEvent("F4"), KeyEvent("Control+grave") }
  env.escape_key = KeyEvent("Escape")
  env.backspace_key = KeyEvent("BackSpace")
  env.confirm_keys = { KeyEvent("space"), KeyEvent("Return") }
  env.swallowed_keys = {}
end

---@param key_event KeyEvent
---@param env SchemaMenuProcessorEnv
function processor.func(key_event, env)
  if key_event:release() then
    if env.swallowed_keys[key_event.keycode] then
      env.swallowed_keys[key_event.keycode] = nil
      return snow.kAccepted
    end
    return snow.kNoop
  end
  local context = env.engine.context
  local active = is_active(context.input, env.prefix)
  for _, toggle_key in ipairs(env.toggle_keys) do
    if key_event:eq(toggle_key) then
      context:clear()
      if not active then context:push_input(env.open_input) end
      return snow.kAccepted
    end
  end
  if active and key_event:eq(env.escape_key) then
    context:clear()
    return snow.kAccepted
  end
  if not active then return snow.kNoop end
  if key_event.modifier == 0 and key_event.keycode >= 0x61 and key_event.keycode <= 0x7a then
    env.swallowed_keys[key_event.keycode] = true
    context:push_input(string.char(key_event.keycode))
    return snow.kAccepted
  end
  if key_event:eq(env.backspace_key) then
    if #context.input > #env.open_input then
      context:pop_input(1)
    else
      context:clear()
    end
    return snow.kAccepted
  end
  for _, confirm_key in ipairs(env.confirm_keys) do
    if key_event:eq(confirm_key) then
      env.swallowed_keys[key_event.keycode] = true
      context:confirm_current_selection()
      return snow.kAccepted
    end
  end
  return snow.kNoop
end

---@param env SchemaMenuTranslatorEnv
function translator.init(env)
  local config = env.engine.schema.config
  env.prefix = config:get_string("schema_menu/prefix") or "~~"
  env.sentinel = config:get_string("schema_menu/sentinel") or "'"
  env.tag = config:get_string("schema_menu/tag") or "schema_menu"
  env.selected_schema_id = nil
  env.available_schemas = {}
  env.enabled_schemas = enabled_schemas()
  for _, entry in ipairs(menu.entries) do
    if env.enabled_schemas[entry.schema_id] then
      local schema = Schema(entry.schema_id)
      env.available_schemas[entry.schema_id] =
          schema.config:get_string("schema/schema_id") == entry.schema_id
    end
  end
  local context = env.engine.context
  env.prepare_connection = context.select_notifier:connect(function(ctx)
    env.selected_schema_id = nil
    local candidate = ctx:get_selected_candidate()
    if not candidate then return end
    local genuine = candidate:get_genuine()
    if genuine.type ~= env.tag then return end
    env.selected_schema_id = schema_id_for_name(genuine.text)
    if env.selected_schema_id then ctx:set_option("_auto_commit", false) end
  end, 0)
  env.select_connection = context.select_notifier:connect(function(ctx)
    local schema_id = env.selected_schema_id
    if not schema_id then return end
    env.selected_schema_id = nil
    ctx:clear()
    if not env.available_schemas[schema_id] then return end
    if schema_id ~= env.engine.schema.schema_id then
      -- 列表或部署产物可能在菜单打开后变化，切换前再次核对。
      if not enabled_schemas()[schema_id] then return end
      local schema = Schema(schema_id)
      if schema.config:get_string("schema/schema_id") == schema_id then
        env.engine:apply_schema(schema)
      end
    end
  end)
end

---@param input string
---@param segment Segment
---@param env SchemaMenuTranslatorEnv
function translator.func(input, segment, env)
  if not segment:has_tag(env.tag) then return end
  local query = input
  if is_active(query, env.prefix) then query = query:sub(#env.prefix + 1) end
  if query:sub(1, #env.sentinel) == env.sentinel then query = query:sub(#env.sentinel + 1) end
  for _, entry in ipairs(menu.filter_entries(query)) do
    ---@type string
    local comment
    if not env.enabled_schemas[entry.schema_id] then
      comment = "未启用：请加入方案列表后重新部署"
    elseif not env.available_schemas[entry.schema_id] then
      comment = "未部署：请加入方案列表后重新部署"
    else
      comment = entry.comment
    end
    local candidate = Candidate(env.tag, segment.start, segment._end, entry.name, comment)
    candidate.preedit = query
    yield(candidate)
  end
end

---@param env SchemaMenuTranslatorEnv
function translator.fini(env)
  env.prepare_connection:disconnect()
  env.select_connection:disconnect()
end

return menu
