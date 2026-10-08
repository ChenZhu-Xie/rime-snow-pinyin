'use strict';
const {chromium}=require('../node_modules/playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disable-gpu','--allow-file-access-from-files']});
 try{
  const page=await browser.newPage();
  await page.goto('file:///D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/a7_CKT_R11.html',{waitUntil:'domcontentloaded',timeout:120000});
  page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
  await page.waitForFunction(()=>typeof D!=='undefined'&&D.completionBV2&&typeof uxRenderFair==='function',null,{timeout:120000});
  const inspect=()=>page.evaluate(()=>{
   uxRenderFair();
   const ids=['uxTau','uxFirstAuxPenalty','uxSecondAuxPenalty'];
   const sliders=ids.map(id=>[id,document.getElementById(id)?.type,document.getElementById(id)?.value]);
   const geometry=()=>ids.map(id=>{const box=document.getElementById(id).getBoundingClientRect();return [box.x,box.y,box.width]});
   const before=geometry();
   const base=bCompletionV2Row({id:'S005'});
   const score=bCompletionScoreV2(base,bCompletionTau(),bCompletionFirstAuxPenalty(),bCompletionSecondAuxPenalty(),base);
   const frontier=bCompletionV2Row({id:'BCW-dcfeac16a87b'});
   const frontierScore=bCompletionScoreV2(frontier,bCompletionTau(),bCompletionFirstAuxPenalty(),bCompletionSecondAuxPenalty(),base);
   const fixed=bCompletionFixedRow({id:'BCW-b6d79577771b'});
   const fixedScore=bCompletionScore(fixed,bCompletionTau(),2,bCompletionFixedRow({id:'S005'}));
   const after=[];
   for(const id of ids){
    const slider=document.getElementById(id);
    slider.value=slider.min;
    slider.dispatchEvent(new Event('change',{bubbles:true}));
    after.push(geometry());
    slider.value=slider.max;
    slider.dispatchEvent(new Event('change',{bubbles:true}));
    after.push(geometry());
   }
   return {sliders,before,after,score,frontierScore,fixedScore,schemes:Object.keys(D.completionBV2.schemes).length};
  });
  const desktop=await inspect();
  await page.setViewportSize({width:390,height:844});
  const mobile=await inspect();
  const expected=[['uxTau','range','600'],['uxFirstAuxPenalty','range','300'],['uxSecondAuxPenalty','range','300']];
  if(JSON.stringify(desktop.sliders)!==JSON.stringify(expected)||desktop.score!==10||Math.abs(desktop.frontierScore-9.327230884856213)>1e-9||Math.abs(desktop.fixedScore-9.13099980253348)>1e-9||desktop.schemes<645||desktop.after.some(box=>JSON.stringify(box)!==JSON.stringify(desktop.before))||mobile.after.some(box=>JSON.stringify(box)!==JSON.stringify(mobile.before)))throw Error(JSON.stringify({desktop,mobile}));
  console.log(JSON.stringify({desktop,mobile}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
