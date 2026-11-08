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

print("candidate_priority.test.lua: ok")
