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
  const icon = (cls, txt) => L.divIcon({className:'', html:`<div class="mk ${cls}">${txt||''}</div>`, iconSize:[22,22], iconAnchor:[11,11]});

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
        const m = L.marker(toLL(n.p), {icon: icon('spawn'+(n.guaranteed?' g':''), '')}).addTo(layers.spawn);
        m.bindTooltip(n.name+(n.guaranteed?' · luôn có đội':''), {direction:'top'});
        m.on('click', ()=>{ state.spawn=n.id; render(); });
      } else if(n.type==='extract'){
        const m = L.marker(toLL(n.p), {icon: icon('ex '+(n.cond||'fixed'), n.letter)}).addTo(layers.extract);
        m.bindTooltip(n.letter+' · '+n.name+' — '+n.desc, {direction:'top'});
      } else if(n.type==='poi'){
        const m = L.circleMarker(toLL(n.p), {radius:5, color:'var(--poi)', weight:1, fillOpacity:.8, className:'poi'}).addTo(layers.poi);
        m.bindTooltip(n.name+' · '+n.loot, {direction:'top'});
      } else if(n.type==='boss'){
        L.marker(toLL(n.p), {icon: icon('boss','!')}).addTo(layers.poi).bindTooltip(n.name, {direction:'top'});
      }
    });
    Object.entries(ZD.keycards).forEach(([id,k])=>{
      const n = nodes[k.node]; if(!n) return;
      L.marker(toLL(k.p || n.p), {icon: icon('key','🔑')}).addTo(layers.key).bindTooltip(k.name+' — '+k.contents, {direction:'top'});
    });
  }
  function render(){
    layers.route.clearLayers();
    document.querySelectorAll('.mk.spawn').forEach(el=>el.classList.remove('sel'));
    const out = $('#out');
    if(!state.spawn){ out.innerHTML = '<p class="hint">Bấm một chấm xanh (điểm spawn) trên map, hoặc chọn trong danh sách.</p>'; return; }
    const r = plan();
    const ll = r.route.map(id=>toLL(nodes[id].p));
    L.polyline(ll, {color:'var(--route)', weight:4, opacity:.9, dashArray: null}).addTo(layers.route);
    let k=1; r.stops.forEach(id=>{ L.marker(toLL(nodes[id].p), {icon: icon('step', k++)}).addTo(layers.route); });
    L.marker(toLL(nodes[state.spawn].p), {icon: icon('spawn sel','S')}).addTo(layers.route);
    if(r.extract && r.extract.ok) L.marker(toLL(r.extract.n.p), {icon: icon('ex sel', r.extract.n.letter)}).addTo(layers.route);
    map.fitBounds(L.latLngBounds(ll).pad(0.15));

    const sp = nodes[state.spawn];
    let html = `<div class="sum"><div><span class="lbl">Spawn</span><b>${sp.name}</b> (bên ${r.side==='W'?'Tây':'Đông'})</div>
      <div><span class="lbl">Loot kỳ vọng</span><b>~${fmt(Math.round(r.value/1000))}k</b></div>
      <div><span class="lbl">Thời gian</span><b>~${Math.round(r.tMin)} phút</b></div></div>`;
    html += '<ol class="steps">';
    r.stops.forEach(id=>{ const n=nodes[id]; const keys=[...state.keys].filter(kk=>ZD.keycards[kk].node===id);
      html += `<li><b>${n.name}</b> <span class="risk r${n.risk}">rủi ro ${['rất thấp','thấp','trung bình','cao','rất cao'][n.risk]}</span><br><span class="sub">${n.loot}</span>${keys.map(kk=>`<br><span class="keyline">🔑 ${ZD.keycards[kk].name}: ${ZD.keycards[kk].tip}</span>`).join('')}</li>`; });
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
  drawStatic(); render();
})();
