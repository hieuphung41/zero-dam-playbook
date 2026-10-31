// Build a walking-cost raster from the official map crop (2400x2100) and write a debug PNG.
const fs=require('fs'), path=require('path');
const jpeg=require(path.join(process.argv[2],'node_modules/jpeg-js')), {PNG}=require(path.join(process.argv[2],'node_modules/pngjs'));
const src=process.argv[3], out=process.argv[4];
const img=jpeg.decode(fs.readFileSync(src), {useTArray:true});
const W=img.width, H=img.height, d=img.data;
const lum=new Float32Array(W*H), blu=new Float32Array(W*H);
for(let i=0;i<W*H;i++){ const r=d[i*4],g=d[i*4+1],b=d[i*4+2]; lum[i]=(r*0.3+g*0.59+b*0.11); blu[i]=b-(r+g)/2; }
// integral images for mean / variance over a (2k+1)^2 window
function integral(a){ const I=new Float64Array((W+1)*(H+1)); for(let y=1;y<=H;y++){ let row=0; for(let x=1;x<=W;x++){ row+=a[(y-1)*W+(x-1)]; I[y*(W+1)+x]=I[(y-1)*(W+1)+x]+row; } } return I; }
const sq=new Float32Array(W*H); for(let i=0;i<W*H;i++) sq[i]=lum[i]*lum[i];
const I1=integral(lum), I2=integral(sq);
function boxStats(x,y,k){ const x0=Math.max(0,x-k), y0=Math.max(0,y-k), x1=Math.min(W,x+k+1), y1=Math.min(H,y+k+1); const n=(x1-x0)*(y1-y0);
  const s=I1[y1*(W+1)+x1]-I1[y0*(W+1)+x1]-I1[y1*(W+1)+x0]+I1[y0*(W+1)+x0]; const s2=I2[y1*(W+1)+x1]-I2[y0*(W+1)+x1]-I2[y1*(W+1)+x0]+I2[y0*(W+1)+x0];
  const m=s/n; return [m, Math.sqrt(Math.max(0,s2/n-m*m))]; }
// white edge-line density (road borders are dashed white lines)
const wh=new Float32Array(W*H); for(let i=0;i<W*H;i++) wh[i]=lum[i]>150?1:0; const Iw=integral(wh);
function boxMean(I,x,y,k){ const x0=Math.max(0,x-k), y0=Math.max(0,y-k), x1=Math.min(W,x+k+1), y1=Math.min(H,y+k+1); return (I[y1*(W+1)+x1]-I[y0*(W+1)+x1]-I[y1*(W+1)+x0]+I[y0*(W+1)+x0])/((x1-x0)*(y1-y0)); }
// cost classes at 2px grid
const G=2, GW=W/G|0, GH=H/G|0; const cost=new Float32Array(GW*GH); const cls=new Uint8Array(GW*GH);
for(let gy=0;gy<GH;gy++) for(let gx=0;gx<GW;gx++){ const x=gx*G, y=gy*G; const i=y*W+x;
  const [m,sd]=boxStats(x,y,2); const wd=boxMean(Iw,x,y,14); const b=blu[i];
  let c, k;
  if(b>8 && m<70){ c=1e6; k=1; }                                   // water
  else if(m>150){ c=30; k=2; }                                      // white wall / outline
  else if(sd<7 && m>60 && m<140 && wd>0.02 && wd<0.30){ c=1; k=3; } // smooth surface bounded by white lines: road / yard
  else if(sd<7 && m>60 && m<140){ c=3; k=4; }                       // smooth but no lines nearby: open ground / slope
  else if(m<45){ c=12; k=5; }                                       // shadow / cliff
  else { c=7; k=6; }                                                // rock
  cost[gy*GW+gx]=c; cls[gy*GW+gx]=k; }
fs.writeFileSync(out+'.json', JSON.stringify({G,GW,GH,cost:Array.from(cost)}));
// debug png
const png=new PNG({width:GW,height:GH}); const pal={1:[20,40,120],2:[255,255,255],3:[80,200,80],4:[160,210,120],5:[40,40,40],6:[120,90,70]};
for(let i=0;i<GW*GH;i++){ const p=pal[cls[i]]; png.data[i*4]=p[0];png.data[i*4+1]=p[1];png.data[i*4+2]=p[2];png.data[i*4+3]=255; }
fs.writeFileSync(out+'.png', PNG.sync.write(png));
const hist={}; cls.forEach(k=>hist[k]=(hist[k]||0)+1); console.log('classes', hist, 'grid', GW, GH);
