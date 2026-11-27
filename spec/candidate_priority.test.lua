package.path = "./lua/?.lua;./lua/?/init.lua;" .. package.path

local priority = require "snow.candidate_priority"

local function candidate(type_name, quality, consumed_length)
  return {
    type = type_name,
    quality = quality,
    _start = 0,
    _end = consumed_length,
    get_genuine = function(self) return { type = self.type } end,
  }
end

local system = candidate("phrase", 100, 4)
local user = candidate("user_phrase", 1, 4)
assert(priority.better_across_routes(user, system),
  "an exact user phrase must outrank a system phrase from another route")
assert(not priority.better_across_routes(system, user),
  "static quality must not erase cross-route user phrase priority")

priority.promote_exact_user_phrase(user, 4)
assert(user.quality > system.quality,
  "a wrapped translator must expose user phrase priority before engine merging")

local partial_user = candidate("user_phrase", 1, 3)
priority.promote_exact_user_phrase(partial_user, 4)
assert(partial_user.quality == 1, "a partial user phrase must not receive the exact-code bonus")

assert(priority.consumes_input(candidate("phrase", 1, 4), 4),
  "a candidate consuming all four input positions must be exact")
assert(not priority.consumes_input(candidate("phrase", 1, 2), 4),
  "a candidate consuming only the first syllable must be partial")

local function phrase_candidate(text, spellings)
  local phrase = {
    type = "phrase",
    entry = { code = spellings },
  }
  return {
    type = "phrase",
    text = text,
    get_genuine = function() return {
      type = "phrase",
      to_phrase = function() return phrase end,
    } end,
  }
end

local lookup_count = 0
local learned_memory = {
  decode = function(_, code) return code end,
  user_dict = {
    lookup_words = function(_, code, predictive, limit)
      lookup_count = lookup_count + 1
      local entries = code == "fang1 an4 xuan3 dan1" and not predictive and limit == 0
          and { { text = "方案选单", weight = -1 } } or {}
      return {
        iter = function()
          local index = 0
          return function()
            index = index + 1
            return entries[index]
          end
        end,
      }
    end,
  },
}
local learned_cache = {}
local hidden_user = phrase_candidate("方案选单", { "fang1", "an4", "xuan3", "dan1" })
assert(priority.is_learned_phrase(hidden_user, learned_memory, learned_cache),
  "a system phrase backed by the native user dictionary must be recognized as learned")
assert(priority.is_learned_phrase(hidden_user, learned_memory, learned_cache))
assert(lookup_count == 1, "learned phrase lookups must be cached")

local ordinary = phrase_candidate("九霄", { "jiu3", "xiao1" })
local readonly_memory = {
  decode = function() error("只读词典不应读取用户词权重") end,
}
assert(priority.user_phrase_weight(ordinary, readonly_memory, {}) == nil,
  "关闭用户词典时应直接保留系统词频，不能访问空的 user_dict")
assert(not priority.is_learned_phrase(ordinary, learned_memory, learned_cache))
ordinary.quality = 100
hidden_user.quality = 1
assert(priority.better_across_routes(hidden_user, ordinary, learned_memory, {}),
  "a learned phrase hidden by deduplication must win during route merging")
assert(not priority.better_across_routes(ordinary, hidden_user, learned_memory, {}),
  "static route quality must not beat a phrase found in the native user dictionary")

local current_code = ""
local weighted_memory = {
  decode = function(_, code) return code end,
  user_dict = {
    lookup_words = function(_, code)
      current_code = code
      local entries = current_code == "fang1 an4 xuan3 dan1"
          and { { text = "方案选单", weight = -1 } }
          or { { text = "九霄", weight = -5 } }
      return {
        iter = function()
          local index = 0
          return function()
            index = index + 1
            return entries[index]
          end
        end,
      }
    end,
  },
}
assert(priority.better_across_routes(hidden_user, ordinary, weighted_memory, {}),
  "the more strongly learned phrase must win when both routes contain user phrases")
assert(not priority.better_across_routes(ordinary, hidden_user, weighted_memory, {}),
  "a lower user weight must not fall back to the higher static route quality")

local same_code_calls = 0
local entries = {
  { text = "不是", weight = -7 }, { text = "布市", weight = 0 },
  { text = "不是", weight = -2 },
}
local same_code_memory = {
  decode = function(_, code) return code end,
  user_dict = { lookup_words = function(_, code, predictive, limit)
    assert(code == "bu4 shi4" and not predictive and limit == 0)
    same_code_calls = same_code_calls + 1
    return { iter = function()
      local index = 0
      return function() index = index + 1; return entries[index] end
    end }
  end },
}
local same_code_cache = {}
local function weight(text, cache)
  return priority.user_phrase_weight(phrase_candidate(text, { "bu4", "shi4" }),
    same_code_memory, cache or same_code_cache)
end
assert(weight("不适") == nil)
assert(weight("不是") == -2 and weight("布市") == 0)
assert(weight("部室") == nil and same_code_calls == 1,
  "同码查询须一次缓存所有词的最大权重，以及未学习的同音词")
entries = { { text = "不是", weight = 3 } }
assert(weight("不是", {}) == 3 and same_code_calls == 2,
  "调用方重建缓存后必须读取新学习权重")
entries = {}
same_code_cache = {}
assert(weight("不是") == nil and weight("布市") == nil and same_code_calls == 3,
  "同码空结果也只查一次")
print("candidate_priority.test.lua: ok")
