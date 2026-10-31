// Functional DOM test of the planner page with jsdom + real Leaflet: click a spawn marker, expect a route polyline.
const fs=require('fs'), path=require('path');
const root=process.argv[2], site=process.argv[3];
const {JSDOM}=require(path.join(root,'node_modules/jsdom'));
let html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const leaflet=fs.readFileSync(path.join(root,'node_modules/leaflet/dist/leaflet.js'),'utf8');
html=html.replace(/<script src="https:\/\/cdnjs[^"]*leaflet[^"]*"><\/script>/,'<script>'+leaflet+'</script>')
         .replace('<script src="data.js"></script>','<script>'+fs.readFileSync(path.join(site,'data.js'),'utf8')+'</script>')
         .replace('<script src="paths.js"></script>','<script>'+fs.readFileSync(path.join(site,'paths.js'),'utf8')+'</script>')
         .replace('<script src="app.js"></script>','<script>'+fs.readFileSync(path.join(site,'app.js'),'utf8')+'</script>')
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
    console.log('errors:', errors); process.exit(after>before && errors.length===0 ? 0 : 1);
  }, 300);
}, 800);
