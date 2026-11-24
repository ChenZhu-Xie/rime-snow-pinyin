package.path = "./lua/?.lua;" .. package.path
local completion = require "snow.shape_completion"
for code, expected in pairs({ a = "aa", o = "oo", ua = "uaa", oi = "oii", ova = "ovaa", vvii = "vvii", [""] = "" }) do
  assert(completion.single(code) == expected, code)
end
print("单字短部件重复末码，空码和完整四辅保持原样")
