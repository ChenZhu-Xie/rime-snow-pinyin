package.path = "./lua/?.lua;" .. package.path
local cache_query = require "snow.sbs_query"
local cache = cache_query.new()
local queries, generated = 0, 0
local prefix = 10
local source_rows = {}
ShadowCandidate = function(candidate, kind)
  return setmetatable({ type = kind, _start = candidate._start, _end = candidate._end,
    quality = candidate.quality, text = candidate.text }, { __index = {
      get_genuine = function() return candidate end,
    } })
end
local native = { query = function(_, proxy, segment)
  queries = queries + 1
  local state = { cursor = 0 }
  state.iter = function()
    return function(actual)
      assert(actual == state, "native iterator requires its owning Translation")
      state.cursor = state.cursor + 1
      if state.cursor > 3 then return nil end
      generated = generated + 1
      local row = { text = proxy .. state.cursor, type = "phrase", _start = segment.start,
        _end = segment.start + #proxy, quality = prefix + state.cursor,
        comment = "native", preedit = proxy }
      source_rows[#source_rows + 1] = row
      return row
    end
  end
  return state
end }
local segment = { start = 2 }
local state, iterator = cache_query.open(cache, native, "B?F", segment)
local first = iterator(state)
assert(queries == 1 and generated == 1 and first.text == "B?F1")
first._end, first.quality = 99, -1
first:get_genuine().comment = "changed"
first:get_genuine().preedit = "changed"
local state2, iterator2 = cache_query.open(cache, native, "B?F", segment)
local again = iterator2(state2)
assert(queries == 1 and generated == 1, "extension/backspace must reuse the same lazy native query")
assert(again._end == 5 and again.quality == 11, "prepare must never corrupt cached raw length or quality")
assert(again:get_genuine().comment == "native" and again:get_genuine().preedit == "B?F")
assert(iterator2(state2).text == "B?F2" and iterator2(state2).text == "B?F3")
assert(iterator2(state2) == nil and generated == 3)
local state3, iterator3 = cache_query.open(cache, native, "B?F", segment)
assert(iterator3(state3).text == "B?F1" and queries == 1, "exhausted native stream can still replay all retained rows")
cache_query.open(cache, native, "B?FG", segment)
cache_query.open(cache, native, "R?G", segment)
assert(#cache.keys == 2 and cache.entries["2\tB?F"] == nil, "retain at most two recent sound skeletons")
cache_query.open(cache, native, "R?G", { start = 4 })
assert(queries == 4, "buffered segments must not share raw candidate offsets")
cache_query.clear(cache)
prefix = 20
local state4, iterator4 = cache_query.open(cache, native, "R?G", segment)
assert(queries == 5 and iterator4(state4).quality == 21, "commit/deletion invalidation must refresh native user weights")

-- Storage cap bounds retained candidates, never the candidate stream itself.
local large = { query = function()
  local translation = { count = 0 }
  translation.iter = function() return function(actual)
    assert(actual == translation)
    actual.count = actual.count + 1
    if actual.count > 8200 then return nil end
    return { text = "x" .. actual.count, type = "phrase", _start = 0, _end = 3,
      quality = 1, comment = "", preedit = "" }
  end end
  return translation
end }
cache_query.clear(cache)
local large_state, large_iterator = cache_query.open(cache, large, "B?F", { start = 0 })
local count = 0
while large_iterator(large_state) do count = count + 1 end
assert(count == 8200 and #cache.entries["0\tB?F"].rows == 8192)
assert(not cache.entries["0\tB?F"].reusable)
local fresh = cache_query.open(cache, large, "B?F", { start = 0 })
assert(fresh ~= large_state, "oversized buckets must requery rather than lose uncached candidates")
print("sbs_query.test.lua: lazy reuse, immutable ranking, native state, offsets, invalidation and non-truncating storage cap passed")
