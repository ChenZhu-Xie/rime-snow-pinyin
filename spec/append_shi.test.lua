package.path = "./lua/?.lua;" .. package.path
local append = require "snow.append_shi"

local function candidate(text, reading, pinned, quality, learned)
  local result = { text = text, comment = pinned and "📌" or "", quality = quality or 0,
    type = learned and "user_phrase" or "phrase", _start = 0, _end = 4 }
  result.get_genuine = function() return result end
  result.to_phrase = function() return { entry = { code = { reading, "shi4" } } } end
  return result
end

local function run(menus, routes, original, fail, user_words, fixed_words)
  local value = "b"
  local properties = { shape_input = "", snow_append_query = "" }
  local selected, committed
  local queried = {}
  local function segment()
    local candidates = value == "b" and { candidate(original or "不", "bu4") } or menus[value] or {}
    local menu = {
      prepare = function(_, size) return math.min(size, #candidates) end,
      get_candidate_at = function(_, index) return candidates[index + 1] end,
    }
    return { start = 0, _end = #value, selected_index = 0, menu = menu,
      has_tag = function() return true end,
      get_candidate_at = menu.get_candidate_at }
  end
  local context = setmetatable({
    get_property = function(_, name) return properties[name] end,
    set_property = function(_, name, text) properties[name] = text end,
    composition = { toSegmentation = function() return { back = segment } end },
    highlight = function(_, index) selected = index end,
    select = function(_, index) selected = index; return true end,
    commit = function() committed = menus[value][selected + 1].text end,
  }, {
    __index = function(_, key) if key == "input" then return value elseif key == "caret_pos" then return #value end end,
    __newindex = function(_, key, next_value)
      assert(key == "input")
      if fail and next_value == fail then error("query failure") end
      value = next_value
      queried[#queried + 1] = value
    end,
  })
  log = { error = function() end }
  local env = { engine = { context = context }, shi_routes = { b = routes },
    shi_memory = { decode = function(_, code) return code end },
    shi_fixed = { dict = fixed_words or {} } }
  if user_words then
    env.shi_memory.user_dict = { lookup_words = function(_, code)
      return { iter = function()
        local index = 0
        return function() index = index + 1; return (user_words[code] or {})[index] end
      end }
    end }
  end
  local result = append.commit(env)
  assert(properties.snow_append_query == "", "scope must be restored")
  return result, committed, value, queried
end

local bu = { code = "buki", readings = { bu4 = true } }
local bi = { code = "biki", readings = { bi4 = true } }
local function check(expected, menus, routes, original)
  local result, committed = run(menus, routes or { bu }, original)
  assert(result and committed == expected, "expected " .. expected .. ", got " .. tostring(committed))
end
check("不是", { buki = { candidate("不适", "bu4", true, 999), candidate("不是", "bu4") } })
check("必是", { buki = { candidate("不是", "bu4", false, 100) }, biki = { candidate("必是", "bi4", true) } }, { bu, bi })
check("必是", { buki = { candidate("不是", "bu4", false, 100) }, biki = { candidate("必是", "bi4", false, 1, true) } }, { bu, bi })
-- 菜单已完成后置；不能再按 quality 把该路第二个匹配词提前。
check("不是", { buki = { candidate("不是", "bu4", false, 1), candidate("布是", "bu4", false, 100) } })
check("不是", { buki = { candidate("必是", "bi4", false, 999), candidate("不是", "bu4") } })
check("不是", { buki = { candidate("不是", "bu4") } }, { bu }, "不同")
local result, committed, input = run({ buki = { candidate("不适", "bu4") } }, { bu })
assert(not result and not committed and input == "b", "empty query must restore input")
result, committed, input = run({}, { bu }, nil, "buki")
assert(not result and not committed and input == "b", "failed query must restore input")
local absent = { code = "buki", readings = { bu4 = true }, system = false }
local _, _, _, queried = run({}, { absent })
assert(#queried == 1 and queried[1] == "b", "absent routes must not compose a menu")
result, committed = run({ buki = { candidate("不是", "bu4") } }, { absent }, nil, nil,
  { ["bu4 shi4"] = { { text = "不是" } } })
assert(result and committed == "不是", "new user words must bypass static absence")
result, committed = run({ buki = { candidate("不是", "bu4", true) } }, { absent }, nil, nil,
  nil, { buki = { "不是" } })
assert(result and committed == "不是", "pinned words must bypass static absence")
local learned_bu = candidate("不是", "bu4", false, 10, true)
result, committed, input, queried = run({ buki = { learned_bu }, biki = { candidate("必是", "bi4") } },
  { bi, bu }, nil, nil, { ["bu4 shi4"] = { { text = "不是", weight = 10 } } })
assert(result and committed == "不是")
for _, code in ipairs(queried) do assert(code ~= "biki", "unlearned route cannot beat a learned winner") end
print("append_shi: passed")
