package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path

package.loaded["snow.snow"] = {
  prepare = function(candidate) return candidate end,
}
package.loaded["snow.vacancy"] = {}

utf8 = { len = string.len }
rime_api = { regex_match = function() return true end }
yield = function() end

local table_like = require "snow.table_like"

local function empty_translation()
  return { iter = function() return function() return nil end end }
end

local queries = {}
local translator = {
  query = function(_, proxy)
    table.insert(queries, proxy)
    return empty_translation()
  end,
}

local context = {
  get_option = function() return true end,
  composition = { toSegmentation = function()
    return { get_at = function() return nil end }
  end },
}
local env = {
  translator = translator,
  pattern = "",
  pattern2 = "",
  preserve_t12_proxy_quality = false,
  engine = { context = context },
}
local segment = { start = 0, _end = 6 }

table_like.t12.func("btxkiu", segment, env)
assert(queries[#queries] == "bti xku", "two-character full code must assign tones first, second")

queries = {}
table_like.jianpin.func("erfaiu", segment, env)
assert(queries[1] == "e?ir?af?u", "three-character tone order must be second, first, third")

queries = {}
table_like.jianpin.func("wmxsui", segment, env)
assert(queries[1] == "wm?ux?is", "four-character tone order must start with second, third")

local selected = { get_genuine = function() return { type = "sanpin_partial" } end }
local previous = { _end = 2, get_selected_candidate = function() return selected end }
context.composition = { toSegmentation = function()
  return { get_at = function() return previous end }
end }
queries = {}
table_like.t12.func("xkiu", { start = 2, _end = 6 }, env)
assert(queries[1] == "xku", "selected-first continuation must skip the retained first-character tone")

print("table_like auxiliary-order tests passed")
