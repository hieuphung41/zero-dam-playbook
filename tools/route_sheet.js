// Render the planner's default route for every spawn onto the map crop (one PNG per spawn) for visual review.
const fs=require('fs'),vm=require('vm'),path=require('path');
const site=process.argv[2], out=process.argv[3], mods=process.argv[4];
const {PNG}=require(path.join(mods,'node_modules/pngjs')); const jpeg=require(path.join(mods,'node_modules/jpeg-js'));
const any=new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:(k===Symbol.toPrimitive?(()=>0):any),apply:()=>any,construct:()=>any});
const el=()=>({addEventListener(){},appendChild(){},querySelector:()=>el(),querySelectorAll:()=>[],classList:{remove(){},add(){},toggle(){}},innerHTML:'',textContent:'',dataset:{},hidden:false,open:true,value:''});
const document={querySelector:()=>el(),querySelectorAll:()=>[],createElement:()=>el(),getElementById:()=>el()};
const ctx={window:{matchMedia:()=>({matches:false})},document,L:any,console};ctx.window.document=document;vm.createContext(ctx);
for(const f of ['data.js','paths.js','poi.js'])vm.runInContext(fs.readFileSync(path.join(site,f),'utf8'),ctx);
vm.runInContext('var ZD=window.ZD;'+fs.readFileSync(path.join(site,'app.js'),'utf8'),ctx);
const Z=ctx.window.ZD, P=ctx.window.ZDPATHS; const node=id=>Z.nodes.find(n=>n.id===id);
const img=jpeg.decode(fs.readFileSync(path.join(site,'zero-dam.jpg')),{useTArray:true}); const W=img.width,H=img.height;
const geom=(a,b)=>{ const p=P[a+'|'+b]; if(p) return p.pts; const q=P[b+'|'+a]; return q? q.pts.slice().reverse() : [[node(a).p[0]*W,node(a).p[1]*H],[node(b).p[0]*W,node(b).p[1]*H]]; };
const sc=0.5, OW=Math.round(W*sc), OH=Math.round(H*sc);
for(const sp of Z.nodes.filter(n=>n.type==='spawn').map(n=>n.id)){
  const r=ctx.window.ZDplan({spawn:sp,mode:'normal',keys:[],stops:2,maxLootMin:14,avoid:1,weightLimit:false,forced:[],payMode:'none',contractReward:10000});
  const png=new PNG({width:OW,height:OH});
  for(let y=0;y<OH;y++) for(let x=0;x<OW;x++){ const si=((Math.floor(y/sc))*W+Math.floor(x/sc))*4, di=(y*OW+x)*4; for(let c=0;c<3;c++) png.data[di+c]=Math.min(255,img.data[si+c]*1.35); png.data[di+3]=255; }
  const dot=(x,y,rr,col)=>{ for(let dy=-rr;dy<=rr;dy++) for(let dx=-rr;dx<=rr;dx++){ if(dx*dx+dy*dy>rr*rr) continue; const X=Math.round(x+dx),Y=Math.round(y+dy); if(X<0||Y<0||X>=OW||Y>=OH) continue; const i=(Y*OW+X)*4; png.data[i]=col[0];png.data[i+1]=col[1];png.data[i+2]=col[2]; } };
  const line=(a,b,col)=>{ const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])); for(let i=0;i<=n;i++) dot(a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n, 2, col); };
  for(let i=1;i<r.route.length;i++){ const g=geom(r.route[i-1],r.route[i]).map(q=>[q[0]*sc,q[1]*sc]); for(let k=1;k<g.length;k++) line(g[k-1],g[k],i%2?[255,90,0]:[255,220,0]); }
  r.route.forEach((id,k)=>{ const n=node(id); dot(n.p[0]*W*sc,n.p[1]*H*sc,7,k===0?[40,120,255]:n.type==='extract'?[30,200,90]:[200,0,200]); });
  fs.writeFileSync(path.join(out,`route_${sp}.png`), PNG.sync.write(png));
  console.log(sp, r.route.join(' > '));
}
