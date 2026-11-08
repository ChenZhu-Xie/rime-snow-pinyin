package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path

package.loaded["snow.snow"] = {
  prepare = function(candidate, proxy)
    local proxy_segment = proxy:sub(1, candidate._end - candidate._start)
    candidate._end = candidate._start + proxy_segment:gsub("[ ?~]", ""):len()
    return candidate
  end,
}
package.loaded["snow.vacancy"] = {}

utf8 = { len = string.len }
rime_api = { regex_match = function(_, pattern) return pattern ~= "never" end }
local yielded = {}
yield = function(candidate) table.insert(yielded, candidate) end

local table_like = require "snow.table_like"

local queries = {}
local query_candidates = {}
local translator = {
  query = function(_, proxy)
    table.insert(queries, proxy)
    local index = 0
    return { iter = function() return function()
      index = index + 1
      return query_candidates[index]
    end end }
  end,
}

local options = { popping = true, buffered = false }
local context = {
  get_option = function(_, name) return options[name] or false end,
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

local function candidate(text, consumed_length)
  return {
    type = "phrase",
    text = text,
    quality = 0,
    _start = 0,
    _end = consumed_length,
    get_genuine = function() return { type = "phrase" } end,
  }
end

query_candidates = { candidate("AB", 4), candidate("A", 2) }
yielded = {}
table_like.main.func("jdhz", { start = 0, _end = 4 }, env)
assert(#yielded == 1 and yielded[1].text == "AB",
  "non-buffered keydao popping must reject a partial single-character candidate")

options.buffered = true
yielded = {}
table_like.main.func("jdhz", { start = 0, _end = 4 }, env)
assert(#yielded == 2, "buffered keydao input must retain partial candidates")
options.buffered = false

options.popping = false
query_candidates = { candidate("AB", 4), candidate("A", 2) }
yielded = {}
table_like.main.func("jdhz", { start = 0, _end = 4 }, env)
assert(#yielded == 2, "sentence-mode keydao input must retain partial candidates")
options.popping = true

env.pattern = "never"
env.pattern2 = "always"
query_candidates = { candidate("AB", 5), candidate("A", 2) }
yielded = {}
table_like.t12.func("jdhz", { start = 0, _end = 4 }, env)
assert(#yielded == 1 and yielded[1].text == "AB",
  "non-buffered sanpin popping must reject a partial single-character candidate")

query_candidates = { candidate("AB", 6), candidate("A", 3) }
yielded = {}
table_like.t12.func("jdhzi", { start = 0, _end = 5 }, env)
assert(#yielded == 1 and yielded[1].text == "AB",
  "sanpin auxiliary input must not restore a partial single-character candidate")

options.buffered = true
yielded = {}
table_like.t12.func("jdhz", { start = 0, _end = 4 }, env)
assert(#yielded == 2, "buffered sanpin input must retain partial candidates")
options.buffered = false

options.popping = false
env.pattern = "always"
env.pattern2 = "never"
query_candidates = { candidate("AB", 4), candidate("A", 2) }
yielded = {}
table_like.t12.func("jdhz", { start = 0, _end = 4 }, env)
assert(#yielded == 2, "sentence-mode sanpin input must retain partial candidates")
options.popping = true
env.pattern = ""
env.pattern2 = ""
query_candidates = {}

table_like.t12.func("btxki", segment, env)
assert(queries[#queries] == "bti xk", "two-character first auxiliary must belong to the first character")

queries = {}
table_like.t12.func("btxkiu", segment, env)
assert(queries[#queries] == "bti xku", "two-character full code must assign tones first, second")

queries = {}
table_like.jianpin.func("erfaiu", segment, env)
assert(queries[1] == "e?ir?af?u", "three-character tone order must be second, first, third")

queries = {}
table_like.jianpin.func("wmxsui", segment, env)
assert(queries[1] == "wm?ux?is", "four-character tone order must start with second, third")

queries = {}
table_like.jianpin.func("wmxsuiu", segment, env)
assert(queries[1] == "wm?ux?is", "four-character tone order must ignore auxiliaries beyond two")

local selected = { get_genuine = function() return { type = "sanpin_partial" } end }
local previous = { _end = 2, get_selected_candidate = function() return selected end }
context.composition = { toSegmentation = function()
  return { get_at = function() return previous end }
end }
queries = {}
table_like.t12.func("xkiu", { start = 2, _end = 6 }, env)
assert(queries[1] == "xku", "selected-first continuation must skip the retained first-character tone")

print("table_like auxiliary-order tests passed")
