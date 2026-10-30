-- 冰雪清韵方案过滤器

local snow = require "snow.snow"

local filter = {}

---@class QingyunEnv: Env
---@field fixed table<string, string>
---@field reverse_lookup table<string, string[]>
---@field lookup_pinyin ReverseLookup|nil
---@field memory Memory
---@field chaifen ReverseLookup|nil
---@field connection Connection
---@field chaifen_cache table<string, string>
---@field preedit_cache table<string, string>

---@param env QingyunEnv
function filter.init(env)
  env.fixed = snow.table_from_tsv(rime_api.get_user_data_dir() .. "/snow_qingyun.fixed.txt")
  env.reverse_lookup = {}
  for code, content in pairs(env.fixed) do
    for word in content:gmatch("[^%s]+") do
      if not env.reverse_lookup[word] then
        env.reverse_lookup[word] = {}
      end
      table.insert(env.reverse_lookup[word], code)
      table.sort(env.reverse_lookup[word])
    end
  end
  env.lookup_pinyin = ReverseLookup("snow_pinyin")
  env.memory = Memory(env.engine, env.engine.schema, "pinyin")
  env.chaifen = ReverseLookup("snow_qingyun_chaifen")
  env.chaifen_cache = {}
  env.preedit_cache = {}
  env.connection = env.engine.context.commit_notifier:connect(function(ctx)
    local reset = env.engine.schema.config:get_int("switches/3/reset")
    local target = reset == 1 and true or false
    local current = ctx:get_option("character")
    if current ~= target then
      ctx:set_option("character", target)
    end
  end)
end

---@param candidate Candidate
local function is_pinyin(candidate)
  return candidate.preedit:sub(1, 1) == "["
end

local consonants = {
  b = true, p = true, m = true, f = true, d = true, t = true, n = true, l = true,
  g = true, k = true, h = true, j = true, q = true, x = true, z = true, c = true,
  s = true, r = true, w = true, y = true, v = true,
}

local affixes = { "a", "o", "e", "i", "u", ";", ",", ".", "/" }

---@param candidate Candidate
---@param env QingyunEnv
local function prettify_preedit(candidate, env)
  local original = candidate.preedit
  local cached = env.preedit_cache[original]
  if cached then
    candidate.preedit = cached
    return
  end
  local preedit = original:sub(1, 1) == "[" and original:sub(2, -2) or original
  local parts = {}
  local previous = ""
  for index = 1, preedit:len() do
    local current = preedit:sub(index, index)
    if consonants[previous] and consonants[current] then
      table.insert(parts, " ")
    end
    table.insert(parts, current)
    previous = current
  end
  candidate.preedit = table.concat(parts)
  env.preedit_cache[original] = candidate.preedit
end

---@param translation Translation
---@param env QingyunEnv
function filter.func(translation, env)
  local count = 0
  local context = env.engine.context
  local input = snow.current(context) or ""
  local segment = context.composition:toSegmentation():back()
  local buffered = context:get_option("buffered")
  local character_only = context:get_option("character")
  local show_chaifen = context:get_option("chaifen")
  local is_short_code = rime_api.regex_match(input, "[bpmfdtnlgkhjqxzcsrvwy]{1,2}")
  local is_abc = segment and segment:has_tag("abc") or false
  for candidate in translation:iter() do
    -- 历史候选与其他方案共用同一套排序和选择行为，不受清韵的
    -- 缓冲、单字模式、拆分提示等候选加工影响。
    if candidate.type == "history" then
      yield(candidate)
      goto continue
    end
    if buffered and not is_pinyin(candidate) then
      local result = env.lookup_pinyin and env.lookup_pinyin:lookup(candidate.text) or ""
      ---@type Candidate[]
      local candidates = {}
      for pinyin in result:gmatch("[^%s]+") do
        env.memory:dict_lookup(pinyin, true, 100)
        for entry in env.memory:iter_dict() do
          if entry.text == candidate.text then
            local phrase = Phrase(env.memory, "phrase", candidate.start, candidate._end, entry)
            local c = phrase:toCandidate()
            c.comment = candidate.comment
            snow.comment(c, pinyin)
            c.quality = entry.weight
            table.insert(candidates, c)
          end
        end
      end
      table.sort(candidates, function(a, b) return a.quality > b.quality end)
      for _, c in ipairs(candidates) do
        yield(c)
      end
      goto continue
    end
    if candidate.type == "sentence" and (not is_pinyin(candidate)) then
      goto continue -- 过滤掉冰雪清韵形码的组句候选
    end
    if character_only and utf8.len(candidate.text) > 1 then
      goto continue
    end
    if is_short_code then -- 生成一简十重提示
      if count == 0 then
        local hint = ""
        for _, letter in ipairs(affixes) do
          local code = input .. letter
          local word_list = env.fixed[code]
          if word_list then
            local word = word_list:match("^[^%s]+")
            if input:len() == 1 or utf8.len(word) > 1 then
              ---@type string
              hint = hint .. word .. letter .. " "
            end
          end
        end
        if utf8.len(candidate.text) > 1 then -- 第一个候选就是词
          local c = Candidate("placeholder", candidate.start, candidate._end, "🈚️", hint)
          c.preedit = candidate.preedit
          count = count + 1
          prettify_preedit(c, env)
          yield(c)
          return
        else
          snow.comment(candidate, hint)
        end
      else
        return
      end
      count = count + 1
    elseif utf8.len(candidate.text) == 1 and (is_pinyin(candidate) or (segment and (segment:has_tag("pinyin") or segment:has_tag("stroke")))) then -- 生成反查提示
      local codes = env.reverse_lookup[candidate.text]
      if codes then
        snow.comment(candidate, table.concat(codes, " "))
      end
    else
      local codes = env.reverse_lookup[candidate.text]
      if codes then
        local shorter_codes = {}
        for _, code in ipairs(codes) do
          if code:len() < input:len() then
            table.insert(shorter_codes, code)
          end
        end
        if #shorter_codes > 0 then
          snow.comment(candidate, table.concat(shorter_codes, " "))
        end
      end
    end
    if show_chaifen then
      local chaifen = env.chaifen_cache[candidate.text]
      if chaifen == nil then
        chaifen = env.chaifen and env.chaifen:lookup(candidate.text) or ""
        env.chaifen_cache[candidate.text] = chaifen
      end
      if chaifen:len() > 0 then
        snow.comment(candidate, "~ " .. chaifen:gsub("-", " "))
      end
    end
    if is_abc then
      prettify_preedit(candidate, env)
    end
    yield(candidate)
    ::continue::
  end
end

-- 清韵的笔画反查也打 pinyin 标签；标点、历史等段不应被单字过滤、缓冲改写
---@param segment Segment
---@param env QingyunEnv
function filter.tags_match(segment, env)
  return segment:has_tag("abc") or segment:has_tag("pinyin")
end

---@param env QingyunEnv
function filter.fini(env)
  env.fixed = nil
  env.reverse_lookup = nil
  env.lookup_pinyin = nil
  env.memory = nil
  env.chaifen = nil
  env.chaifen_cache = nil
  env.preedit_cache = nil
  env.connection:disconnect()
  collectgarbage()
end

return filter
