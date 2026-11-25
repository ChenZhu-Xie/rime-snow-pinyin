package.path = "./lua/?.lua;" .. package.path
package.preload["snow.snow"] = function() return {kAccepted=1,kNoop=2} end
function KeyEvent(s) return {release=function() return false end,eq=function(_,other)return s==other.name end,name=s} end
local function notifier()
 local callbacks={}
 return {connect=function(_,fn) callbacks[#callbacks+1]=fn; return {disconnect=function()callbacks={}end} end,emit=function(...)for _,fn in ipairs(callbacks)do fn(...)end end}
end
local ctx={character=false,option_update_notifier=notifier(),commit_notifier=notifier()}
function ctx:get_option()return self.character end
function ctx:set_option(name,value)self.character=value;self.option_update_notifier.emit(self,name)end
function ctx:has_menu()return true end
local env={engine={context=ctx}}
local p=require "snow.qingyun_mode"
p.init(env)
ctx:set_option("character",true)
ctx.commit_notifier.emit(ctx)
assert(ctx.character,"菜单单字模式必须上屏后保持")
p.func(KeyEvent("Shift+Tab"),env)
assert(not ctx.character,"Shift+Tab 临时转字词")
ctx.commit_notifier.emit(ctx)
assert(ctx.character,"临时字词上屏后恢复菜单选择的单字")
ctx:set_option("character",false)
p.func(KeyEvent("Shift+Tab"),env)
assert(ctx.character)
ctx.commit_notifier.emit(ctx)
assert(not ctx.character,"临时单字上屏后恢复菜单选择的字词")
p.fini(env)
print("qingyun_mode.test.lua: ok")
