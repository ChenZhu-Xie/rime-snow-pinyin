'use strict';
const {chromium}=require('../node_modules/playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disable-gpu','--allow-file-access-from-files']});
 try{
  const page=await browser.newPage();
  await page.goto('file:///D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/a7_CKT_R11.html',{waitUntil:'domcontentloaded',timeout:120000});
  page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
  await page.waitForFunction(()=>typeof D!=='undefined'&&D.completionBV2&&typeof uxRenderFair==='function',null,{timeout:120000});
  const result=await page.evaluate(()=>{
   uxRenderFair();
   const ids=['uxTau','uxFirstAuxPenalty','uxSecondAuxPenalty'];
   const sliders=ids.map(id=>[id,document.getElementById(id)?.type,document.getElementById(id)?.value]);
   const base=bCompletionV2Row({id:'S005'});
   const score=bCompletionScoreV2(base,bCompletionTau(),bCompletionFirstAuxPenalty(),bCompletionSecondAuxPenalty(),base);
   document.getElementById('uxFirstAuxPenalty').value='125';
   document.getElementById('uxFirstAuxPenalty').dispatchEvent(new Event('change',{bubbles:true}));
   return {sliders,score,firstAfter:UX.firstAuxPenalty,selectionAfter:UX.tau,secondAfter:UX.secondAuxPenalty,schemes:Object.keys(D.completionBV2.schemes).length};
  });
  if(JSON.stringify(result.sliders)!==JSON.stringify([['uxTau','range','500'],['uxFirstAuxPenalty','range','100'],['uxSecondAuxPenalty','range','150']])||result.score!==10||result.firstAfter!=='125'||result.schemes!==577)throw Error(JSON.stringify(result));
  console.log(JSON.stringify(result));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
