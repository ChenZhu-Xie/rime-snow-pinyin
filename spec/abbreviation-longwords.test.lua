package.path = "./lua/?.lua;" .. package.path

local committed
package.loaded["snow.snow"] = {
  kNoop = 2, kAccepted = 1, kAlt = 8,
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

local function run(layout, input, incoming, options)
  options = options or {}
  committed = nil
  local context = {
    input = input,
    composition = { toSegmentation = function() return { back = function()
      return { has_tag = function() return true end }
    end } end },
    get_selected_candidate = function() return { text = "科学" } end,
    get_option = function(_, name) return options[name] or false end,
    clear = function() end,
    confirm_current_selection = function() end,
    commit = function() committed = (committed or "") .. "科学" end,
  }
  local env = { engine = { context = context, schema = { config = {
    get_string = function(_, path)
      if path == "abbreviation/alt_repeat_key" then return options.alt_repeat_key end
      if path == "word_length/layout" then return layout end
      if path == "speller/initials" then return "bpmfdtnlgkhjqwvxrzcsy" end
    end,
  } } } }
  if processor.init then processor.init(env) end
  local event = { keycode = incoming:byte(), modifier = options.modifier or 0,
    release = function() return options.release or false end,
    alt = function() return options.alt or false end,
    ctrl = function() return options.ctrl or false end,
    caps = function() return options.caps or false end }
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
for _, entry in ipairs({ { "A", {} }, { "a", { alt = true, modifier = 8, alt_repeat_key = "a" } } }) do
  local result, text = run("21x21", "kf", entry[1], entry[2])
  assert(result == 1 and text == "科学科学", "Alt+A and uppercase A must repeat the same candidate")
end
for _, options in ipairs({
  { alt = true, modifier = 8 }, -- 未配置的方案不接管 Alt+A。
  { alt = true, modifier = 8, alt_repeat_key = "b" },
  { alt = true, modifier = 9, alt_repeat_key = "a" }, -- Alt+Shift。
  { alt = true, modifier = 12, alt_repeat_key = "a", ctrl = true },
  { alt = true, modifier = 8, alt_repeat_key = "a", release = true },
  { alt = true, modifier = 8, alt_repeat_key = "a", ascii_mode = true },
}) do
  local result, text = run("21x21", "kf", "a", options)
  assert(result == 2 and text == nil, "unbound or modified Alt keys must pass through")
end
local result, text = run("21x21", "kyfs", "a", {
  alt = true, modifier = 8, alt_repeat_key = "a", popping = true,
})
assert(result == 2 and text == nil, "Alt+A must retain the existing four-code abbreviation boundary")
print("abbreviation-longwords.test.lua: explicit continuation bypasses abbreviation independently of popping")
