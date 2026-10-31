const fs=require('fs'); const vm=require('vm');
const any=new Proxy(function(){}, {get:(t,k)=>k==='then'?undefined:(k===Symbol.toPrimitive?(()=>0):any), apply:()=>any, construct:()=>any});
const el=()=>({addEventListener(){}, appendChild(){}, querySelector:()=>el(), querySelectorAll:()=>[], classList:{remove(){},add(){},toggle(){}}, innerHTML:'', textContent:'', dataset:{}, hidden:false});
const document={querySelector:()=>el(), querySelectorAll:()=>[], createElement:()=>el(), getElementById:()=>el()};
const ctx={window:{}, document, L:any, console};
ctx.window.document=document;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2]+'/data.js','utf8'), ctx);
vm.runInContext(fs.readFileSync(process.argv[2]+'/paths.js','utf8'), ctx);
vm.runInContext('var ZD=window.ZD;'+fs.readFileSync(process.argv[2]+'/app.js','utf8'), ctx);
const plan=ctx.window.ZDplan;
const cases=[{spawn:'s1',mode:'normal',keys:[],stops:2},{spawn:'s13',mode:'normal',keys:['dorm'],stops:2},{spawn:'s8',mode:'normal',keys:[],stops:2},{spawn:'s6',mode:'easy',keys:[],stops:2,weightLimit:true},{spawn:'s4',mode:'normal',keys:['tech'],stops:1},{spawn:'s12',mode:'normal',keys:[],stops:3}];
for(const c of cases){ const r=plan(Object.assign({weightLimit:false},c));
  console.log(JSON.stringify({spawn:c.spawn,mode:c.mode,keys:c.keys,stops:r.stops,extract:r.extract&&r.extract.n.letter+(r.extract.ok?'':'(!)'),t:Math.round(r.tMin),value:r.value,route:r.route.join('>')})); }
