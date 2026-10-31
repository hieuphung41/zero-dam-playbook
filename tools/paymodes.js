const fs=require('fs'),vm=require('vm');
const any=new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:(k===Symbol.toPrimitive?(()=>0):any),apply:()=>any,construct:()=>any});
const el=()=>({addEventListener(){},appendChild(){},querySelector:()=>el(),querySelectorAll:()=>[],classList:{remove(){},add(){},toggle(){}},innerHTML:'',textContent:'',dataset:{},hidden:false,open:true,value:''});
const document={querySelector:()=>el(),querySelectorAll:()=>[],createElement:()=>el(),getElementById:()=>el()};
const ctx={window:{matchMedia:()=>({matches:false})},document,L:any,console};ctx.window.document=document;vm.createContext(ctx);
for(const f of ['data.js','paths.js','poi.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
vm.runInContext('var ZD=window.ZD;'+fs.readFileSync('app.js','utf8'),ctx);
const Z=ctx.window.ZD, nm=id=>{const n=Z.nodes.find(n=>n.id===id); return n.type==='spawn'?n.name.split(' ')[0]:n.type==='extract'?n.letter:n.name.split(' (')[0];};
const run=(lab,st)=>{ const r=ctx.window.ZDplan(Object.assign({mode:'normal',keys:[],stops:2,maxLootMin:14,avoid:1,weightLimit:false,forced:[],payMode:'none',contractReward:10000,allowDrop:false},st));
  const ex=r.extract; const c=ex&&ex.contracts&&ex.contracts.length?` +${ex.contracts.length} hợp đồng`:'';
  console.log(lab.padEnd(34), r.route.slice(1).map(nm).join(' > ').padEnd(46), (r.tMin.toFixed(1)+' ph').padStart(8), ('sống '+Math.round(r.pSurv*100)+'%').padStart(9), ('EV '+Math.round(r.ev/1000)+'k').padStart(8)+c);
  return r; };
for(const sp of (process.argv[2]||'s4,s8,s13').split(',')){
  run(nm(sp)+' Thường, không đủ',{spawn:sp});
  run(nm(sp)+' Thường, không đủ, <30kg',{spawn:sp,weightLimit:true}); run(nm(sp)+' Thường, không đủ, bỏ ba lô',{spawn:sp,allowDrop:true});
  const r=run(nm(sp)+' Thường, làm hợp đồng 10k',{spawn:sp,payMode:'contracts'});
  if(!(r.extract.contracts||[]).length){ const g=r.alternatives.find(a=>a.n.id==='xG'); if(g) console.log('   G bị loại vì:', g.why.join('; ')); }
  run(nm(sp)+' Thường, làm hợp đồng 20k',{spawn:sp,payMode:'contracts',contractReward:20000});
  run(nm(sp)+' Thường, đã có đủ',{spawn:sp,payMode:'have'});
  run(nm(sp)+' Dễ, làm hợp đồng',{spawn:sp,mode:'easy',payMode:'contracts'});
  console.log('');
}
