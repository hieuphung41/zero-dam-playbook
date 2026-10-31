const fs=require('fs'); const vm=require('vm');
const any=new Proxy(function(){}, {get:(t,k)=>k==='then'?undefined:(k===Symbol.toPrimitive?(()=>0):any), apply:()=>any, construct:()=>any});
const el=()=>({addEventListener(){}, appendChild(){}, querySelector:()=>el(), querySelectorAll:()=>[], classList:{remove(){},add(){},toggle(){}}, innerHTML:'', textContent:'', dataset:{}, hidden:false});
const document={querySelector:()=>el(), querySelectorAll:()=>[], createElement:()=>el(), getElementById:()=>el()};
const ctx={window:{}, document, L:any, console};
ctx.window.document=document;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2]+'/data.js','utf8'), ctx);
vm.runInContext(fs.readFileSync(process.argv[2]+'/paths.js','utf8'), ctx);
vm.runInContext(fs.readFileSync(process.argv[2]+'/poi.js','utf8'), ctx);
vm.runInContext('var ZD=window.ZD;'+fs.readFileSync(process.argv[2]+'/app.js','utf8'), ctx);
const plan=ctx.window.ZDplan;
const cases=[{spawn:'s1',mode:'normal',keys:[],stops:2},{spawn:'s13',mode:'normal',keys:['dorm'],stops:2},{spawn:'s8',mode:'normal',keys:[],stops:2},{spawn:'s6',mode:'easy',keys:[],stops:2,weightLimit:true},{spawn:'s4',mode:'normal',keys:['tech'],stops:1},{spawn:'s12',mode:'normal',keys:[],stops:3}];
for(const c of cases){ const r=plan(Object.assign({weightLimit:false},c));
  const probs=Object.entries(r.probs).filter(([k,v])=>v>0).map(([k,v])=>k+':'+Math.round(v*100)).join(' ');
  console.log(JSON.stringify({spawn:c.spawn,mode:c.mode,keys:c.keys,route:r.route.join('>'),t:Math.round(r.tMin),dist:Math.round(r.dist),value:r.value,surv:+r.pSurv.toFixed(2),ev:Math.round(r.ev/1000)+'k',probs})); }
// options for s1
const o=[1,2,3].map(n=>{ const r=plan({spawn:'s1',mode:'normal',keys:[],stops:n,maxLootMin:n===1?8:(n===2?14:20)}); return n+':'+r.route.join('>')+' ev='+Math.round(r.ev/1000)+'k surv='+r.pSurv.toFixed(2); }); console.log(o.join('\n'));
