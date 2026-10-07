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
    return ({ X = "rs", Y = "tu" })[char]
  end },
  shape_mapping = { r = "a", s = "i", t = "b", u = "o" },
}

local match, _, comment = filter.handle_candidate("XY", "ab", env)
assert(match and comment == "ab", "full two-character Keytao code must be first B then second B")
assert(not filter.handle_candidate("XY", "ba", env), "reverse B order must not match")

context.current = "b"
match, _, comment = filter.handle_candidate("XY", "bo", env)
assert(match and comment == "", "630 shorthand must keep its separate second-character rule")

print("shape_filter Keytao word-order tests passed")
