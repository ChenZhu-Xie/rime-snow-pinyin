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
---@field selected_action fun()|nil
---@field actions table<string, fun()>
---@field available_schemas table<string, boolean>
---@field enabled_schemas table<string, boolean>
---@field prepare_connection Connection
---@field select_connection Connection
---@field update_connection Connection

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
    comment = "21¹26¹5⁴ 带调鹤道 最低记忆",
    aliases = { "bxhd", "hd", "dthd", "ddhd", "dtdp", "jdxf", "bxhddtdpjdxf", "zdjy", "bxhddthdzdjy" },
  },
  {
    schema_id = "snow_jiandao_toned",
    name = "冰雪莲道",
    comment = "21²5⁴ 带调兰道 字词均衡",
    aliases = { "bxld", "ld", "dtld", "ddld", "dtjd", "ddjd", "zmhd", "bxlddtjdzmhd", "zcjh", "bxlddtldzcjh" },
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

---@param context Context
local function restore_ascii_mode(context)
  if context.input == "" and context:get_property("snow_menu_ascii_mode") == "1" then
    context:set_property("snow_menu_ascii_mode", "")
    context:set_option("ascii_mode", true)
  end
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
      context:set_property("snow_menu_options", "")
      if not active then
        -- ascii_segmentor 会把选单前缀截成 raw，必须在写入前暂停英文直通。
        if context:get_option("ascii_mode") then
          context:set_property("snow_menu_ascii_mode", "1")
          context:set_option("ascii_mode", false)
        end
        context:push_input(env.open_input)
      end
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
  env.selected_action = nil
  env.actions = {}
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
  env.update_connection = context.update_notifier:connect(function(ctx)
    -- 选项入口会先清空再重开，不能在这段过渡中恢复英文直通。
    if not env.selected_action then restore_ascii_mode(ctx) end
  end)
  env.prepare_connection = context.select_notifier:connect(function(ctx)
    env.selected_schema_id = nil
    env.selected_action = nil
    local candidate = ctx:get_selected_candidate()
    if not candidate then return end
    local genuine = candidate:get_genuine()
    if genuine.type ~= env.tag then return end
    env.selected_action = env.actions[genuine.text]
    env.selected_schema_id = schema_id_for_name(genuine.text)
    if env.selected_schema_id or env.selected_action then ctx:set_option("_auto_commit", false) end
  end, 0)
  env.select_connection = context.select_notifier:connect(function(ctx)
    local action = env.selected_action
    if action then
      ctx:clear()
      action()
      env.selected_action = nil
      restore_ascii_mode(ctx)
      return
    end
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
  env.actions = {}
  local context = env.engine.context
  if context:get_property("snow_menu_options") == "1" then
    local config = env.engine.schema.config
    for index = 0, config:get_list_size("switches") - 1 do
      local path = "switches/@" .. index
      local states = config:get_list(path .. "/states")
      local name = config:get_string(path .. "/name")
      local options = config:get_list(path .. "/options")
      if states and states.size >= 2 then
        local current = 0
        if name then
          local enabled = context:get_option(name)
          if name == "ascii_mode" and context:get_property("snow_menu_ascii_mode") == "1" then
            enabled = true
          end
          current = enabled and 1 or 0
        elseif options then
          for option_index = 0, options.size - 1 do
            local option = options:get_value_at(option_index)
            if option and context:get_option(option.value) then current = option_index end
          end
        end
        local next_index = (current + 1) % states.size
        local before = states:get_value_at(current)
        local after = states:get_value_at(next_index)
        if before and after and (name or options) then
          local text = before.value .. " → " .. after.value
          env.actions[text] = function()
            if name then
              if name == "ascii_mode" then context:set_property("snow_menu_ascii_mode", "") end
              context:set_option(name, next_index == 1)
            elseif options then
              for option_index = 0, options.size - 1 do
                local option = options:get_value_at(option_index)
                if option then context:set_option(option.value, option_index == next_index) end
              end
            end
            context:set_property("snow_menu_options", "")
          end
          yield(Candidate(env.tag, segment.start, segment._end, text, ""))
        end
      end
    end
    return
  end
  if query == "" then
    env.actions["方案选项"] = function()
      context:set_property("snow_menu_options", "1")
      context:push_input(env.prefix .. env.sentinel)
    end
    yield(Candidate(env.tag, segment.start, segment._end, "方案选项", "切换字词／单字、简繁等当前方案开关"))
  end
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
  env.update_connection:disconnect()
end

return menu
