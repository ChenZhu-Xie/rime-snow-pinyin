-- 使用真实过滤器核对「实际展示首选」连续让位，并保留固定项。
package.path = "./lua/?.lua;" .. package.path
package.loaded["snow.snow"] = {
  current = function(context) return context.input end,
  placeholder = "∅",
}
rime_api = { regex_match = function() return false end }
Candidate = function(kind, start, finish, text, comment)
  return { type = kind, _start = start, _end = finish, text = text, comment = comment }
end
Opencc = function()
  return { convert_text = function(_, text) return text == "麽" and "么" or text end }
end
local simplified = require "snow.simplified"
local postpone = require "snow.postpone"
local segment = { start = 0, _end = 0 }
local context = {
  input = "", caret_pos = 0,
  get_property = function() return "" end,
  get_option = function() return false end,
  composition = { toSegmentation = function() return { back = function() return segment end } end },
}
local shape_env = { engine = { context = context } }
simplified.init(shape_env)
local postpone_env = { known_candidates = {}, disable = "", engine = { context = context } }
local function translation(rows)
  return { iter = function()
    local index = 0
    return function() index = index + 1; return rows[index] end
  end }
end
local function collect(component, rows, env)
  local output = {}
  yield = function(candidate) output[#output + 1] = candidate end
  component.func(translation(rows), env)
  return output
end
local function step(code, fixed)
  context.input, context.caret_pos, segment._end = code, #code, #code
  local rows = {}
  for _, text in ipairs({ "摩", "魔", "麽", "磨" }) do
    rows[#rows + 1] = Candidate("phrase", 0, #code, text, "")
  end
  rows = collect(simplified, rows, shape_env)
  -- 固定项应当在默认字形排序之后插入，不能被默认字形偏好挪走。
  if fixed then table.insert(rows, 1, Candidate("fixed", 0, #code, fixed, "📌")) end
  return collect(postpone, rows, postpone_env)
end
assert(step("mjv")[1].text == "摩")
assert(step("mjvo")[1].text == "魔")
assert(step("mjvov")[1].text == "磨", "下游不能把新首选麽移走后又显示旧首选魔")
assert(postpone_env.known_candidates["磨"] == 5)
postpone_env.known_candidates = {}
assert(step("mjv", "麽")[1].text == "麽", "固顶优先于默认简体字形排序")
simplified.fini(shape_env)
print("postpone-display-order.test.lua: displayed first choices advance; fixed choices stay pinned")
