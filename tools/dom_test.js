// Functional DOM test of the planner page with jsdom + real Leaflet: click a spawn marker, expect a route polyline.
const fs=require('fs'), path=require('path');
const root=process.argv[2], site=process.argv[3];
const {JSDOM}=require(path.join(root,'node_modules/jsdom'));
let html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const leaflet=fs.readFileSync(path.join(root,'node_modules/leaflet/dist/leaflet.js'),'utf8');
const inline=f=>()=>'<script>'+fs.readFileSync(path.join(site,f),'utf8')+'</script>';
html=html.replace(/<script src="https:\/\/cdnjs[^"]*leaflet[^"]*"><\/script>/,()=>'<script>'+leaflet+'</script>')
         .replace(/<script src="data\.js(\?v=[0-9a-f]+)?"><\/script>/,inline('data.js'))
         .replace(/<script src="paths\.js(\?v=[0-9a-f]+)?"><\/script>/,inline('paths.js'))
         .replace(/<script src="poi\.js(\?v=[0-9a-f]+)?"><\/script>/,inline('poi.js'))
         .replace(/<script src="app\.js(\?v=[0-9a-f]+)?"><\/script>/,inline('app.js'))
         .replace(/<link rel="stylesheet"[^>]*>/g,'');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously', pretendToBeVisual:true, beforeParse(w){ w.addEventListener('error',e=>errors.push(e.message)); 
  w.HTMLElement.prototype.getBoundingClientRect=function(){ return {x:0,y:0,width:1000,height:700,top:0,left:0,right:1000,bottom:700}; };
  w.SVGElement.prototype.getBoundingClientRect=w.HTMLElement.prototype.getBoundingClientRect; }});
const w=dom.window, doc=w.document;
setTimeout(()=>{
  const before=doc.querySelectorAll('.leaflet-overlay-pane path').length;
  const spawn=doc.querySelector('.mkw.z-sp'); console.log('spawn markers', doc.querySelectorAll('.mkw.z-sp').length, 'extracts', doc.querySelectorAll('.mkw.z-ex').length, 'keys', doc.querySelectorAll('.mkw.z-ky').length);
  spawn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  setTimeout(()=>{
    const after=doc.querySelectorAll('.leaflet-overlay-pane path').length;
    const out=doc.getElementById('out').textContent.replace(/\s+/g,' ').slice(0,200);
    console.log('paths before/after click:', before, after); console.log('out:', out); console.log('select value:', doc.getElementById('spawnSel').value);
    console.log('options rows:', doc.querySelectorAll('#options tr').length, 'heat circles:', doc.querySelectorAll('.leaflet-overlay-pane path').length, 'box markers:', doc.querySelectorAll('.mkw.z-bx').length, 'mission markers:', doc.querySelectorAll('.mkw.z-ms').length);
    console.log('errors so far:', errors); const btn=doc.querySelector('.pickopt[data-n="1"]'); if(!btn){ console.log('no option button; options html:', doc.getElementById('options').innerHTML.slice(0,200)); process.exit(1);} btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    setTimeout(()=>{ console.log('after option 1:', doc.getElementById('out').textContent.replace(/\s+/g,' ').slice(0,120)); console.log('errors:', errors); process.exit(after>before && errors.length===0 ? 0 : 1); }, 200);
  }, 300);
}, 800);
