package.path = "./lua/?.lua;" .. package.path

package.loaded["snow.snow"] = {
  prepare = function(candidate, proxy)
    candidate._end = candidate._start + #proxy:gsub("[ ?~]", "")
    return candidate
  end,
  comment = function(candidate, comment) candidate.comment = comment end,
}
package.loaded["snow.bihua"] = {}
local vacant = false
package.loaded["snow.vacancy"] = { is_empty = function() return vacant end }
package.loaded["snow.candidate_priority"] = {
  better_across_routes = function(a, b) return a.quality > b.quality end,
}

local translator = require "snow.shenyun"
local emitted, queries = {}, {}
yield = function(candidate) emitted[#emitted + 1] = candidate end

local env = {
  engine = { context = { get_property = function() return "" end } },
  initial_keys = "bpmfdtnlgkhjqwvxrzcsy",
  final_keys = "abcdefghijklmnopqrstuvwxyz",
  auxiliary_keys = "aeuio",
  auxiliary_mode = "shape",
  pair_standard_order = "12",
  auxiliary_cache = {
    ["科学发展\t"] = { "oa" },
    ["不到\tAA\t"] = { "eaeu" },
  },
}

local function query(input, rows)
  emitted, queries = {}, {}
  env.translator = { query = function(_, proxy)
    queries[#queries + 1] = proxy
    local source = rows[proxy] or {}
    local candidates = {}
    for _, row in ipairs(source) do
      candidates[#candidates + 1] = {
        text = row[1], type = row[2] or "phrase", _start = 2,
        _end = 2 + (row[3] or #proxy), comment = "", quality = 1,
      }
    end
    local index = 0
    return { iter = function() return function()
      index = index + 1
      return candidates[index]
    end end }
  end }
  translator.func(input, { start = 2, _end = 2 + #input }, env)
end

query("bpmf", { BPMF = {
  { "科学发展" }, { "科学发展观", "completion" },
  { "中华人民共和国", "completion" }, { "临时生成的句子", "sentence" },
} })
assert(#emitted == 3, "four-initial route must retain native long-word completions")
assert(emitted[1].text == "科学发展" and emitted[2].text == "科学发展观")
assert(emitted[1].preedit == "b p m f" and emitted[2].preedit == "b p m f")
assert(emitted[2]._start == 2 and emitted[2]._end == 6)

query("bpmfD", { BPMFD = {
  { "科学发展观" }, { "中华人民共和国", "completion" }, { "前缀", "phrase", 4 },
} })
assert(#emitted == 2 and emitted[1].text == "科学发展观", "uppercase fifth initial must continue a long word")
assert(emitted[1].preedit == "b p m f d" and emitted[1]._end == 7)
assert(#queries == 1 and queries[1] == "BPMFD", "native query must use equal-length uppercase initials without competing full-syllable edges")

query("bpmfDTN", { BPMFDTN = {
  { "中华人民共和国" }, { "中华人民共和国万岁", "completion" },
} })
assert(#emitted == 2 and emitted[1].preedit == "b p m f d t n", "seven-character continuation must not inherit the six-key auxiliary ceiling")

for _, input in ipairs({ "bpmfd", "bpmfA", "bpafD" }) do
  query(input, { bpmfd = { { "科学发展观" } } })
  assert(#emitted == 0, "ordinary lowercase or non-initial keys must not enter the explicit long-word route: " .. input)
end

query("bpmf", { ["bp mf"] = { { "科学发展观", "completion" } } })
assert(#emitted == 0, "two-syllable routes must not turn predictive long words into full two-character matches")

query("bpmfa", { BPMF = { { "科学发展观", "completion" } } })
assert(#emitted == 0, "four-character auxiliaries must not be incorrectly applied to a five-character completion")

vacant = true
query("bdeaeu", { ["b d"] = { { "不到" }, { "不到最后一刻", "completion" } } })
assert(#emitted == 1 and emitted[1].text == "不到", "vacant initial-pair routes must keep their exact two-character contract")

print("shenyun-longwords.test.lua: four-key completion, uppercase continuation, route isolation and native query lengths passed")
