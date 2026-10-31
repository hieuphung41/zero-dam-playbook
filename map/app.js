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

  const layers = {spawn: L.layerGroup().addTo(map), extract: L.layerGroup().addTo(map), key: L.layerGroup().addTo(map),
                  poi: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map)};
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
  const state = {mode:'normal', spawn:null, keys:new Set(), stops:2, weightLimit:false};

  /* ---------- graph ---------- */
  const nodes = {}; ZD.nodes.forEach(n => nodes[n.id] = n);
  const adj = {};
  const dist = (a,b) => { const A=nodes[a], B=nodes[b]; const dx=(A.p[0]-B.p[0])*ZD.image.metersX, dy=(A.p[1]-B.p[1])*ZD.image.metersY; return Math.hypot(dx,dy); };
  ZD.edges.forEach(([a,b,riskMul]) => { (adj[a]=adj[a]||[]).push([b, dist(a,b)*(riskMul||1)]); (adj[b]=adj[b]||[]).push([a, dist(a,b)*(riskMul||1)]); });
  function dijkstra(src){
    const d={}, prev={}; Object.keys(nodes).forEach(k=>d[k]=Infinity); d[src]=0;
    const q=new Set(Object.keys(nodes));
    while(q.size){ let u=null; q.forEach(k=>{ if(u===null||d[k]<d[u]) u=k; }); q.delete(u); if(d[u]===Infinity) break;
      (adj[u]||[]).forEach(([v,w])=>{ if(d[u]+w<d[v]){ d[v]=d[u]+w; prev[v]=u; } }); }
    return {d, prev};
  }
  const pathOf = (prev, src, dst) => { const p=[dst]; let c=dst; while(c!==src && prev[c]!==undefined){ c=prev[c]; p.push(c);} return p.reverse(); };
  const SPEED = 4.2; // m/s average sprint-walk mix
  const mins = m => m/SPEED/60;

  /* ---------- planner ----------
     Expected-value model for a budget solo run:
       gain(cluster) = loot × (1 − pDeath) − pDeath × (kit + 70% of loot already carried) − minutes × minuteCost
     pDeath comes from the cluster's risk tier (profiles.pDeath). 30% of carried loot is assumed to be in the Safe Box. */
  function plan(){
    if(!state.spawn) return null;
    const sp = nodes[state.spawn], side = sp.side, mode = state.mode, prof = ZD.profiles[mode];
    const pd = r => prof.pDeath[r];
    let cur = state.spawn, route=[state.spawn], tMin=0, carried=0, notes=[];
    const used = new Set();
    const wanted = new Set([...state.keys].map(k => ZD.keycards[k].node));
    const roomValue = id => [...state.keys].filter(k=>ZD.keycards[k].node===id).reduce((a,k)=>a+ZD.keycards[k].ev,0);
    const stops = state.stops + wanted.size;
    for(let i=0;i<stops;i++){
      const dj = dijkstra(cur), d = dj.d;
      let best=null, bestScore=-Infinity;
      const pendingForced = [...wanted].some(id=>!used.has(id));
      ZD.nodes.filter(n=>n.type==='poi' && !used.has(n.id)).forEach(n=>{
        if(d[n.id]===Infinity) return;
        const travel = mins(d[n.id]);
        const v = ((mode==='easy' ? n.valueEasy : n.valueNormal) || 0) + (wanted.has(n.id) ? roomValue(n.id) : 0);
        if(v<=0) return;
        const p = Math.min(0.9, pd(n.risk) + prof.pTravel*travel);
        let score = v*(1-p) - p*(prof.kit + 0.7*carried) - (travel + n.lootMin)*prof.minuteCost;
        if(wanted.has(n.id)) score += 50000; // a room you hold a card for is worth a small detour
        if(score>bestScore){ best=n; bestScore=score; }
      });
      if(!best) break;
      if(!wanted.has(best.id) && bestScore < 0) { if(!pendingForced) break; }
      route = route.concat(pathOf(dj.prev, cur, best.id).slice(1));
      tMin += mins(d[best.id]) + best.lootMin;
      carried += ((mode==='easy'?best.valueEasy:best.valueNormal)||0) + (wanted.has(best.id) ? roomValue(best.id) : 0);
      used.add(best.id); cur = best.id;
      if(tMin > prof.maxLootMin && ![...wanted].some(id=>!used.has(id))) break;
    }
    // any card room still missing goes in last
    [...wanted].filter(id=>!used.has(id)).forEach(id=>{
      const dj = dijkstra(cur); if(dj.d[id]===Infinity) return;
      route = route.concat(pathOf(dj.prev, cur, id).slice(1)); tMin += mins(dj.d[id]) + nodes[id].lootMin;
      carried += ((mode==='easy'?nodes[id].valueEasy:nodes[id].valueNormal)||0) + roomValue(id); used.add(id); cur=id; });
    // reorder the chosen stops to minimise walking (all permutations; at most 5 stops)
    const memo = {}; const D = id => memo[id] || (memo[id] = dijkstra(id));
    const stopList = [...used];
    if(stopList.length > 1){
      const perms = a => a.length<=1 ? [a] : a.flatMap((x,i)=>perms(a.slice(0,i).concat(a.slice(i+1))).map(r=>[x].concat(r)));
      let bestP=null, bestLen=Infinity;
      perms(stopList).forEach(pm=>{ let len=0, c=state.spawn; pm.forEach(id=>{ len+=D(c).d[id]; c=id; });
        // add distance to the nearest usable extract so the order ends near an exit
        const exD = Math.min(...ZD.nodes.filter(n=>n.type==='extract' && n.cond!=='lever' && n.cond!=='drop' && (!n.forSide||n.forSide===side)).map(n=>D(c).d[n.id]));
        len += exD; if(len<bestLen){ bestLen=len; bestP=pm; } });
      route=[state.spawn]; let c=state.spawn; tMin=0;
      bestP.forEach(id=>{ route=route.concat(pathOf(D(c).prev, c, id).slice(1)); tMin += mins(D(c).d[id]) + nodes[id].lootMin; c=id; });
      cur=c; used.clear(); bestP.forEach(id=>used.add(id));
    }
    // extract: score = −pDeath × (kit + 70% carried) − travel × minuteCost − fee
    const dj2 = dijkstra(cur), d = dj2.d, prev = dj2.prev;
    const cands = ZD.nodes.filter(n=>n.type==='extract').map(n=>{
      let ok = true, why=[];
      if(n.forSide && n.forSide!==side) { ok=false; why.push('dành cho spawn bên '+(n.forSide==='W'?'Tây':'Đông')); }
      if(n.cond==='weight' && !state.weightLimit) { ok=false; why.push('cần dưới '+(mode==='easy'?50:30)+' kg'); }
      if(n.cond==='random' && mode!=='easy') { why.push('ngẫu nhiên, chỉ chắc ở Easy'); }
      if(n.cond==='drop') { ok=false; why.push('phải bỏ ba lô: chỉ khi bị kẹp và đồ ngon đã trong Safe Box'); }
      if(n.cond==='lever') { ok=false; why.push('kéo cần báo động toàn map'); }
      if(d[n.id]===Infinity) ok=false;
      const fee = n.cond==='paid' ? (mode==='easy'?10000:40000) : 0;
      const t = mins(d[n.id]);
      const p = Math.min(0.9, pd(n.risk) * (n.cond==='fixed' ? 1.3 : 1) + prof.pTravel*t);
      const score = ok ? -(p*(prof.kit + 0.7*carried)) - t*prof.minuteCost - fee - (n.cond==='random' && mode!=='easy' ? 60000 : 0) : -Infinity;
      return {n, ok, why, fee, t, score};
    }).sort((a,b)=>b.score-a.score);
    const ex = cands[0];
    const path = ex && ex.ok ? route.concat(pathOf(prev, cur, ex.n.id).slice(1)) : route;
    return {route:path, stops:[...used], extract:ex, alternatives:cands.slice(1,4), tMin: tMin + (ex?ex.t:0), value:carried, side};
  }

  /* ---------- render ---------- */
  function drawStatic(){
    ZD.nodes.forEach(n=>{
      if(n.type==='spawn'){
        const m = L.marker(toLL(n.p), {icon: icons.spawn(n,false), zIndexOffset:300}).addTo(layers.spawn);
        m.bindPopup(`<b>${n.name}</b><br>Bên ${n.side==='W'?'Tây':'Đông'}${n.guaranteed?'<br>Luôn có 1 đội, cách Admin ~30 s':''}${n.nearAdmin?'<br>Gần Admin, trận đầu dễ nổ ở đây':''}<br><button class="pick" data-id="${n.id}">Chọn spawn này</button>`);
        label(m, n.name.split(' ')[0], 'lbl-sp');
        m.on('click', ()=>{ state.spawn=n.id; spawnSel.value=n.id; render(); });
      } else if(n.type==='extract'){
        const m = L.marker(toLL(n.p), {icon: icons.extract(n,false), zIndexOffset:400}).addTo(layers.extract);
        m.bindPopup(`<b>${n.letter} · ${n.name}</b><br>${n.desc}${n.forSide?`<br>Dành cho spawn bên ${n.forSide==='W'?'Tây':'Đông'}`:''}`);
        label(m, n.letter+' · '+n.name, 'lbl-ex');
      } else if(n.type==='poi'){
        const m = L.marker(toLL(n.p), {icon: icons.poi(), zIndexOffset:100}).addTo(layers.poi);
        m.bindPopup(`<b>${n.name}</b><br>${n.loot}<br><span class="risk r${n.risk}">rủi ro ${RISK[n.risk]}</span> · ~${fmt(Math.round(n.valueNormal/1000))}k Normal / ${fmt(Math.round(n.valueEasy/1000))}k Easy`);
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
    map.on('popupopen', e=>{ const el=e.popup.getElement(); if(!el) return;
      el.querySelectorAll('.pick').forEach(b=>b.addEventListener('click', ()=>{ state.spawn=b.dataset.id; spawnSel.value=b.dataset.id; map.closePopup(); render(); }));
      el.querySelectorAll('.pick-key').forEach(b=>b.addEventListener('click', ()=>{ const cb=document.getElementById('key-'+b.dataset.id); if(cb && !cb.checked){ cb.checked=true; state.keys.add(b.dataset.id); } map.closePopup(); render(); })); });
    setLabelVisibility();
  }
  const RISK = ['rất thấp','thấp','trung bình','cao','rất cao'];
  function render(){
    layers.route.clearLayers();
        const out = $('#out');
    if(!state.spawn){ out.innerHTML = '<p class="hint">Bấm một chấm xanh (điểm spawn) trên map, hoặc chọn trong danh sách.</p>'; return; }
    const r = plan();
    const ll = r.route.map(id=>toLL(nodes[id].p));
    L.polyline(ll, {color:'#ff6a00', weight:4, opacity:.95}).addTo(layers.route);
    let k=1; r.stops.forEach(id=>{ L.marker(toLL(nodes[id].p), {icon: icons.step(k++), zIndexOffset:600}).addTo(layers.route); });
    L.marker(toLL(nodes[state.spawn].p), {icon: icons.spawn(nodes[state.spawn],true), zIndexOffset:700}).addTo(layers.route);
    if(r.extract && r.extract.ok) L.marker(toLL(r.extract.n.p), {icon: icons.extract(r.extract.n,true), zIndexOffset:700}).addTo(layers.route);
    L.polyline(ll, {color:'#1c1c1c', weight:7, opacity:.5}).addTo(layers.route).bringToBack();
    map.fitBounds(L.latLngBounds(ll).pad(0.15));

    const sp = nodes[state.spawn];
    let html = `<div class="sum"><div><span class="lbl">Spawn</span><b>${sp.name}</b> (bên ${r.side==='W'?'Tây':'Đông'})</div>
      <div><span class="lbl">Loot kỳ vọng</span><b>~${fmt(Math.round(r.value/1000))}k</b></div>
      <div><span class="lbl">Thời gian</span><b>~${Math.round(r.tMin)} phút</b></div></div>`;
    html += '<ol class="steps">';
    r.stops.forEach(id=>{ const n=nodes[id]; const keys=[...state.keys].filter(kk=>ZD.keycards[kk].node===id);
      html += `<li><b>${n.name}</b> <span class="risk r${n.risk}">rủi ro ${RISK[n.risk]}</span><br><span class="sub">${n.loot}</span>${keys.map(kk=>`<br><span class="keyline">🔑 ${ZD.keycards[kk].name}: ${ZD.keycards[kk].tip}</span>`).join('')}</li>`; });
    if(r.extract && r.extract.ok){ const e=r.extract.n; html += `<li class="exit"><b>Rút: ${e.letter} · ${e.name}</b><br><span class="sub">${e.desc}${r.extract.fee?` · phí ${fmt(r.extract.fee)}`:''} · ~${Math.round(r.extract.t)} phút di chuyển</span></li>`; }
    else html += `<li class="exit"><b>Không có điểm rút phù hợp</b> với điều kiện đã chọn.</li>`;
    html += '</ol>';
    html += '<details><summary>Điểm rút dự phòng</summary><ul class="alt">' + r.alternatives.map(a=>`<li><b>${a.n.letter} · ${a.n.name}</b> — ${a.ok?('~'+Math.round(a.t)+' phút'+(a.fee?', phí '+fmt(a.fee):'')):a.why.join('; ')}</li>`).join('') + '</ul></details>';
    const warn = [];
    if(sp.guaranteed) warn.push('Spawn này cách Toà hành chính ~30 giây: rời ngay, không loot Admin.');
    if(state.keys.size) warn.push('Bán thẻ được trước khi dùng; nhìn qua cửa sổ trước khi mở.');
    warn.push('Cất đồ đỏ/vàng/thẻ vào Hộp An Toàn ngay khi nhặt. Ngừng loot khi còn 3 phút.');
    html += '<ul class="warn">' + warn.map(w=>`<li>${w}</li>`).join('') + '</ul>';
    out.innerHTML = html;
  }

  /* ---------- controls ---------- */
  const spawnSel = $('#spawnSel');
  ZD.nodes.filter(n=>n.type==='spawn').forEach(n=>{ const o=document.createElement('option'); o.value=n.id; o.textContent=n.name; spawnSel.appendChild(o); });
  spawnSel.addEventListener('change', e=>{ state.spawn=e.target.value||null; render(); });
  const keyBox = $('#keys');
  Object.entries(ZD.keycards).forEach(([id,k])=>{ const l=document.createElement('label'); l.innerHTML=`<input type="checkbox" id="key-${id}" value="${id}"> ${k.name} <span class="sub">~${fmt(Math.round(k.price/1000))}k</span>`; keyBox.appendChild(l);
    l.querySelector('input').addEventListener('change', e=>{ e.target.checked?state.keys.add(id):state.keys.delete(id); render(); }); });
  document.querySelectorAll('input[name=mode]').forEach(r=>r.addEventListener('change', e=>{ state.mode=e.target.value; render(); }));
  $('#stops').addEventListener('input', e=>{ state.stops=+e.target.value; $('#stopsV').textContent=e.target.value; render(); });
  $('#wl').addEventListener('change', e=>{ state.weightLimit=e.target.checked; render(); });
  document.querySelectorAll('[data-layer]').forEach(cb=>cb.addEventListener('change', e=>{ const l=layers[e.target.dataset.layer]; e.target.checked?map.addLayer(l):map.removeLayer(l); }));

  window.ZDplan = (st)=>{ Object.assign(state, st); if(st.keys) state.keys=new Set(st.keys); return plan(); };
  const lg=$('#legend'); $('#legendBtn').addEventListener('click', ()=>{ lg.hidden=!lg.hidden; });
  drawStatic(); render();
})();
