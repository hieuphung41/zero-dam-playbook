const fs=require('fs'), vm=require('vm');
const any=new Proxy(function(){}, {get:(t,k)=>k==='then'?undefined:(k===Symbol.toPrimitive?(()=>0):any), apply:()=>any, construct:()=>any});
const el=()=>({addEventListener(){}, appendChild(){}, querySelector:()=>el(), querySelectorAll:()=>[], classList:{remove(){},add(){},toggle(){}}, innerHTML:'', textContent:'', dataset:{}, hidden:false});
const document={querySelector:()=>el(), querySelectorAll:()=>[], createElement:()=>el(), getElementById:()=>el()};
const ctx={window:{}, document, L:any, console}; ctx.window.document=document; vm.createContext(ctx);
for(const f of ['data.js','paths.js','poi.js']) vm.runInContext(fs.readFileSync(process.argv[2]+'/'+f,'utf8'), ctx);
vm.runInContext('var ZD=window.ZD;'+fs.readFileSync(process.argv[2]+'/app.js','utf8'), ctx);
const plan=ctx.window.ZDplan; const sp=process.argv[3]||'s2';
for(const n of [1,2,3]){ const r=plan({spawn:sp,mode:'normal',keys:[],stops:n,maxLootMin:n===1?8:(n===2?14:20),avoid:1,weightLimit:false});
  console.log(`== ${n} cụm: ${r.route.join('>')} | ${Math.round(r.tMin)} ph, ${Math.round(r.dist)} m, loot ${r.value/1000}k, sống ${r.pSurv.toFixed(2)}, EV ${Math.round(r.ev/1000)}k, phí ${r.extract.fee}`);
  r.legs.forEach(l=>console.log(`   ${l.id}: đi ${Math.round(l.m)} m (${l.t.toFixed(1)} ph), áp lực ${l.pressure.toFixed(2)}, p chết ${(l.p*100).toFixed(0)}%, loot ${l.value/1000}k`));
  console.log('   rút', r.extract.n.letter, 'p chết', (r.extract.p*100).toFixed(0)+'%');
}
const r=plan({spawn:sp,mode:'normal',keys:[],stops:1,maxLootMin:8}); console.log('áp lực các cụm từ', sp, Object.entries(r.pressure).map(([k,v])=>k+':'+v.toFixed(2)).join(' '));
