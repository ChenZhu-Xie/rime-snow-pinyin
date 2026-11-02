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
}
package.loaded["snow.bihua"] = {}
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

print("shape_filter Keytao word-order tests passed")
