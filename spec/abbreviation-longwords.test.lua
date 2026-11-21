package.path = "./lua/?.lua;" .. package.path

local committed
package.loaded["snow.snow"] = {
  kNoop = 2, kAccepted = 1,
  current = function(context) return context.input end,
  sub = function(text, first, last)
    local chars = {}
    for _, code in utf8.codes(text) do chars[#chars + 1] = utf8.char(code) end
    if last and last < 0 then last = #chars + last + 1 end
    return table.concat(chars, "", first, last or #chars)
  end,
  commit_text = function(_, text) committed = (committed or "") .. text end,
}
local processor = require "snow.abbreviation"

local function run(layout, input, incoming)
  committed = nil
  local context = {
    input = input,
    composition = { toSegmentation = function() return { back = function()
      return { has_tag = function() return true end }
    end } end },
    get_selected_candidate = function() return { text = "科学" } end,
    get_option = function() return false end,
    clear = function() end,
    confirm_current_selection = function() end,
    commit = function() end,
  }
  local env = { engine = { context = context, schema = { config = {
    get_string = function(_, path)
      if path == "word_length/layout" then return layout end
      if path == "speller/initials" then return "bpmfdtnlgkhjqwvxrzcsy" end
    end,
  } } } }
  if processor.init then processor.init(env) end
  local event = { keycode = incoming:byte(), release = function() return false end,
    alt = function() return false end, ctrl = function() return false end, caps = function() return false end }
  return processor.func(event, env), committed
end

for _, incoming in ipairs({ "G", "D", "L" }) do
  local result, text = run("21x26", "kyfs", incoming)
  assert(result == 2 and text == nil, "explicit fifth initial must bypass abbreviation with popping disabled: " .. incoming)
end
for _, entry in ipairs({ { "21x21", "kyfs" }, { "21x26", "kyf" }, { "21x26", "kafo" } }) do
  local result, text = run(entry[1], entry[2], "G")
  assert(result == 1 and text == "科个学", "existing short-word abbreviation must remain available")
end
print("abbreviation-longwords.test.lua: explicit continuation bypasses abbreviation independently of popping")
