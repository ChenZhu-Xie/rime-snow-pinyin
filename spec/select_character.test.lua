package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path

utf8 = {
  len = function(text)
    local count = 0
    for index = 1, #text do
      if text:byte(index) < 0x80 or text:byte(index) >= 0xc0 then count = count + 1 end
    end
    return count
  end,
  offset = function(text, target)
    local starts = {}
    for index = 1, #text do
      if text:byte(index) < 0x80 or text:byte(index) >= 0xc0 then table.insert(starts, index) end
    end
    local position = target > 0 and target or #starts + target + 1
    return starts[position]
  end,
}

local committed = ""
package.loaded["snow.snow"] = {
  kAccepted = 1,
  kNoop = 2,
  commit_text = function(engine, text)
    engine:commit_text(text)
  end,
}

local processor = require "snow.select_character"

local function run(text, key)
  committed = ""
  local cleared = false
  local context = {
    has_menu = function() return true end,
    get_selected_candidate = function() return { text = text } end,
    clear = function() cleared = true end,
  }
  local engine = {
    context = context,
    commit_text = function(_, value) committed = committed .. value end,
  }
  local key_event = {
    modifier = 0,
    eq = function(_, expected) return expected == key end,
  }
  local result = processor.func(key_event, {
    engine = engine,
    first_key = "first",
    last_key = "last",
  })
  return result, committed, cleared
end

for _, example in ipairs({
  { text = "冰", key = "first", expected = "冰冰" },
  { text = "冰", key = "last", expected = "冰得" },
  { text = "冰雪", key = "first", expected = "冰" },
  { text = "冰雪", key = "last", expected = "雪" },
}) do
  local result, actual, cleared = run(example.text, example.key)
  assert(result == 1, ("%s/%s should be accepted"):format(example.text, example.key))
  assert(actual == example.expected,
    ("%s/%s expected %s, got %s"):format(example.text, example.key, example.expected, actual))
  assert(cleared, ("%s/%s should clear context"):format(example.text, example.key))
end
