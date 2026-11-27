package.path = "./lua/?.lua;" .. package.path
local append = require "snow.append_shi"
local bu = { code = "bhvk", readings = { bu4 = true } }
local bi = { code = "bkvk", readings = { bi4 = true } }
local function run(options)
  options = options or {}
  local properties = { shape_input = "", snow_postpone_known = options.known or "" }
  local committed, cleared, queries = nil, false, 0
  local context = setmetatable({
    composition = { toSegmentation = function() return { back = function()
      return { start = 0, _end = 1, has_tag = function() return true end,
        menu = setmetatable({}, { __index = function() error("must not read menus") end }) }
    end } end },
    get_property = function(_, key) return properties[key] or "" end,
    set_property = function(_, key, value) properties[key] = value end,
    get_option = function(_, key) return key == "popping" or key == "traditionalization" and options.traditional end,
    clear = function() assert(committed); cleared = true end,
    select = function() error("must not select or learn") end,
    commit = function() error("must not trigger commit_notifier") end,
  }, {
    __index = function(_, key) if key == "input" then return "b" elseif key == "caret_pos" then return 1 end end,
    __newindex = function() error("must not rewrite input") end,
  })
  log = { error = function(message) error(message) end }
  local env = { engine = { context = context, commit_text = function(_, text) committed = text end },
    shi_routes = { b = options.routes or { bu, bi } },
    shi_words = options.words or { bu4 = { ["不是"] = 100, ["不适"] = 99999 }, bi4 = { ["必是"] = 10 } },
    shi_fixed = { dict = options.pins or {} },
    shi_pinyin = { lookup = function(_, text) return text == "布" and "bu4" or "ma1" end },
    shi_converter = { convert_text = function(_, text) return text == "还是" and "還是" or text end },
    shi_memory = { user_dict = { lookup_words = function(_, code, predictive, limit)
      assert(not predictive and limit == 0)
      queries = queries + 1
      local values = (options.users or {})[code] or {}
      return { iter = function()
        local index = 0
        return function() index = index + 1; return values[index] end
      end }
    end } },
  }
  local result = append.commit(env)
  assert(result == (committed ~= nil) and cleared == result)
  if result then assert(properties.direct_commit_text == committed and properties.commit_text == committed) end
  return committed, queries
end
assert(run() == "不是")
assert(run({ pins = { bhvk = { "不适" } } }) == "不是")
assert(run({ pins = { bkvk = { "必是" } } }) == "必是")
assert(run({ users = { ["bi4 shi4"] = { { text = "必是", weight = -5 } } } }) == "必是")
assert(run({ users = { ["bu4 shi4"] = { { text = "不是", weight = 0 } },
  ["bi4 shi4"] = { { text = "必是", weight = -1 } } } }) == "不是")
assert(run({ known = "1\t不是" }) == "必是")
assert(run({ known = "1\t不是", pins = { bhvk = { "不是" } } }) == "不是")
assert(run({ words = {}, users = { ["bu4 shi4"] = { { text = "布是", weight = 0 } } } }) == "布是")
assert(run({ words = {}, pins = { bhvk = { "布是", "妈是" } } }) == "布是")
assert(run({ words = {}, pins = { bhvk = { "妈是" } } }) == nil)
assert(run({ words = {} }) == nil)
assert(run({ words = { bu4 = { ["还是"] = 1 } }, traditional = true }) == "還是")
local _, count = run({ routes = { bu, bu, bi } })
assert(count == 2, "同一次按键的重复读音只查一次，下一次重新读用户库")
assert(run({ words = { bu4 = { ["不是"] = 1 }, bi4 = { ["必是"] = 1 } } }) == "不是")
print("append_shi: direct dictionary ranking passed")
