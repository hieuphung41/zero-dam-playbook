/* Zero Dam route planner. Coordinates are normalised [x,y] in 0..1 of the base image (x left→right, y top→bottom).
   DATA is filled from data.js (window.ZD). Routing = Dijkstra over a waypoint graph; POI selection = greedy by value/risk. */
(function(){
  const ZD = window.ZD;
  const $ = s => document.querySelector(s);
  const fmt = n => n.toLocaleString('vi-VN');

  /* ---------- map ---------- */
  const W = ZD.image.width, H = ZD.image.height;
  const map = L.map('map', {crs: L.CRS.Simple, minZoom: -3, maxZoom: 3, zoomSnap: 0.25, attributionControl: true});
  const bounds = [[0,0],[H,W]];
  L.imageOverlay(ZD.image.src, bounds).addTo(map);
  map.fitBounds(bounds);
  map.attributionControl.setPrefix('').addAttribution(ZD.image.credit);
  const toLL = p => [ (1-p[1])*H, p[0]*W ];

  const layers = {heat: L.layerGroup().addTo(map), spawn: L.layerGroup().addTo(map), extract: L.layerGroup().addTo(map), key: L.layerGroup().addTo(map),
                  poi: L.layerGroup().addTo(map), box: L.layerGroup().addTo(map), boxAll: L.layerGroup(), mission: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map)};
  const POI = window.ZDPOI || {containers:[], missions:[]};
  /* ---------- icons (inline SVG, one shape per category) ---------- */
  const SVG = {
    person:'<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14z"/>',
    exit:'<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5v-2H6V6h4V4zm3 4-1.4 1.4L13.2 11H8v2h5.2l-1.6 1.6L13 16l4-4-4-4z"/>',
    dice:'<path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 4a1.6 1.6 0 1 0 0 3.2A1.6 1.6 0 0 0 8 7zm8 0a1.6 1.6 0 1 0 0 3.2A1.6 1.6 0 0 0 16 7zm-4 3.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM8 13.8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm8 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>',
    coin:'<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm.9 13.6v1.4h-1.8v-1.3c-1.6-.2-2.7-1-2.9-2.6h1.9c.1.7.6 1.1 1.6 1.1.9 0 1.4-.4 1.4-1 0-.5-.3-.8-1.5-1.1-2-.5-3.1-1.1-3.1-2.7 0-1.3 1-2.2 2.6-2.5V6.6h1.8v1.3c1.4.3 2.3 1.1 2.4 2.5h-1.9c-.1-.6-.5-1-1.3-1-.8 0-1.3.4-1.3.9 0 .5.3.7 1.5 1 2.1.5 3.1 1.2 3.1 2.8 0 1.4-1 2.2-2.5 2.5z"/>',
    weight:'<path d="M12 3a3 3 0 0 1 3 3h3l2 14H4L6 6h3a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1zm-1 6v5h2v-5h-2z"/>',
    bag:'<path d="M9 4a3 3 0 0 1 6 0v1h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V4zm2 1h2V4a1 1 0 0 0-2 0v1zm-2 7v2h6v-2H9z"/>',
    lift:'<path d="M5 3h14v18H5V3zm2 2v14h4V5H7zm6 0v14h4V5h-4zM8.5 8 10 6.5 11.5 8h-3zm7 8L14 17.5 12.5 16h3z"/>',
    key:'<path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm7 1v2h6v-2h-6zm0 4v2h4v-2h-4z"/>',
    crate:'<path d="M3 7l9-4 9 4v10l-9 4-9-4V7zm2 1.3v7.4l6 2.7v-7.4l-6-2.7zm14 0-6 2.7v7.4l6-2.7V8.3zM12 5.2 6.4 7.7 12 10.2l5.6-2.5L12 5.2z"/>',
    skull:'<path d="M12 2a8 8 0 0 0-8 8c0 3 1.7 5.5 4 6.8V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.2c2.3-1.3 4-3.8 4-6.8a8 8 0 0 0-8-8zM8.5 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM11 14h2l-1 2.5L11 14z"/>'
  };
  const SHAPE = {
    circle:'<circle cx="16" cy="16" r="13"/>',
    hex:'<path d="M16 2 28.1 9v14L16 30 3.9 23V9z"/>',
    square:'<rect x="3" y="3" width="26" height="26" rx="6"/>',
    diamond:'<path d="M16 2 30 16 16 30 2 16z"/>',
    shield:'<path d="M16 2 28 6v9c0 7-5 12-12 15C9 27 4 22 4 15V6z"/>'
  };
  const mkSvg = (shape, glyph, cls, badge, dashed) =>
    `<svg class="mi ${cls}" viewBox="0 0 32 32" aria-hidden="true"><g class="shape"${dashed?' stroke-dasharray="3 2"':''}>${SHAPE[shape]}</g><g class="glyph" transform="translate(6 6) scale(0.83)">${SVG[glyph]||''}</g>${badge?`<text class="badge" x="27" y="9" text-anchor="middle">${badge}</text>`:''}</svg>`;
  const icon = (html, size, cls) => L.divIcon({className:'mkw '+(cls||''), html, iconSize:[size,size], iconAnchor:[size/2,size/2]});
  const EXT = {fixed:['hex','exit','ex-fixed'], random:['hex','dice','ex-random',true], paid:['hex','coin','ex-paid'], weight:['hex','weight','ex-cond'], drop:['hex','bag','ex-cond'], lever:['hex','lift','ex-lever']};
  const icons = {
    spawn:(n,sel)=> icon(mkSvg('circle','person','sp'+(n.guaranteed?' sp-g':'')+(sel?' sel':''), n.name.split(' ')[0]), sel?36:26, 'z-sp'),
    extract:(n,sel)=> { const e=EXT[n.cond]||EXT.fixed; return icon(mkSvg(e[0],e[1],e[2]+(sel?' sel':''), n.letter, e[3]), sel?40:32, 'z-ex'); },
    key:()=> icon(mkSvg('square','key','ky'), 24, 'z-ky'),
    poi:()=> icon(mkSvg('diamond','crate','po'), 22, 'z-po'),
    boss:()=> icon(mkSvg('shield','skull','bs'), 30, 'z-bs'),
    step:(k)=> icon(`<svg class="mi st" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13"/><text x="16" y="21" text-anchor="middle">${k}</text></svg>`, 30, 'z-st')
  };
  const label = (m, text, cls) => m.bindTooltip(text, {permanent:true, direction:'right', offset:[12,0], className:'lbl '+(cls||'')});
  const setLabelVisibility = () => { const z = map.getZoom(); const c = map.getContainer(); c.classList.toggle('z-low', z < -1.5); c.classList.toggle('z-mid', z >= -1.5 && z < -0.5); };
  map.on('zoomend', setLabelVisibility);

  /* ---------- state ---------- */
  const state = {mode:'normal', spawn:null, keys:new Set(), forced:new Set(), stops:2, weightLimit:false, avoid:1, maxLootMin:14};

  /* ---------- graph: precomputed raster shortest paths (paths.js) ---------- */
  const nodes = {}; ZD.nodes.forEach(n => nodes[n.id] = n);
  const PATHS = window.ZDPATHS || {};
  const pair = (a,b) => PATHS[a+'|'+b] || PATHS[b+'|'+a];
  const wdist = (a,b) => a===b ? 0 : (pair(a,b) ? pair(a,b).w : Infinity);   // risk-weighted metres (for choosing)
  const mdist = (a,b) => a===b ? 0 : (pair(a,b) ? pair(a,b).m : Infinity);   // metres (for time)
  const geom = (a,b) => { const p = pair(a,b); if(!p) return [nodes[a].p, nodes[b].p].map(q=>[q[0]*W, q[1]*H]);
    const pts = p.pts.map(q=>[q[0]*W/ZD.image.width, q[1]*H/ZD.image.height]); return PATHS[a+'|'+b] ? pts : pts.slice().reverse(); };
  const SPEED = 4.2; // m/s average sprint-walk mix
  const mins = m => m/SPEED/60;
  const routeLatLngs = ids => { let out=[]; for(let i=1;i<ids.length;i++){ const g = geom(ids[i-1], ids[i]).map(q=>[(1-q[1]/H)*H, q[0]]); out = out.concat(i===1 ? g : g.slice(1)); } return out; };

  /* ---------- enemy spawn model ----------
     14 spawns, 3 squads per side. One squad is always at the side's "#1" spot (E: E1; W: W4 or W5, 50/50 — two
     possible positions per the guides). The other squads on each side are spread evenly over the free spots. */
  function spawnProbs(mySpawn){
    const me = nodes[mySpawn]; const out = {};
    ['W','E'].forEach(side=>{
      const spots = ZD.nodes.filter(n=>n.type==='spawn' && n.side===side).map(n=>n.id);
      const gdist = ZD.squads.guaranteed[side];
      Object.entries(gdist).forEach(([g,q])=>{
        const mine = me.side===side;
        let squads = ZD.squads.perSide, free = spots.filter(id=>id!==g);
        if(mine){ squads -= 1; if(mySpawn!==g) free = free.filter(id=>id!==mySpawn); }
        const randomSquads = Math.max(0, squads - (mySpawn===g ? 0 : 1));
        spots.forEach(id=>{ if(id===mySpawn) return; let p = 0;
          if(id===g) p = 1; else if(free.includes(id)) p = randomSquads/free.length;
          out[id] = (out[id]||0) + q*p; });
      });
    });
    return out;
  }
  // "pressure" on a cluster: how likely enemy squads start within easy reach of it (road distance, 250 m scale)
  const pressureOf = (probs, id) => Object.entries(probs).reduce((acc,[s,p])=>acc + p*Math.exp(-mdist(s,id)/250), 0);

  /* ---------- planner ----------
     Expected value of a stop = loot × (1 − pDeath) − pDeath × (kit + 70% of loot already carried) − minutes × minuteCost.
     pDeath = cluster risk tier + travel exposure + enemy spawn pressure (decays as the raid goes on). */
  function plan(opts){
    opts = opts || {};
    if(!state.spawn) return null;
    const sp = nodes[state.spawn], side = sp.side, mode = state.mode, prof = ZD.profiles[mode];
    const stopsN = opts.stops ?? state.stops, maxLootMin = opts.maxLootMin ?? state.maxLootMin, avoid = state.avoid;
    const probs = spawnProbs(state.spawn);
    const pressure = {}; ZD.nodes.filter(n=>n.type==='poi').forEach(n=>pressure[n.id]=pressureOf(probs,n.id));
    const pd = r => prof.pDeath[r];
    const timing = (n, t) => n.risk>=3 ? (t<1.5 ? 0.6 : t<3 ? 0.8 : t<8 ? 1.0 : 0.8) : 1; // contested zones: cheaper if you are first in, worst at 3–8 min
    const pDeathAt = (n, travelMin, tAtArrival) => Math.min(0.9, pd(n.risk)*timing(n,tAtArrival) + prof.pTravel*travelMin + avoid*prof.pressure*(pressure[n.id]||0)*Math.max(0.25, 1 - tAtArrival/12));
    const wanted = [...new Set([...state.keys].map(k => ZD.keycards[k].node).concat([...state.forced]))];
    const roomValue = id => [...state.keys].filter(k=>ZD.keycards[k].node===id).reduce((a,k)=>a+ZD.keycards[k].ev,0);
    const valOf = n => ((mode==='easy' ? n.valueEasy : n.valueNormal) || 0) + (wanted.includes(n.id) ? roomValue(n.id) : 0);
    const extracts = ZD.nodes.filter(n=>n.type==='extract');
    const feeOf = n => n.cond==='paid' ? (mode==='easy'?10000:40000) : 0;
    const extractOk = n => { const why=[]; let ok=true;
      if(n.forSide && n.forSide!==side) { ok=false; why.push('dành cho spawn bên '+(n.forSide==='W'?'Tây':'Đông')); }
      if(n.cond==='weight' && !state.weightLimit) { ok=false; why.push('cần dưới '+(mode==='easy'?50:30)+' kg'); }
      if(n.cond==='random' && mode!=='easy') why.push('ngẫu nhiên, chỉ chắc ở Easy');
      if(n.cond==='drop') { ok=false; why.push('phải bỏ ba lô: chỉ khi bị kẹp và đồ ngon đã trong Safe Box'); }
      if(n.cond==='lever') { ok=false; why.push('kéo cần báo động toàn map'); }
      return {ok, why}; };
    // evaluate one ordered plan: legs, extract choice, survival, EV (= expected Alloy after the raid, minus time cost)
    function evaluate(order){
      let c=state.spawn, tMin=0, carried=0, pSurv=1; const legs=[];
      for(const id of order){ const n=nodes[id]; const m=mdist(c,id); if(m===Infinity) return null; const t=mins(m); const p=pDeathAt(n,t,tMin+t);
        legs.push({id, m, t, lootMin:n.lootMin, p, pressure:pressure[id]||0, value:valOf(n), tAt:tMin+t}); tMin += t + n.lootMin; carried += valOf(n); pSurv *= (1-p); c=id; }
      const cands = extracts.map(n=>{ const {ok,why}=extractOk(n); const m=mdist(c,n.id); const t=mins(m), wt=mins(wdist(c,n.id)); const fee=feeOf(n);
        const p = Math.min(0.9, pd(n.risk)*(n.cond==='fixed'?1.3:1) + prof.pTravel*t);
        const score = (ok && m!==Infinity) ? -(p*(prof.kit + 0.7*carried)) - wt*prof.minuteCost - fee - (n.cond==='random' && mode!=='easy' ? 60000 : 0) : -Infinity;
        return {n, ok: ok && m!==Infinity, why, fee, t, m, p, score}; }).sort((a,b)=>b.score-a.score);
      const ex = cands[0]; if(!ex || !ex.ok) return null;
      const pAll = pSurv*(1-ex.p); const tTot = tMin + ex.t; const dist = legs.reduce((a,l)=>a+l.m,0) + ex.m;
      const ev = pAll*carried - (1-pAll)*(prof.kit + 0.7*carried) - ex.fee - tTot*prof.minuteCost;
      return {order, legs, extract:ex, alternatives:cands.slice(1,4), tMin:tTot, value:carried, pSurv:pAll, ev, dist};
    }
    // exhaustive search over stop sets (≤ stopsN clusters + the rooms you hold cards for), every order
    const pois = ZD.nodes.filter(n=>n.type==='poi' && valOf(n)>0 && !wanted.includes(n.id)).map(n=>n.id);
    const perms = arr => arr.length<=1 ? [arr] : arr.flatMap((x,i)=>perms(arr.slice(0,i).concat(arr.slice(i+1))).map(r=>[x].concat(r)));
    const combos = (arr,k) => k===0 ? [[]] : arr.flatMap((x,i)=>combos(arr.slice(i+1),k-1).map(r=>[x].concat(r)));
    let best=null;
    for(let k=0;k<=stopsN;k++) combos(pois,k).forEach(set=>{ perms(set.concat(wanted)).forEach(order=>{ const r=evaluate(order); if(!r) return;
      if(r.tMin - (r.extract.t) > maxLootMin && order.length>wanted.length) return;
      if(!best || r.ev>best.ev) best=r; }); });
    if(!best) best = evaluate(wanted) || {order:[], legs:[], extract:null, alternatives:[], tMin:0, value:0, pSurv:1, ev:0, dist:0};
    const path = best.extract && best.extract.ok ? [state.spawn].concat(best.order,[best.extract.n.id]) : [state.spawn].concat(best.order);
    return Object.assign(best, {route:path, stops:best.order, side, probs, pressure});
  }

  /* ---------- render ---------- */
  function drawStatic(){
    ZD.nodes.forEach(n=>{
      if(n.type==='spawn'){
        const m = L.marker(toLL(n.p), {icon: icons.spawn(n,false), zIndexOffset:300}).addTo(layers.spawn);
        label(m, n.name.split(' ')[0], 'lbl-sp'); spawnMarkers[n.id] = m;
        m.on('click', ()=>{ state.spawn=n.id; spawnSel.value=n.id; render(); });
      } else if(n.type==='extract'){
        const m = L.marker(toLL(n.p), {icon: icons.extract(n,false), zIndexOffset:400}).addTo(layers.extract);
        m.bindPopup(`<b>${n.letter} · ${n.name}</b><br>${n.desc}${n.forSide?`<br>Dành cho spawn bên ${n.forSide==='W'?'Tây':'Đông'}`:''}`);
        label(m, n.letter+' · '+n.name, 'lbl-ex');
      } else if(n.type==='poi'){
        const m = L.marker(toLL(n.p), {icon: icons.poi(), zIndexOffset:100}).addTo(layers.poi);
        m.bindPopup(()=>`<b>${n.name}</b><br>${n.loot}<br><span class="risk r${n.risk}">rủi ro ${RISK[n.risk]}</span> · ~${fmt(Math.round(n.valueNormal/1000))}k Normal / ${fmt(Math.round(n.valueEasy/1000))}k Easy<br><button class="pick-poi" data-id="${n.id}">${state.forced.has(n.id)?'Bỏ ép ghé cụm này':'Ép ghé cụm này'}</button>`);
        label(m, n.name, 'lbl-po');
      } else if(n.type==='boss'){
        const m = L.marker(toLL(n.p), {icon: icons.boss(), zIndexOffset:350}).addTo(layers.poi);
        m.bindPopup(`<b>${n.name}</b><br>M249, lựu đạn khói/cháy; guard Flamethrower + Rocketeer tuần tra lòng đập.`);
        label(m, 'Saeed', 'lbl-bs');
      }
    });
    Object.entries(ZD.keycards).forEach(([id,k])=>{
      const n = nodes[k.node]; if(!n) return;
      const m = L.marker(toLL(k.p || n.p), {icon: icons.key(), zIndexOffset:200}).addTo(layers.key);
      m.bindPopup(`<b>🔑 ${k.name}</b><br>${k.contents}<br>Giá tham khảo ~${fmt(Math.round(k.price/1000))}k · kỳ vọng ~${fmt(Math.round(k.ev/1000))}k<br>${k.tip}<br><button class="pick-key" data-id="${id}">Tôi mang thẻ này</button>`);
      label(m, k.name.split(' (')[0], 'lbl-ky');
    });
    const BOXC = {safe:'#e53935', server:'#00acc1', pc:'#5c6bc0', case:'#8e24aa', gun:'#6d4c41', stash:'#f9a825', code:'#d81b60', gold:'#ffb300', nest:'#7cb342', med:'#ef6c00', box:'#9e9e9e'};
    const BOXL = {safe:'K', server:'S', pc:'P', case:'C', gun:'G', stash:'H', code:'M', gold:'$', nest:'•', med:'+', box:'·'};
    POI.containers.forEach(c=>{
      const hi = !!c.hi; const size = hi ? 16 : 11;
      const m = L.marker(toLL(c.p), {icon: L.divIcon({className:'mkw z-bx', html:`<div class="bx${hi?' hi':''}" style="background:${BOXC[c.t]}">${hi?BOXL[c.t]:''}</div>`, iconSize:[size,size], iconAnchor:[size/2,size/2]}), zIndexOffset:50});
      m.bindTooltip(`${c.n}${c.f!=null?' · tầng '+c.f:''}${c.k?' · cần thẻ':''}${c.r?' · xuất hiện ngẫu nhiên':''} · ~${fmt(Math.round(c.v/1000))}k`, {direction:'top'});
      m.addTo(hi ? layers.box : layers.boxAll);
    });
    POI.missions.forEach(ms=>{ const m = L.marker(toLL(ms.p), {icon: L.divIcon({className:'mkw z-ms', html:`<div class="ms${ms.hv?' hv':''}">!</div>`, iconSize:[18,18], iconAnchor:[9,9]}), zIndexOffset:120}).addTo(layers.mission);
      m.bindTooltip(ms.n + (ms.hv ? ' (thưởng lớn)' : '') + ' — nhận nhiệm vụ trong trận, trả Alloy khi hoàn thành', {direction:'top'}); });
    map.on('popupopen', e=>{ const el=e.popup.getElement(); if(!el) return;
      el.querySelectorAll('.pick').forEach(b=>b.addEventListener('click', ()=>{ state.spawn=b.dataset.id; spawnSel.value=b.dataset.id; map.closePopup(); render(); }));
      el.querySelectorAll('.pick-poi').forEach(b=>b.addEventListener('click', ()=>{ const id=b.dataset.id; state.forced.has(id)?state.forced.delete(id):state.forced.add(id); map.closePopup(); render(); }));
      el.querySelectorAll('.pick-key').forEach(b=>b.addEventListener('click', ()=>{ const cb=document.getElementById('key-'+b.dataset.id); if(cb && !cb.checked){ cb.checked=true; state.keys.add(b.dataset.id); } map.closePopup(); render(); })); });
    setLabelVisibility();
  }
  const RISK = ['rất thấp','thấp','trung bình','cao','rất cao'];
  const spawnMarkers = {};
  const PXM = W/ZD.image.metersX; // image px per metre
  function render(){
    layers.route.clearLayers(); layers.heat.clearLayers();
    const out = $('#out'), opt = $('#options');
    if(!state.spawn){ out.innerHTML = '<p class="hint">Bấm một chấm xanh (điểm spawn) trên map, hoặc chọn trong danh sách.</p>'; opt.innerHTML=''; 
      Object.values(spawnMarkers).forEach(m=>m.setTooltipContent(nodes[Object.keys(spawnMarkers).find(k=>spawnMarkers[k]===m)].name.split(' ')[0])); return; }
    const r = plan();
    // enemy spawn probabilities: heat circles + % on labels
    Object.entries(spawnMarkers).forEach(([id,m])=>{ const p = r.probs[id]; const short = nodes[id].name.split(' ')[0];
      m.setTooltipContent(id===state.spawn ? short+' · bạn' : short+' · '+Math.round((p||0)*100)+'%');
      if(p>0){ L.circle(toLL(nodes[id].p), {radius: 230*PXM, stroke:false, fillColor:'#e53935', fillOpacity:0.07+0.4*p, interactive:false}).addTo(layers.heat); } });
    const ll = routeLatLngs(r.route);
    L.polyline(ll, {color:'#1c1c1c', weight:8, opacity:.55}).addTo(layers.route);
    L.polyline(ll, {color:'#ff6a00', weight:4, opacity:.95}).addTo(layers.route);
    let k=1; r.stops.forEach(id=>{ L.marker(toLL(nodes[id].p), {icon: icons.step(k++), zIndexOffset:600}).addTo(layers.route); });
    L.marker(toLL(nodes[state.spawn].p), {icon: icons.spawn(nodes[state.spawn],true), zIndexOffset:700}).addTo(layers.route);
    if(r.extract && r.extract.ok) L.marker(toLL(r.extract.n.p), {icon: icons.extract(r.extract.n,true), zIndexOffset:700}).addTo(layers.route);
    map.fitBounds(L.latLngBounds(ll).pad(0.15));

    const sp = nodes[state.spawn];
    const pct = x => Math.round(x*100)+'%';
    let html = `<div class="sum"><div><span class="lbl">Spawn</span><b>${sp.name.split(' · ')[0]}</b> bên ${r.side==='W'?'Tây':'Đông'}</div>
      <div><span class="lbl">Loot kỳ vọng</span><b>~${fmt(Math.round(r.value/1000))}k</b></div>
      <div><span class="lbl">Thời gian</span><b>~${Math.round(r.tMin)} ph</b></div>
      <div><span class="lbl">Quãng đường</span><b>~${fmt(Math.round(r.dist/10)*10)} m</b></div>
      <div><span class="lbl">Sống sót</span><b>${pct(r.pSurv)}</b></div>
      <div><span class="lbl">EV mỗi trận</span><b>${r.ev>=0?'+':'−'}${fmt(Math.round(Math.abs(r.ev)/1000))}k</b></div></div>`;
    if(state.forced.size){ const free = (()=>{ const f=new Set(state.forced); state.forced=new Set(); const x=plan(); state.forced=f; return x; })();
      html += `<div class="forced">Ép ghé: ${[...state.forced].map(id=>`<span class="chip">${nodes[id].name} <button type="button" class="unforce" data-id="${id}" aria-label="bỏ">×</button></span>`).join(' ')}<br><span class="sub">So với tuyến tự do (${free.stops.map(id=>nodes[id].name.split(' (')[0]).join(' → ')||'không loot'}): EV ${free.ev>=0?'+':'−'}${fmt(Math.round(Math.abs(free.ev)/1000))}k, sống ${pct(free.pSurv)} → tuyến ép: EV ${r.ev>=0?'+':'−'}${fmt(Math.round(Math.abs(r.ev)/1000))}k, sống ${pct(r.pSurv)}.</span></div>`; }
    html += '<ol class="steps">';
    r.legs.forEach(l=>{ const n=nodes[l.id]; const keys=[...state.keys].filter(kk=>ZD.keycards[kk].node===l.id);
      const near = POI.missions.filter(ms=>Math.hypot((ms.p[0]-n.p[0])*ZD.image.metersX,(ms.p[1]-n.p[1])*ZD.image.metersY) < 120).length;
      html += `<li><b>${n.name}</b>${state.forced.has(l.id)?' <span class="chip">ép</span>':''} <span class="risk r${n.risk}">rủi ro ${RISK[n.risk]}</span> <span class="sub">đi ~${Math.round(l.m)} m · ${l.t.toFixed(1)} ph · loot ${n.lootMin} ph · p chết ${pct(l.p)}${l.pressure>0.25?' · <span class="hot">áp lực địch '+pct(Math.min(1,l.pressure))+'</span>':''}</span><br><span class="sub">${n.loot}</span>${near?`<br><span class="sub">! ${near} trạm nhiệm vụ trong 120 m</span>`:''}${keys.map(kk=>`<br><span class="keyline">🔑 ${ZD.keycards[kk].name}: ${ZD.keycards[kk].tip}</span>`).join('')}</li>`; });
    if(r.extract && r.extract.ok){ const e=r.extract.n; html += `<li class="exit"><b>Rút: ${e.letter} · ${e.name}</b><br><span class="sub">${e.desc}${r.extract.fee?` · phí ${fmt(r.extract.fee)}`:''} · ~${Math.round(r.extract.t)} phút di chuyển · p chết ${pct(r.extract.p)}</span></li>`; }
    else html += `<li class="exit"><b>Không có điểm rút phù hợp</b> với điều kiện đã chọn.</li>`;
    html += '</ol>';
    html += '<details><summary>Điểm rút dự phòng</summary><ul class="alt">' + r.alternatives.map(a=>`<li><b>${a.n.letter} · ${a.n.name}</b> — ${a.ok?('~'+Math.round(a.t)+' phút'+(a.fee?', phí '+fmt(a.fee):'')):a.why.join('; ')}</li>`).join('') + '</ul></details>';
    const warn = [];
    const hot = Object.entries(r.probs).filter(([id,p])=>p>=0.5).map(([id])=>nodes[id].name.split(' ')[0]);
    if(hot.length) warn.push('Gần như chắc chắn có đội địch ở: '+hot.join(', ')+'. Vùng đỏ trên map là bán kính 230 m quanh spawn địch.');
    if(sp.guaranteed) warn.push('Spawn này cách Toà hành chính ~30 giây: rời ngay, không loot Admin.');
    if(state.keys.size) warn.push('Bán thẻ được trước khi dùng; nhìn qua cửa sổ trước khi mở.');
    warn.push('Cất đồ đỏ/vàng/thẻ vào Hộp An Toàn ngay khi nhặt. Ngừng loot khi còn 3 phút.');
    html += '<ul class="warn">' + warn.map(w=>`<li>${w}</li>`).join('') + '</ul>';
    out.innerHTML = html;
    out.querySelectorAll('.unforce').forEach(b=>b.addEventListener('click', ()=>{ state.forced.delete(b.dataset.id); render(); }));
    // options table: 1 / 2 / 3 clusters
    const rows = [1,2,3].map(n=>({n, r: plan({stops:n, maxLootMin: n===1?8:(n===2?14:20)})}));
    opt.innerHTML = '<table class="opts"><thead><tr><th>Cụm</th><th>Loot</th><th>Phút</th><th>Sống</th><th>EV</th><th></th></tr></thead><tbody>' + rows.map(({n,r:x})=>
      `<tr class="${n===state.stops?'cur':''}"><td>${n}</td><td class="num">${fmt(Math.round(x.value/1000))}k</td><td class="num">${Math.round(x.tMin)}</td><td class="num">${pct(x.pSurv)}</td><td class="num">${x.ev>=0?'+':'−'}${fmt(Math.round(Math.abs(x.ev)/1000))}k</td><td><button type="button" class="pickopt" data-n="${n}">${n===state.stops?'đang xem':'xem'}</button></td></tr>`).join('') + '</tbody></table>';
    opt.querySelectorAll('.pickopt').forEach(b=>b.addEventListener('click', ()=>{ state.stops=+b.dataset.n; state.maxLootMin = state.stops===1?8:(state.stops===2?14:20); document.querySelectorAll('input[name=goal]').forEach(x=>x.checked = +x.value===state.stops); render(); }));
  }

  /* ---------- controls ---------- */
  const spawnSel = $('#spawnSel');
  ZD.nodes.filter(n=>n.type==='spawn').forEach(n=>{ const o=document.createElement('option'); o.value=n.id; o.textContent=n.name; spawnSel.appendChild(o); });
  spawnSel.addEventListener('change', e=>{ state.spawn=e.target.value||null; render(); });
  const keyBox = $('#keys');
  Object.entries(ZD.keycards).forEach(([id,k])=>{ const l=document.createElement('label'); l.innerHTML=`<input type="checkbox" id="key-${id}" value="${id}"> ${k.name} <span class="sub">~${fmt(Math.round(k.price/1000))}k</span>`; keyBox.appendChild(l);
    l.querySelector('input').addEventListener('change', e=>{ e.target.checked?state.keys.add(id):state.keys.delete(id); render(); }); });
  document.querySelectorAll('input[name=mode]').forEach(r=>r.addEventListener('change', e=>{ state.mode=e.target.value; render(); }));
  document.querySelectorAll('input[name=goal]').forEach(r=>r.addEventListener('change', e=>{ state.stops=+e.target.value; state.maxLootMin = state.stops===1?8:(state.stops===2?14:20); render(); }));
  $('#avoid').addEventListener('input', e=>{ state.avoid=+e.target.value; $('#avoidV').textContent=['tắt','thấp','vừa','cao','rất cao'][Math.round(+e.target.value*2)]; render(); });
  $('#wl').addEventListener('change', e=>{ state.weightLimit=e.target.checked; render(); });
  document.querySelectorAll('[data-layer]').forEach(cb=>{ const l=layers[cb.dataset.layer]; if(cb.checked && !map.hasLayer(l)) map.addLayer(l); if(!cb.checked && map.hasLayer(l)) map.removeLayer(l);
    cb.addEventListener('change', e=>{ e.target.checked?map.addLayer(l):map.removeLayer(l); }); });

  window.ZDplan = (st)=>{ Object.assign(state, st); if(st.keys) state.keys=new Set(st.keys); if(st.forced) state.forced=new Set(st.forced); return plan(); };
  const lg=$('#legend'); $('#legendBtn').addEventListener('click', ()=>{ lg.hidden=!lg.hidden; });
  drawStatic(); render();
})();
