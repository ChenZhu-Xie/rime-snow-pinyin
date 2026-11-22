package.path = "./lua/?.lua;" .. package.path
local current_calls = 0
package.loaded["snow.snow"] = {
  current = function(context) current_calls = current_calls + 1; return context.input end,
  placeholder = "<placeholder>",
}
rime_api = { regex_match = function() return false end }
Candidate = function(kind, start, finish, text, comment)
  return { type = kind, _start = start, _end = finish, text = text, comment = comment }
end
local filter = require "snow.postpone"
local segment = { start = 0, has_tag = function() return true end }
local context = {
  input = "", caret_pos = 0,
  get_option = function() return true end,
  get_property = function() return "" end,
  composition = { toSegmentation = function() return { back = function() return segment end } end },
}
local env = { engine = { context = context, schema = { config = {
  get_string = function(_, path)
    if path == "word_length/layout" then return "21x26" end
    if path == "speller/initials" then return "bpmfdtnlgkhjqwvxrzcsy" end
    return ""
  end,
} } } }
filter.init(env)

local function apply(input, words)
  context.input, context.caret_pos, segment._end = input, #input, #input
  local rows = {}
  for _, word in ipairs(words) do rows[#rows + 1] = Candidate("phrase", 0, #input, word, "") end
  if not filter.tags_match(segment, env) then return rows end
  local output, index = {}, 0
  yield = function(row) output[#output + 1] = row end
  filter.func({ iter = function() return function() index = index + 1; return rows[index] end end }, env)
  return output
end

apply("shrm", { "中华人民共和国", "中华人民共和国国务院" })
assert(apply("shrmG", { "中华人民共和国", "中华人民共和国国务院" })[1].text == "中华人民共和国",
  "a new initial refines the same long word and must not postpone its earlier completion")
assert(apply("shrmGHG", { "中华人民共和国", "中华人民共和国国务院" })[1].text == "中华人民共和国")
env.known_candidates = {}
apply("jnse", { "经常", "精髓" })
assert(apply("jnsei", { "经常", "精髓" })[1].text == "精髓", "auxiliary continuation must retain normal postponement")
for _, layout in ipairs({ "", "21x21" }) do
  local other_env = { engine = { context = context, schema = { config = {
    get_string = function(_, path) if path == "word_length/layout" then return layout end; return "" end,
  } } } }
  filter.init(other_env)
  local before = current_calls
  assert(filter.tags_match(segment, other_env), "other layouts retain normal postponement")
  assert(current_calls == before, "long-word routing must not inspect the current segment in other layouts")
end
print("postpone-longwords.test.lua: long-word initials preserve first choice; auxiliaries still postpone")
