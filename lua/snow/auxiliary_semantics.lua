-- 由 scripts/generate-auxiliary-semantics.ts 根据 config/shenyun-21x*.json 生成，请勿手改。
-- shape_keys_by_meaning：折、横、撇、竖、点；tone_keys_by_tone：一、二、三、四、轻；
-- stroke_keys_by_stroke：横、竖、撇、点、折。

---@class AuxiliarySemanticMapping
---@field shape_keys_by_meaning string
---@field tone_keys_by_tone string
---@field stroke_keys_by_stroke string
---@field tone_digits_by_shape_meaning string
---@field tone_keys_by_digit table<string, string>
---@field stroke_keys_by_digit table<string, string>

---@type table<string, AuxiliarySemanticMapping>
local semantics = {
  ["21x21"] = {
    shape_keys_by_meaning = "avuio",
    tone_keys_by_tone = "ivuao",
    stroke_keys_by_stroke = "viuoa",
    tone_digits_by_shape_meaning = "42310",
    tone_keys_by_digit = { ["1"] = "i", ["2"] = "v", ["3"] = "u", ["4"] = "a", ["5"] = "o" },
    stroke_keys_by_digit = { ["1"] = "v", ["2"] = "i", ["3"] = "u", ["4"] = "o", ["5"] = "a" },
  },
  ["21x26"] = {
    shape_keys_by_meaning = "aeuio",
    tone_keys_by_tone = "ieuao",
    stroke_keys_by_stroke = "eiuoa",
    tone_digits_by_shape_meaning = "42310",
    tone_keys_by_digit = { ["1"] = "i", ["2"] = "e", ["3"] = "u", ["4"] = "a", ["5"] = "o" },
    stroke_keys_by_digit = { ["1"] = "e", ["2"] = "i", ["3"] = "u", ["4"] = "o", ["5"] = "a" },
  },
}

return semantics
