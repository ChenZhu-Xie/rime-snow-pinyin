package.path = "./lua/?.lua;" .. package.path

local snow = { kNoop = 2, kAccepted = 1, kShift = 1, kConfirmed = "confirmed", kSelected = "selected" }
snow.current = function(context)
  local segment = context.composition:toSegmentation():back()
  return context.input:sub(segment.start + 1, segment._end)
end
package.loaded["snow.snow"] = snow
local processor = require "snow.select_word_length"

local function key(code, modifier, released)
  return { keycode = code, modifier = modifier or 0,
    release = function() return released or false end }
end

local function setup(layout, input, rows, options)
  options = options or {}
  local start = options.start or 0
  local segment = { start = start, _end = start + #input, selected_index = options.selected_index or 0 }
  segment.has_tag = function(_, tag) return tag == (options.tag or "abc") end
  local prepared = 0
  local candidates = {}
  for _, row in ipairs(rows) do
    local candidate = type(row) == "string" and { text = row } or row
    candidate.type = candidate.type or "phrase"
    candidate._start = candidate._start or start
    candidate._end = candidate._end or segment._end
    candidate.get_genuine = function(self) return self end
    candidates[#candidates + 1] = candidate
  end
  segment.menu = {
    prepare = function(_, count) prepared = math.min(count, #candidates) return prepared end,
    get_candidate_at = function(_, index) return index < prepared and candidates[index + 1] or nil end,
  }
  local previous = { status = snow.kConfirmed }
  local segmentation = { back = function() return segment end,
    get_segments = function() return { previous, segment } end }
  local context = {
    input = string.rep("z", start) .. input,
    caret_pos = options.caret_pos or start + #input,
    composition = { toSegmentation = function() return segmentation end },
    get_option = function(_, name) return options[name] or false end,
    get_property = function(_, name) return name == "shape_input" and (options.shape_input or "") or "" end,
    has_menu = function() return #candidates > 0 end,
  }
  context.select = function(_, index)
    assert(previous.status == snow.kSelected, "confirmed buffered segments must be selected before normal commit")
    context.chosen = candidates[index + 1]
    return true
  end
  context.commit = function() context.committed = context.chosen.text end
  local env = { engine = { context = context, schema = { config = {
    get_string = function(_, path)
      if path == "word_length/layout" then return layout end
      if path == "speller/initials" then
        return layout == "21x21" and "bpmfdtnlgkhjqxzcsrwye" or "bpmfdtnlgkhjqwvxrzcsy"
      end
    end,
  } } } }
  processor.init(env)
  return env, context
end

local function selected(layout, input, rows, code, modifier, options)
  local env, context = setup(layout, input, rows, options)
  local result = processor.func(key(code, modifier), env)
  return context.committed, result, context
end

assert(selected("21x21", "bpmf", { "四个汉字", "二字", "五个汉字词" }, 62) == "五个汉字词")
assert(selected("21x26", "bpmf", { "五个汉字词", "二字", "三个字" }, 62) == "三个字")
assert(selected("21x21", "bpmf", { "三个字", "二字", "四个汉字" }, 62) == "二字")
assert(selected("21x26", "bpmf", { "二字", "四个汉字", "五个汉字词" }, 62) == "五个汉字词")
assert(selected("21x21", "bpmf", { "二字", "四个汉字", "五个汉字词" }, 60) == "四个汉字")
assert(selected("21x26", "bpmf", { "二字", "四个汉字", "五个汉字词" }, 60) == "四个汉字")

-- The preferred class can be beyond both the current page and the old 120-candidate buffer.
local many = { "二字" }
for _ = 1, 150 do many[#many + 1] = "四个汉字" end
many[#many + 1] = { text = "长词原生补全", type = "completion" }
assert(selected("21x21", "bpmf", many, 62, 0, { selected_index = 12 }) == "长词原生补全")
assert(selected("21x21", "bpmf", { "二字", "四个汉字" }, 60, 0, { selected_index = 1 }) == "四个汉字")

-- Completed predictions count; an unconsumed prefix or generated sentence does not.
assert(selected("21x21", "bpmf", {
  { text = "前缀候选词", _end = 3 },
  { text = "临时生成句", type = "sentence" },
  { text = "原生长词补全", type = "completion" }, "二字",
}, 62) == "原生长词补全")
assert(selected("21x26", "bpmf", { "三个字", "四个汉字" }, 62, 0, { start = 3 }) == "三个字")

-- Uppercase finals in 21x21 are optional detail on the first three main positions.
assert(selected("21x21", "bPmDfTn", { "四个汉字" }, 60) == "四个汉字")
assert(selected("21x21", "bpmfiu", { "四个汉字" }, 60) == "四个汉字")
assert(selected("21x21", "bpmf", { "四个汉字" }, 60, 0, { shape_input = "iu" }) == "四个汉字")
assert(selected("21x26", "bpmfae", { "三个字" }, 62) == "三个字")
assert(selected("21x26", "bpme", { "三个字" }, 62) == "三个字")

for _, input in ipairs({ "", "b", "bp", "bpm", "bpmfd", "bpmfD", "bPmDfT", "bpaaaa" }) do
  local _, result = selected("21x21", input, { "四个汉字" }, 60)
  assert(result == snow.kNoop, "invalid 21x21 scope: " .. input)
end
for _, input in ipairs({ "bp", "bpm", "bpoaaa", "bpmfD", "bpmfd", "bpmfDTN" }) do
  local _, result = selected("21x26", input, { "四个汉字" }, 60)
  assert(result == snow.kNoop, "invalid 21x26 scope: " .. input)
end

for _, options in ipairs({ { ascii_mode = true }, { tag = "pinyin" }, { caret_pos = 3 } }) do
  local _, result = selected("21x21", "bpmf", { "四个汉字" }, 60, 0, options)
  assert(result == snow.kNoop)
end
for _, event in ipairs({ key(60, 4), key(60, 8), key(60, 2), key(60, 64), key(60, 1, true), key(44), key(46), key(32) }) do
  local env, context = setup("21x21", "bpmf", { "四个汉字" })
  assert(processor.func(event, env) == snow.kNoop and context.chosen == nil)
end
for _, event in ipairs({ key(60), key(60, 1), key(44, 1), key(0x300A) }) do
  local env, context = setup("21x21", "bpmf", { "四个汉字" })
  assert(processor.func(event, env) == snow.kAccepted and context.committed == "四个汉字")
end
assert(selected("21x26", "bpmf", { "三个字" }, 46, 1) == "三个字")
assert(selected("21x26", "bpmf", { "三个字" }, 0x300B) == "三个字")

local committed, result, context = selected("21x21", "bpmf", { "二字" }, 60)
assert(committed == nil and result == snow.kAccepted and context.input == "bpmf")
committed, result, context = selected("21x21", "bpmf", {}, 62)
assert(committed == nil and result == snow.kAccepted and context.input == "bpmf")
committed, result, context = selected("21x26", "bpmf", { "三个字" }, 62, 0, { buffered = true })
assert(committed == nil and result == snow.kAccepted and context.chosen.text == "三个字")

print("select_word_length.test.lua: priorities, full lazy menu, scope, predictions, modifiers and buffered selection passed")
