package.path = "./lua/?.lua;" .. package.path
local aux = require "snow.initial_pair_aux"

local options = { { "aiox" }, { "uova", "iuea" } }
assert(table.concat(aux.codes(options, "12"), "/") == "uoai/iuai")
assert(table.concat(aux.codes(options, "21"), "/") == "aiuo/aiiu")
local codes = aux.codes(options, "21")
local matched, _, comment = aux.match(codes, "a", "shape", "21")
assert(matched and comment == "〔形₁₁₂₂ iu/ii〕")
assert(select(3, aux.match(codes, "aiu", "shape", "21")) == "〔形₁₁₂₂ o〕")
assert(select(3, aux.match(codes, "aiuo", "shape", "21")) == "")
assert(not aux.match(codes, "aiuoa", "shape", "21"))
local rejected, rejected_prompt, rejected_comment = aux.match(codes, "aiuoa", "shape", "21")
assert(not rejected and rejected_prompt == " 形[aiuoa]" and rejected_comment == "")
assert(select(3, aux.match({ "uoai" }, "", "tone", "12")) == "〔调笔₂₂₁₁ uo〕")
assert(aux.codes({ { "ai" }, { "u" } }, "12")[1] == "u")
assert(not pcall(aux.codes, options, "11"))
print("声声二字词：标准 12/21 反向、四辅边界、逐级两辅提示通过")
