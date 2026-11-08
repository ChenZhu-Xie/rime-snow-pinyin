package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path

-- The test uses ASCII glyphs as stand-ins for two Han characters; only B order matters.
utf8 = {
  codes = function(value)
    local index = 0
    return function()
      index = index + 1
      if index <= #value then return index, value:byte(index) end
    end
  end,
  char = string.char,
  len = string.len,
}

package.loaded["snow.snow"] = {
  current = function(context) return context.current end,
  sub = function(value, first, last) return value:sub(first, last) end,
}
package.loaded["snow.bihua"] = {
  codes = function() return { "12G" }, true end,
}
rime_api = { regex_match = function() return false end }

local filter = require "snow.shape_filter"
local context = {
  current = "bkxh",
  composition = { toSegmentation = function()
    return { back = function() return nil end }
  end },
}
local env = {
  engine = { schema = { schema_id = "snow_jiandao" }, context = context },
  shape_elements = { lookup = function(_, char)
    return ({ X = "rs", Y = "tu", Z = "vw", W = "xy" })[char]
  end },
  shape_mapping = { r = "a", s = "i", t = "b", u = "o", v = "c", w = "u", x = "d", y = "e" },
  jiandao_shape_cache = {},
}

local function active_state(current)
  return {
    id = "snow_jiandao",
    current = current,
    is_pinyin = false,
    show_chaifen = false,
    initial_pair = false,
    jiandao_active = true,
  }
end

local match, _, comment = filter.handle_candidate("XY", "ab", env, active_state("bkxh"))
assert(match and comment == "ab", "full two-character Keytao code must be first B then second B")
assert(not filter.handle_candidate("XY", "ba", env, active_state("bkxh")), "reverse B order must not match")

context.current = "xyz"
match, _, comment = filter.handle_candidate("XYZ", "bca", env, active_state("xyz"))
assert(match and comment == "bca", "three-character Keytao order must be second, third, first")

context.current = "xyzw"
match, _, comment = filter.handle_candidate("XYZW", "bd", env, active_state("xyzw"))
assert(match and comment == "bd", "four-character Keytao order must stop after second, fourth")

context.current = "b"
match, _, comment = filter.handle_candidate("XY", "bo", env, active_state("b"))
assert(match and comment == "", "630 shorthand must keep its separate second-character rule")

local sanpin_state = {
  id = "snow_sanpin",
  current = "bkxh",
  sanpin_initial_pair = false,
  sanpin_passthrough = false,
}
match, _, comment = filter.handle_candidate("X", "vi", {}, sanpin_state)
assert(match and comment == "vi", "Three-Code B2 must map horizontal-vertical strokes to VI")
assert(not filter.handle_candidate("X", "iv", {}, sanpin_state),
  "Three-Code B2 must not reuse the IV tone-key order for horizontal-vertical strokes")

local tone_env = {
  pinyin = { lookup = function(_, char)
    return ({ X = "x1", Y = "y2", Z = "z3", W = "w4" })[char] or ""
  end },
}
sanpin_state.current = "bx"
match, _, comment = filter.handle_candidate("X", "", tone_env, sanpin_state)
assert(match and comment == "〔调 i〕", "two-code character must hint its next tone key")

tone_env.memory = { decode = function() return { "x4" } end }
local exact_candidate = {
  get_genuine = function()
    return { to_phrase = function() return { entry = { code = "ignored" } } end }
  end,
}
match, _, comment = filter.handle_candidate("X", "", tone_env, sanpin_state, exact_candidate)
assert(match and comment == "〔调 a〕", "candidate spelling must override polyphonic fallback tones")
tone_env.memory = nil

sanpin_state.current = "xyz"
match, _, comment = filter.handle_candidate("XYZ", "", tone_env, sanpin_state)
assert(match and comment == "〔调₂₁₃ vi〕",
  "three-initial word must hint the next two tones in 2-1-3 order")

local classic_state = {
  id = "snow_sanpin_classic",
  current = "xyzw",
  sanpin_initial_pair = false,
  sanpin_passthrough = true,
}
match, _, comment = filter.handle_candidate("XYZW", "", tone_env, classic_state)
assert(match and comment == "〔调₂₃ vu〕",
  "classic four-initial word must use the schema's IVUAO tone keys in 2-3 order")

print("shape_filter Keytao word-order tests passed")
