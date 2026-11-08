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
  user_lookup = function(_, code, predictive)
    lookup_count = lookup_count + 1
    return code == "fang1 an4 xuan3 dan1" and not predictive
  end,
  iter_user = function()
    local entries = { { text = "方案选单" } }
    local index = 0
    return function()
      index = index + 1
      return entries[index]
    end
  end,
}
local learned_cache = {}
local hidden_user = phrase_candidate("方案选单", { "fang1", "an4", "xuan3", "dan1" })
assert(priority.is_learned_phrase(hidden_user, learned_memory, learned_cache),
  "a system phrase backed by the native user dictionary must be recognized as learned")
assert(priority.is_learned_phrase(hidden_user, learned_memory, learned_cache))
assert(lookup_count == 1, "learned phrase lookups must be cached")

local ordinary = phrase_candidate("九霄", { "jiu3", "xiao1" })
assert(not priority.is_learned_phrase(ordinary, learned_memory, learned_cache))
ordinary.quality = 100
hidden_user.quality = 1
assert(priority.better_across_routes(hidden_user, ordinary, learned_memory, {}),
  "a learned phrase hidden by deduplication must win during route merging")
assert(not priority.better_across_routes(ordinary, hidden_user, learned_memory, {}),
  "static route quality must not beat a phrase found in the native user dictionary")

print("candidate_priority.test.lua: ok")
