// Dijkstra on the cost raster (+ hand-traced road corridors + risk zones) for every pair of planner nodes.
const fs=require('fs'), path=require('path'), vm=require('vm');
const [,, root, site, costFile, roadsFile, outFile] = process.argv;
const {PNG}=require(path.join(root,'node_modules/pngjs'));
const C=JSON.parse(fs.readFileSync(costFile,'utf8')); const {G,GW,GH}=C; const base=Float32Array.from(C.cost);
const roads=JSON.parse(fs.readFileSync(roadsFile,'utf8')).roads;
const ctx={window:{}}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(site,'data.js'),'utf8'), ctx);
const ZD=ctx.window.ZD; const CROP={x:900,y:650,w:2400,h:2100};
const toCell=p=>[Math.round(p[0]*CROP.w/G), Math.round(p[1]*CROP.h/G)];
const pxToCell=(x,y)=>[Math.round((x-CROP.x)/G), Math.round((y-CROP.y)/G)];
// road corridors: cost 0.6 within 4 cells of a traced polyline
const cost=Float32Array.from(base); const road=new Uint8Array(GW*GH);
function stamp(x0,y0,x1,y1,r){ const n=Math.ceil(Math.hypot(x1-x0,y1-y0)); for(let i=0;i<=n;i++){ const x=x0+(x1-x0)*i/n, y=y0+(y1-y0)*i/n; for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){ if(dx*dx+dy*dy>r*r) continue; const cx=Math.round(x+dx), cy=Math.round(y+dy); if(cx<0||cy<0||cx>=GW||cy>=GH) continue; const k=cy*GW+cx; if(cost[k]<1e5){ road[k]=1; } } } }
roads.forEach(rd=>{ for(let i=1;i<rd.pts.length;i++){ const a=pxToCell(...rd.pts[i-1]), b=pxToCell(...rd.pts[i]); stamp(a[0],a[1],b[0],b[1],4); } });
for(let k=0;k<GW*GH;k++) if(road[k]) cost[k]=Math.min(cost[k],0.6);
// risk zones (multiply): id -> radius px4096, factor
const zones=[['adminW',230,2.2],['adminE',230,2.2],['adminOut',200,1.6],['vault',160,2.2],['mainSub',210,1.5],['boss',120,2.5]];
const risk=new Float32Array(GW*GH).fill(1);
zones.forEach(([id,r,f])=>{ const n=ZD.nodes.find(n=>n.id===id); const [cx,cy]=toCell(n.p); const rc=r/G; for(let y=Math.max(0,cy-rc);y<=Math.min(GH-1,cy+rc);y++) for(let x=Math.max(0,cx-rc);x<=Math.min(GW-1,cx+rc);x++){ if((x-cx)**2+(y-cy)**2<=rc*rc){ const k=y*GW+x; risk[k]=Math.max(risk[k],f); } } });
// Admin rush zone: cells within 200 px (4096 map) of the Admin clusters, used to measure how much of a path crosses it
const rushCell=new Uint8Array(GW*GH);
['adminW','adminE','adminOut'].forEach(id=>{ const n=ZD.nodes.find(n=>n.id===id); const [cx,cy]=toCell(n.p); const rc=200/G;
  for(let y=Math.max(0,Math.floor(cy-rc));y<=Math.min(GH-1,Math.ceil(cy+rc));y++) for(let x=Math.max(0,Math.floor(cx-rc));x<=Math.min(GW-1,Math.ceil(cx+rc));x++) if((x-cx)**2+(y-cy)**2<=rc*rc) rushCell[y*GW+x]=1; });
// binary heap
class Heap{constructor(){this.a=[];}push(v,k){const a=this.a;a.push([v,k]);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p][0]<=a[i][0])break;[a[p],a[i]]=[a[i],a[p]];i=p;}}pop(){const a=this.a;const t=a[0];const l=a.pop();if(a.length){a[0]=l;let i=0;for(;;){const L=2*i+1,R=L+1;let m=i;if(L<a.length&&a[L][0]<a[m][0])m=L;if(R<a.length&&a[R][0]<a[m][0])m=R;if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m;}}return t;}get size(){return this.a.length;}}
const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
function dijkstra(sx,sy){ const dist=new Float64Array(GW*GH).fill(Infinity), prev=new Int32Array(GW*GH).fill(-1); const h=new Heap(); const s=sy*GW+sx; dist[s]=0; h.push(0,s);
  while(h.size){ const [d,k]=h.pop(); if(d>dist[k]) continue; const x=k%GW, y=(k/GW)|0; for(const [dx,dy,l] of NB){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=GW||ny>=GH) continue; const nk=ny*GW+nx; const c=cost[nk]; if(c>=1e5) continue; const nd=d+l*(c*risk[nk]+cost[k]*risk[k])/2; if(nd<dist[nk]){ dist[nk]=nd; prev[nk]=k; h.push(nd,nk); } } }
  return {dist,prev}; }
