package.path = "./lua/?.lua;" .. package.path

local auxiliary_hint = require "snow.auxiliary_hint"

assert(auxiliary_hint.next_codes({ "ui", "uo" }, "") == "ui/uo")
assert(auxiliary_hint.next_codes({ "ui", "uo" }, "u") == "i/o")

assert(auxiliary_hint.format_preedit("dk jw", "ui", "shape", { 1, 2 }) == "dk jw 形[ui]")
assert(auxiliary_hint.format_preedit("dk jw", "ui", "tone", { 1, 2 }) == "dku jwi")

assert(auxiliary_hint.format_preedit("d k jw", "ui", "tone", { 2, 1 }) == "di ku jw")

assert(auxiliary_hint.format_preedit("dk", "uia", "tone", { 1 }) == "dku 笔[ia]")

print("shenyun_hint.test.lua: ok")
