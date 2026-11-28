package.path = "./lua/?.lua;" .. package.path

local sbs = require "snow.sbs"
local initials, auxiliaries = "bpmfdtnlgkhjqwvxrzcsy", "aeuio"
local function route(input, length, proxy, suffix)
  local actual_length, actual_proxy, actual_suffix = sbs.route(input, initials, auxiliaries)
  assert(actual_length == length and actual_proxy == proxy and actual_suffix == suffix, input)
end
route("bef", 3, "B?F", "e")
route("befo", 3, "B?F", "eo")
route("befoau", 3, "B?F", "eoau")
route("befg", 4, "B?FG", "e")
route("befgoa", 4, "B?FG", "eoa")
for _, input in ipairs({ "be", "bpf", "aef", "beF", "befoaue", "befoag", "befgaX" }) do
  assert(sbs.route(input, initials, auxiliaries) == nil, input)
end
assert(sbs.codes({ { "oa" }, { "eu" }, { "ia" } }, 3)[1] == "eoui")
assert(sbs.codes({ { "oa" }, { "eu" }, { "ia" }, { "au" } }, 4)[1] == "eoa")
assert(sbs.codes({ { "oa" }, { "e" }, { "ia" } }, 3)[1] == "eo",
  "missing second auxiliary must stop before the third character, without padding or sliding")
local variants = sbs.codes({ { "o" }, { "ea", "eu" }, { "i" } }, 3)
assert(#variants == 2 and variants[1] == "eoai" and variants[2] == "eoui")

local prepared = 0
package.loaded["snow.snow"] = {
  prepare = function(candidate, proxy)
    prepared = prepared + 1
    candidate._end = candidate._start + #proxy:gsub("[ ?~]", "")
    return candidate
  end,
  comment = function(candidate, comment) candidate.comment = comment end,
}
package.loaded["snow.vacancy"] = { is_empty = function(code) return code == "fg" end }
package.loaded["snow.bihua"] = { codes = function(character)
  return character == "乙" and { "34", "51" } or { "1" }
end }
package.loaded["snow.candidate_priority"] = {
  better_across_routes = function(a, b) return a.quality > b.quality end,
}
local translator = require "snow.shenyun"
local env = {
  engine = { context = { get_property = function() return "" end } },
  initial_keys = initials, final_keys = "abcdefghijklmnopqrstuvwxyz", auxiliary_keys = auxiliaries,
  auxiliary_mode = "shape", pair_standard_order = "12", auxiliary_cache = {}, shape_cache = {},
  shape_elements = { lookup = function(_, c) return c end },
  shape_mapping = { ["甲"] = "oa", ["乙"] = "vu", ["丙"] = "ia", ["丁"] = "au" },
  memory = { decode = function(_, code) return code end },
}
local emitted, queries = {}, {}
yield = function(candidate) emitted[#emitted + 1] = candidate end
local function query(input, sources)
  emitted, queries = {}, {}
  env.translator = { query = function(_, proxy)
    queries[#queries + 1] = proxy
    local rows, index = sources[proxy] or {}, 0
    return { iter = function() return function()
      index = index + 1
      local row = rows[index]
      if not row then return nil end
      local candidate = { text = row[1], _start = 2, _end = 2 + (row[3] or #proxy),
        quality = row[2] or 1, type = "phrase", comment = "" }
      candidate.get_genuine = function(self) return self end
      candidate.to_phrase = function() return { entry = { code = row[4] or { "jia3", "yi2", "bing1", "ding1" } } } end
      return candidate
    end end }
  end }
  translator.func(input, { start = 2, _end = 2 + #input }, env)
end
query("bef", { ["be f"] = { { "二字", 2 } }, ["B?F"] = { { "甲乙丙", 1 } } })
assert(#emitted == 2 and emitted[1].text == "二字" and emitted[2].text == "甲乙丙")
assert(emitted[2]._end == 5 and emitted[2].preedit == "b · f 形[e]")
assert(emitted[2].comment:find("形₂₁₂₃", 1, true))
query("befo", { ["be fo"] = { { "二字", 2 } }, ["B?F"] = { { "甲乙丙", 1 } } })
assert(#emitted == 2 and emitted[2].text == "甲乙丙", "fourth B continues three-word branch alongside full two-word code")
query("befoui", { ["B?F"] = { { "甲乙丙" }, { "甲乙丙丁", 1 }, { "短", 1, 1 } } })
assert(#emitted == 1 and emitted[1].text == "甲乙丙" and emitted[1]._end == 8)
query("befgoa", { ["B?FG"] = { { "甲乙丙丁" }, { "甲乙丙", 1 }, { "长词补全候选", 1 } } })
assert(#emitted == 1 and emitted[1].text == "甲乙丙丁" and emitted[1]._end == 8)
assert(emitted[1].comment == "", "all 214 auxiliaries already consumed")
query("befoua", { ["B?F"] = { { "甲乙丙" } } })
assert(#emitted == 0, "wrong final auxiliary must remove the target")
query("befg", { ["B?F"] = { { "甲乙丙" } }, ["B?FG"] = { { "甲乙丙丁" } } })
assert(#emitted == 1 and emitted[1].text == "甲乙丙丁", "fourth S switches to four-character route")
query("bofoui", { ["B?F"] = { { "甲乙丙" } } })
assert(#emitted == 0, "second-key auxiliary is mandatory")

-- Tone mode must use the word's real reading, then the same character's allowed first stroke.
env.auxiliary_mode, env.auxiliary_cache = "tone", {}
query("befuui", { ["B?F"] = { { "甲乙丙" } } })
assert(#emitted == 1 and emitted[1].text == "甲乙丙")
assert(emitted[1].preedit == "b · f 调笔[euui]")
env.auxiliary_cache = {}
query("befuai", { ["B?F"] = { { "甲乙丙" } } })
assert(#emitted == 1, "the other permitted first stroke must also be available")
env.auxiliary_cache = {}
query("bifoui", { ["B?F"] = { { "甲乙丙" } } })
assert(#emitted == 0, "a different tone must not match the same polyphonic text through a different reading")
print("SBS: 2123/214, partial pairs, merged native candidates, full consumption, tone/stroke variants and vacancy independence passed")