const nodes=ZD.nodes.filter(n=>n.type!=='wp' && n.type!=='boss'); const cells=nodes.map(n=>toCell(n.p));
function simplify(pts,eps){ if(pts.length<3) return pts; const sq=(p,a,b)=>{ const dx=b[0]-a[0],dy=b[1]-a[1]; const t=dx||dy?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy):0; const u=Math.max(0,Math.min(1,t)); return (p[0]-a[0]-u*dx)**2+(p[1]-a[1]-u*dy)**2; };
  let maxd=0,idx=0; for(let i=1;i<pts.length-1;i++){ const d=sq(pts[i],pts[0],pts[pts.length-1]); if(d>maxd){maxd=d;idx=i;} }
  if(maxd>eps*eps){ const a=simplify(pts.slice(0,idx+1),eps), b=simplify(pts.slice(idx),eps); return a.slice(0,-1).concat(b); } return [pts[0],pts[pts.length-1]]; }
const MPP=0.396*G; // metres per cell: official map = 81086 cm per 2048 px, 0.396 m/px
const out={}; const t0=Date.now();
for(let i=0;i<nodes.length;i++){ const [sx,sy]=cells[i]; const {dist,prev}=dijkstra(sx,sy);
  for(let j=i+1;j<nodes.length;j++){ const [tx,ty]=cells[j]; const tk=ty*GW+tx; if(dist[tk]===Infinity){ console.error('unreachable', nodes[i].id, nodes[j].id); continue; }
    const pts=[]; let k=tk; while(k!==-1){ pts.push([k%GW,(k/GW)|0]); k=prev[k]; } pts.reverse();
    let m=0, rz=0; for(let q=1;q<pts.length;q++){ const d=Math.hypot(pts[q][0]-pts[q-1][0], pts[q][1]-pts[q-1][1]); m+=d; if(rushCell[pts[q][1]*GW+pts[q][0]]) rz+=d; } m*=MPP; rz*=MPP;
    const sp=simplify(pts,1.5).map(p=>[Math.round(p[0]*G), Math.round(p[1]*G)]); // crop px
    out[nodes[i].id+'|'+nodes[j].id]={w:Math.round(dist[tk]*MPP), m:Math.round(m), rz:Math.round(rz), pts:sp}; }
  process.stderr.write(`${nodes[i].id} done (${((Date.now()-t0)/1000).toFixed(0)}s)\n`); }
fs.writeFileSync(outFile, '/* generated by mapscripts/pathfind.js: raster shortest paths between planner nodes; pts in crop px (2400x2100), w = risk-weighted metres, m = metres, rz = metres inside the Admin rush zone */\nwindow.ZDPATHS='+JSON.stringify(out)+';\n');
// debug png: cost classes + roads + a few paths
const png=new PNG({width:GW,height:GH}); for(let k=0;k<GW*GH;k++){ let c=cost[k]; let col=c>=1e5?[20,40,120]:c<=0.6?[255,255,255]:c<=1.5?[90,200,90]:c<=3?[150,200,110]:c<=7?[120,90,70]:c<=12?[40,40,40]:[230,230,230]; if(risk[k]>1&&c<1e5) col=[Math.min(255,col[0]+60),col[1]*0.6,col[2]*0.6]; png.data[k*4]=col[0];png.data[k*4+1]=col[1];png.data[k*4+2]=col[2];png.data[k*4+3]=255; }
const drawPath=(key,col)=>{ const p=out[key]; if(!p) return; for(let q=1;q<p.pts.length;q++){ const a=p.pts[q-1].map(v=>v/G), b=p.pts[q].map(v=>v/G); const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])); for(let i=0;i<=n;i++){ const x=Math.round(a[0]+(b[0]-a[0])*i/n), y=Math.round(a[1]+(b[1]-a[1])*i/n); for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const k=(y+dy)*GW+(x+dx); if(k>=0&&k<GW*GH){ png.data[k*4]=col[0];png.data[k*4+1]=col[1];png.data[k*4+2]=col[2]; } } } } };
drawPath('s1|cement',[255,100,0]); drawPath('cement|xG',[255,0,200]); drawPath('s13|smallSub',[0,200,255]); drawPath('s4|mainSub',[255,255,0]); drawPath('s8|visitor',[255,0,0]); drawPath('s12|xF',[0,255,0]); drawPath('pipeline|xG',[255,150,255]); drawPath('s6|xB',[255,255,255]);
fs.writeFileSync(outFile.replace(/\.js$/,'_debug.png'), PNG.sync.write(png));
console.log('pairs', Object.keys(out).length, 'bytes', fs.statSync(outFile).size);
