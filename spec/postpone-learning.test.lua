package.path = "./lua/?.lua;" .. package.path

package.preload["snow.snow"] = function()
  return {
    current = function(context) return context.input end,
    placeholder = "<placeholder>",
  }
end

rime_api = { regex_match = function() return false end }
Candidate = function(kind, start, finish, text, comment)
  return { type = kind, _start = start, _end = finish, text = text, comment = comment }
end

local learned_priority = require "snow.learned_priority"
local postpone = require "snow.postpone"

local function candidate(text, length, learned, fixed)
  local kind = learned and "user_phrase" or "phrase"
  return {
    type = kind,
    text = text,
    comment = fixed and "📌" or "",
    _start = 0,
    _end = length,
    get_genuine = function()
      return { type = kind, to_phrase = function() return nil end }
    end,
  }
end

local segment = { start = 0, _end = 0, has_tag = function() return true end }
local context = {
  input = "",
  caret_pos = 0,
  get_property = function() return "" end,
  get_option = function() return true end,
  composition = { toSegmentation = function()
    return { back = function() return segment end }
  end },
}
local env = {
  known_candidates = {},
  disable = "",
  engine = { context = context },
}

local function translation(candidates)
  return { iter = function()
    local index = 0
    return function()
      index = index + 1
      return candidates[index]
    end
  end }
end

local function apply_postpone(input, candidates)
  context.input = input
  context.caret_pos = #input
  segment._end = #input
  local output = {}
  yield = function(value) table.insert(output, value) end
  postpone.func(translation(candidates), env)
  return output
end

local function apply_pipeline(input, candidates)
  return apply_postpone(input, learned_priority.prioritize(candidates, {}, {}, #input))
end

-- 试查继承后置顺序，但不得修改真实记录；包括清理较长记录和记录新首选。
env.known_candidates = { ["甲是"] = 2, ["旧词"] = 6 }
local old_get_property = context.get_property
context.get_property = function(_, name) return name == "snow_append_query" and "1" or "" end
local queried = apply_postpone("buki", { candidate("甲是", 4), candidate("乙是", 4) })
assert(queried[1].text == "乙是")
assert(env.known_candidates["甲是"] == 2 and env.known_candidates["旧词"] == 6)
assert(env.known_candidates["乙是"] == nil)
context.get_property = old_get_property
env.known_candidates = {}

-- 重现旧顺序：先后置、再提升用户词，会把「经常」重新抬回首选。
apply_postpone("jnse", { candidate("经常", 4, true), candidate("精髓", 4) })
local old = learned_priority.prioritize(apply_postpone("jnsei", {
  candidate("经常", 5, true), candidate("精髓", 5),
}), {}, {}, 5)
assert(old[1].text == "经常", "旧过滤链必须能够重现用户报告的重复首选")

-- 系统首选和学习首选不同时，必须记录最终展示给用户的那个首选。
env.known_candidates = {}
local result = apply_pipeline("jnse", {
  candidate("精髓", 4), candidate("经常", 4, true),
})
assert(result[1].text == "经常" and env.known_candidates["经常"] == 4)
result = apply_pipeline("jnsei", { candidate("经常", 5, true), candidate("精髓", 5) })
assert(result[1].text == "精髓" and result[2].text == "经常",
  "继续补辅后，已学习的旧首选也必须让出首位并保留为候选")

-- 退格回到短码重新恢复用户词首选，再补辅仍能正确后置。
result = apply_pipeline("jnse", { candidate("精髓", 4), candidate("经常", 4, true) })
assert(result[1].text == "经常")
result = apply_pipeline("jnsei", { candidate("经常", 5, true), candidate("精髓", 5) })
assert(result[1].text == "精髓")

-- 莲道的形辅和其他方案共用相同合同；固定候选保留位置。
env.known_candidates = {}
apply_pipeline("bzxd", { candidate("冰雪", 4, true), candidate("冰鞋", 4) })
result = apply_pipeline("bzxdv", {
  candidate("固定候选", 5, false, true),
  candidate("冰雪", 5, true),
  candidate("冰鞋", 5),
})
assert(result[1].text == "固定候选" and result[2].text == "冰鞋" and result[3].text == "冰雪")

-- 没有其他完整候选时，仍应允许旧首选留在首位。
env.known_candidates = {}
apply_pipeline("bzxd", { candidate("冰雪", 4, true) })
result = apply_pipeline("bzxdv", { candidate("冰雪", 5, true) })
assert(#result == 1 and result[1].text == "冰雪")

print("postpone-learning.test.lua: ok")
