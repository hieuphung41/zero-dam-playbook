/* Zero Dam route planner. Coordinates are normalised [x,y] in 0..1 of the base image (x left→right, y top→bottom).
   DATA is filled from data.js (window.ZD). Routing = Dijkstra over a waypoint graph; POI selection = greedy by value/risk. */
(function(){
  const ZD = window.ZD;
  const $ = s => document.querySelector(s);
  const fmt = n => n.toLocaleString('vi-VN');

  /* ---------- map ---------- */
  const W = ZD.image.width, H = ZD.image.height;
  const map = L.map('map', {crs: L.CRS.Simple, minZoom: -3, maxZoom: 1, zoomSnap: 0.25, attributionControl: true});
  const bounds = [[0,0],[H,W]];
  L.imageOverlay(ZD.image.src, bounds).addTo(map);
  map.fitBounds(bounds);
  map.attributionControl.setPrefix('').addAttribution('© Tencent / Team Jade · ảnh deltaforcedb · marker df.qq.com');
  { const c = document.getElementById('credit'); if(c) c.textContent = ZD.image.credit; }
  const toLL = p => [ (1-p[1])*H, p[0]*W ];

  const layers = {heat: L.layerGroup().addTo(map), spawn: L.layerGroup().addTo(map), extract: L.layerGroup().addTo(map), key: L.layerGroup().addTo(map),
                  poi: L.layerGroup().addTo(map), box: L.layerGroup().addTo(map), boxAll: L.layerGroup(), mission: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map)};
  const POI = window.ZDPOI || {containers:[], missions:[]};
  { const cl = ZD.nodes.filter(n=>n.type==='poi');
    POI.containers.forEach(c=>{ let best=null, bd=Infinity; cl.forEach(n=>{ const d=Math.hypot((c.p[0]-n.p[0])*ZD.image.width,(c.p[1]-n.p[1])*ZD.image.height); if(d<bd){bd=d;best=n.id;} }); c.cluster = bd<=260 ? best : null; c.core = bd<=120; }); }
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
    spawn:(n,sel)=> icon(`<div class="mkh" data-id="${n.id}">`+mkSvg('circle','person','sp'+(n.pair?' sp-g':'')+(sel?' sel':''), n.name.split(' ')[0])+'</div>', sel?36:26, 'z-sp'),
    extract:(n,sel)=> { const e=EXT[n.cond]||EXT.fixed; return icon(`<div class="mkh" data-id="${n.id}">`+mkSvg(e[0],e[1],e[2]+(sel?' sel':''), n.letter, e[3])+'</div>', sel?40:32, 'z-ex'); },
    key:(id)=> icon(`<div class="mkh" data-id="key-${id}">`+mkSvg('square','key','ky')+'</div>', 24, 'z-ky'),
    poi:(id)=> icon(`<div class="mkh" data-id="${id}">`+mkSvg('diamond','crate','po')+'</div>', 22, 'z-po'),
    boss:()=> icon(mkSvg('shield','skull','bs'), 30, 'z-bs'),
    step:(k)=> icon(`<svg class="mi st" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13"/><text x="16" y="21" text-anchor="middle">${k}</text></svg>`, 30, 'z-st')
  };
  const label = (m, text, cls) => m.bindTooltip(text, {permanent:true, direction:'right', offset:[12,0], className:'mlbl '+(cls||'')});
  const setLabelVisibility = () => { const z = map.getZoom(); const c = map.getContainer(); c.classList.toggle('z-low', z < -1.5); c.classList.toggle('z-mid', z >= -1.5 && z < -0.5); };
  map.on('zoomend', setLabelVisibility);

  /* ---------- state ---------- */
  const state = {mode:'normal', spawn:null, keys:new Set(), forced:new Set(), stops:2, weightLimit:false, avoid:1, maxLootMin:14, payMode:'none', contractReward:10000, allowDrop:false, passBy:true};
  const PAY_DEFAULT = {easy:'contracts', normal:'none'};

  /* ---------- graph: precomputed raster shortest paths (paths.js) ---------- */
  const nodes = {}; ZD.nodes.forEach(n => nodes[n.id] = n);
  const PATHS = window.ZDPATHS || {};
  const pair = (a,b) => PATHS[a+'|'+b] || PATHS[b+'|'+a];
  const wdist = (a,b) => a===b ? 0 : (pair(a,b) ? pair(a,b).w : Infinity);   // risk-weighted metres (for choosing)
  const mdist = (a,b) => a===b ? 0 : (pair(a,b) ? pair(a,b).m : Infinity);   // metres (for time)
  const rzone = (a,b) => a===b ? 0 : (pair(a,b) ? (pair(a,b).rz||0) : 0);     // metres of the path inside the Admin rush zone
  const geom = (a,b) => { const p = pair(a,b); if(!p) return [nodes[a].p, nodes[b].p].map(q=>[q[0]*W, q[1]*H]);
    const pts = p.pts.map(q=>[q[0]*W/ZD.image.width, q[1]*H/ZD.image.height]); return PATHS[a+'|'+b] ? pts : pts.slice().reverse(); };
  const SPEED = 4.2; // m/s average sprint-walk mix
  const mins = m => m/SPEED/60;
  const routeLatLngs = ids => { let out=[]; for(let i=1;i<ids.length;i++){ const g = geom(ids[i-1], ids[i]).map(q=>[(1-q[1]/H)*H, q[0]]); out = out.concat(i===1 ? g : g.slice(1)); } return out; };

  /* ---------- enemy spawn model ----------
     Each side: exactly one squad in its "#1" pair (W4/W5, E1/E4 - one or the other, never both) and 2 squads spread
     over its 5 other spots. Your own position is known, which conditions the rest. */
  function spawnProbs(mySpawn){
    const me = nodes[mySpawn]; const out = {};
    ['W','E'].forEach(side=>{
      const S = ZD.squads[side], mine = me.side===side;
      if(mine && S.pair.includes(mySpawn)){            // you ARE the #1 squad: the other pair spot is empty
        S.pair.forEach(id=>{ if(id!==mySpawn) out[id]=0; });
        S.random.forEach(id=>out[id]=S.randomSquads/S.random.length);
      } else if(mine){                                   // you are one of the 2 random squads
        S.pair.forEach(id=>out[id]=1/S.pair.length);
        const others = S.random.filter(id=>id!==mySpawn);
        others.forEach(id=>out[id]=(S.randomSquads-1)/others.length);
      } else {
        S.pair.forEach(id=>out[id]=1/S.pair.length);
        S.random.forEach(id=>out[id]=S.randomSquads/S.random.length);
      }
    });
    return out;
  }
  // "pressure" on a cluster: how likely enemy squads start within easy reach of it (road distance, 140 m scale, about 35 s of running)
  const pressureOf = (probs, id) => Object.entries(probs).reduce((acc,[s,p])=>acc + p*Math.exp(-mdist(s,id)/140), 0);

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
    // contested zones away from the opening rush (main substation, vault): cheaper if you are first in, worst at 3–8 min
    const timing = (n, t) => (n.risk>=3 && !n.rush) ? (t<1.5 ? 0.6 : t<3 ? 0.8 : t<8 ? 1.0 : 0.8) : 1;
    // opening rush: every "#1" squad that is not you heads straight for Admin; their presence peaks in minutes 0.5–5
    const rushers = ['W','E'].filter(side=>!ZD.squads[side].pair.includes(state.spawn)).length;
    const presence = t => t<0.5 ? 0.6 : t<5 ? 1 : t<9 ? 1-0.8*(t-5)/4 : 0.2;
    const rushRisk = (n, t) => n.rush ? avoid*prof.rush*rushers*presence(t) : 0;
    const pathRush = (a, b, tMid) => avoid*prof.rush*rushers*presence(tMid)*Math.min(1, rzone(a,b)/80);
    const lootRisk = n => 1 - Math.exp(-prof.hazard[n.risk]*n.lootMin);
    const pDeathAt = (n, travelMin, tAtArrival) => Math.min(0.9, lootRisk(n)*timing(n,tAtArrival) + prof.pTravel*travelMin + avoid*prof.pressure*(pressure[n.id]||0)*Math.max(0.25, 1 - tAtArrival/12) + rushRisk(n,tAtArrival));
    const wanted = [...new Set([...state.keys].map(k => ZD.keycards[k].node).concat([...state.forced]))];
    const roomValue = id => [...state.keys].filter(k=>ZD.keycards[k].node===id).reduce((a,k)=>a+ZD.keycards[k].ev,0);
    const valOf = n => ((mode==='easy' ? n.valueEasy : n.valueNormal) || 0) + (wanted.includes(n.id) ? roomValue(n.id) : 0);
    const extracts = ZD.nodes.filter(n=>n.type==='extract');
    const FEE = mode==='easy' ? 10000 : 40000;
    const feeOf = n => n.cond==='paid' ? FEE : 0;
    // paid extract is paid with Alloy earned in the raid: count contract stations close to the spawn or a stop
    const needContracts = Math.ceil(FEE / Math.max(1000, state.contractReward||10000));
    const stationsNear = ids => { const R = ZD.contract.radius; const out = [];
      POI.missions.forEach((ms,i)=>{ let bestId=null, bd=Infinity; ids.forEach(id=>{ const q=nodes[id].p; const dd=Math.hypot((ms.p[0]-q[0])*ZD.image.metersX,(ms.p[1]-q[1])*ZD.image.metersY); if(dd<bd){bd=dd;bestId=id;} });
        if(bd<=R) out.push({i, near:bestId, hv:ms.hv}); });
      return out.sort((x,y)=>y.hv-x.hv); };
    const extractOk = (n, stations) => { const why=[]; let ok=true;
      if(n.forSide && n.forSide!==side) { ok=false; why.push('dành cho spawn bên '+(n.forSide==='W'?'Tây':'Đông')); }
      if(n.cond==='weight' && !state.weightLimit) { ok=false; why.push('cần tổng cân nặng dưới '+(mode==='easy'?50:30)+' kg (tick ô cân nặng nếu bạn giữ được)'); }
      if(n.cond==='random' && mode!=='easy') { ok=false; why.push('không có ở chế độ Thường'); }
      if(n.cond==='random' && mode==='easy') why.push('chỉ dùng được khi có khói xanh');
      if(n.cond==='paid'){
        if(state.payMode==='none'){ ok=false; why.push(`cần ${fmt(FEE)} hợp kim kiếm trong trận: chọn "Làm hợp đồng" hoặc "Đã có đủ"`); }
        else if(state.payMode==='contracts' && stations.length < needContracts){ ok=false; why.push(`tuyến chỉ đi gần ${stations.length}/${needContracts} trạm nhiệm vụ cần để đủ ${fmt(FEE)}`); }
      }
      if(n.cond==='drop' && !state.allowDrop) { ok=false; why.push('phải bỏ toàn bộ ba lô: tick "Chấp nhận bỏ ba lô" nếu đồ quý nằm trong Hộp An Toàn và áo chiến thuật'); }
      if(n.cond==='lever') { ok=false; why.push('kéo cần báo động toàn map'); }
      return {ok, why}; };
    // evaluate one ordered plan: legs, extract choice, survival, EV (= expected Alloy after the raid, minus time cost)
    const nearOf = (a,b) => { const p = pair(a,b); return p && p.nb ? p.nb : []; };
    function passBy(a, b, visited, taken){ if(!state.passBy) return {ids:[], value:0, min:0};
      const ids = nearOf(a,b).filter(i=>{ const c=POI.containers[i]; return c.hi && !taken.has(i) && !c.core && !(c.cluster && visited.has(c.cluster)); })  // not in any cluster's core (~50 m), not in a cluster you stop at
        .sort((x,y)=>POI.containers[y].v-POI.containers[x].v).slice(0, ZD.passBy.max);
      ids.forEach(i=>taken.add(i));
      const value = ids.reduce((s,i)=>s+POI.containers[i].v*(mode==='easy'?0.4:1),0)*ZD.passBy.share;
      return {ids, value, min: ids.length*ZD.passBy.minutes}; }
    function evaluate(order){
      let c=state.spawn, tMin=0, carried=0, pSurv=1; const legs=[]; const visited=new Set(order), taken=new Set();
      for(const id of order){ const n=nodes[id]; const m=mdist(c,id); if(m===Infinity) return null; const t=mins(m); const pb=passBy(c,id,visited,taken); const pr=n.rush?0:pathRush(c,id,tMin+t/2); const p=Math.min(0.9, pDeathAt(n,t+pb.min,tMin+t+pb.min)+pr);
        legs.push({id, m, t, lootMin:n.lootMin, p, pressure:pressure[id]||0, rush:rushRisk(n,tMin+t), passRush:pr, value:valOf(n), tAt:tMin+t+pb.min, pb}); tMin += t + pb.min + n.lootMin; carried += valOf(n) + pb.value; pSurv *= (1-p); c=id; }
      const stations = stationsNear([state.spawn].concat(order));
      const cands = extracts.map(n=>{ const {ok,why}=extractOk(n, stations); const m=mdist(c,n.id); const t=mins(m), wt=mins(wdist(c,n.id)); const fee=feeOf(n);
        // contracts done for the fee cost time and exposure
        const useC = n.cond==='paid' && state.payMode==='contracts'; const cMin = useC ? needContracts*ZD.contract.minutes : 0; const cP = prof.pTravel*cMin;
        const p = Math.min(0.9, pd(n.risk)*(n.cond==='fixed'?1.3:1) + prof.pTravel*t + cP + pathRush(c, n.id, tMin + t/2));
        const lost = n.cond==='drop' ? carried*(1-ZD.dropKeep) : 0;
        const score = (ok && m!==Infinity) ? -(p*(prof.kit + 0.7*carried)) - (wt+cMin)*prof.minuteCost - fee - lost : -Infinity;
        return {n, ok: ok && m!==Infinity, why, fee, t, m, p, score, cMin, contracts: useC ? stations.slice(0,needContracts) : []}; }).sort((a,b)=>b.score-a.score);
      const ex = cands[0]; if(!ex || !ex.ok) return null;
      const exPb = passBy(c, ex.n.id, visited, taken); carried += exPb.value;
      const pAll = pSurv*(1-ex.p); const tTot = tMin + ex.t + ex.cMin + exPb.min; const dist = legs.reduce((a,l)=>a+l.m,0) + ex.m;
      const kept = ex.n.cond==='drop' ? carried*ZD.dropKeep : carried;
      const ev = pAll*kept - (1-pAll)*(prof.kit + 0.7*carried) - ex.fee - tTot*prof.minuteCost - (ex.n.cond==='drop' ? 0 : 0);
      return {order, legs, extract:ex, exPb, alternatives:cands.slice(1,5), allCands:cands, tMin:tTot, value:carried, kept, pSurv:pAll, ev, dist, stations};
    }
    // exhaustive search over stop sets (≤ stopsN clusters + the rooms you hold cards for), every order
    const pois = ZD.nodes.filter(n=>n.type==='poi' && valOf(n)>0 && !wanted.includes(n.id)).map(n=>n.id);
    const perms = arr => arr.length<=1 ? [arr] : arr.flatMap((x,i)=>perms(arr.slice(0,i).concat(arr.slice(i+1))).map(r=>[x].concat(r)));
    const combos = (arr,k) => k===0 ? [[]] : arr.flatMap((x,i)=>combos(arr.slice(i+1),k-1).map(r=>[x].concat(r)));
    // exactly stopsN clusters (plus card rooms / forced stops); fall back to fewer only if nothing fits the time budget
    let best=null;
    for(let k=stopsN;k>=0 && !best;k--) combos(pois,k).forEach(set=>{ perms(set.concat(wanted)).forEach(order=>{ const r=evaluate(order); if(!r) return;
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
        const m = L.marker(toLL(n.p), {icon: icons.spawn(n,false), zIndexOffset:500}).addTo(layers.spawn);
        label(m, n.name.split(' ')[0], 'lbl-sp'); spawnMarkers[n.id] = m;
        m.on('click', ()=>{ state.spawn=n.id; spawnSel.value=n.id; render(); });
      } else if(n.type==='extract'){
        const m = L.marker(toLL(n.p), {icon: icons.extract(n,false), zIndexOffset:400}).addTo(layers.extract);
        m.bindPopup(`<b>${n.letter} · ${n.name}</b><br>${n.desc}${n.forSide?`<br>Dành cho spawn bên ${n.forSide==='W'?'Tây':'Đông'}`:''}`);
        label(m, n.letter+' · '+n.name.split(' (')[0], 'lbl-ex');
      } else if(n.type==='poi'){
        const m = L.marker(toLL(n.p), {icon: icons.poi(n.id), zIndexOffset:100}).addTo(layers.poi);
        m.bindPopup(()=>`<b>${n.name}</b><br>${n.loot}<br><span class="risk r${n.risk}">rủi ro ${RISK[n.risk]}</span> · ~${fmt(Math.round(n.valueNormal/1000))}k Normal / ${fmt(Math.round(n.valueEasy/1000))}k Easy<br><button class="pick-poi" data-id="${n.id}">${state.forced.has(n.id)?'Bỏ ép ghé cụm này':'Ép ghé cụm này'}</button>`);
        label(m, n.name.split(' (')[0].split(' / ')[0], 'lbl-po');
      } else if(n.type==='boss'){
        const m = L.marker(toLL(n.p), {icon: icons.boss(), zIndexOffset:350}).addTo(layers.poi);
        m.bindPopup(`<b>${n.name}</b><br>M249, lựu đạn khói/cháy; guard Flamethrower + Rocketeer tuần tra lòng đập.`);
        label(m, 'Saeed', 'lbl-bs');
      }
    });
    Object.entries(ZD.keycards).forEach(([id,k])=>{
      const n = nodes[k.node]; if(!n) return;
      const m = L.marker(toLL(k.p || n.p), {icon: icons.key(id), zIndexOffset:200}).addTo(layers.key);
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
      el.querySelectorAll('.pick-key').forEach(b=>b.addEventListener('click', ()=>{ const cb=document.getElementById('key-'+b.dataset.id); if(cb && !cb.checked){ cb.checked=true; state.keys.add(b.dataset.id); keysCount(); } map.closePopup(); render(); })); });
    setLabelVisibility();
  }
  const RISK = ['rất thấp','thấp','trung bình','cao','rất cao'];
  const spawnMarkers = {};
  const PXM = W/ZD.image.metersX; // image px per metre
  function render(){
    layers.route.clearLayers(); layers.heat.clearLayers();
    const out = $('#out'), opt = $('#options');
    if(!state.spawn){ map.fitBounds(bounds); out.innerHTML = '<p class="hint">Bấm một chấm xanh (điểm spawn) trên map, hoặc chọn trong danh sách.</p>'; opt.innerHTML=''; 
      Object.values(spawnMarkers).forEach(m=>m.setTooltipContent(nodes[Object.keys(spawnMarkers).find(k=>spawnMarkers[k]===m)].name.split(' ')[0])); return; }
    const r = plan();
    // enemy spawn probabilities: heat circles + % on labels
    Object.entries(spawnMarkers).forEach(([id,m])=>{ const p = r.probs[id]; const short = nodes[id].name.split(' ')[0];
      m.setTooltipContent(id===state.spawn ? short+' · bạn' : short+' · '+Math.round((p||0)*100)+'%');
      if(p>0){ L.circle(toLL(nodes[id].p), {radius: 100*PXM, color:'#e53935', weight:1, opacity:0.55, dashArray:'4 4', fillColor:'#e53935', fillOpacity:0.04+0.16*p, interactive:false}).addTo(layers.heat); } });
    const ll = routeLatLngs(r.route);
    L.polyline(ll, {color:'#1c1c1c', weight:8, opacity:.55}).addTo(layers.route);
    L.polyline(ll, {color:'#ff6a00', weight:4, opacity:.95}).addTo(layers.route);
    let k=1; r.stops.forEach(id=>{ L.marker(toLL(nodes[id].p), {icon: icons.step(k++), zIndexOffset:600}).addTo(layers.route); });
    L.marker(toLL(nodes[state.spawn].p), {icon: icons.spawn(nodes[state.spawn],true), zIndexOffset:700}).addTo(layers.route);
    if(r.extract && r.extract.ok) L.marker(toLL(r.extract.n.p), {icon: icons.extract(r.extract.n,true), zIndexOffset:700}).addTo(layers.route);
    const pbAll = r.legs.flatMap(l=>l.pb?l.pb.ids:[]).concat(r.exPb?r.exPb.ids:[]);
    pbAll.forEach(i=>{ const c=POI.containers[i]; L.circleMarker(toLL(c.p), {radius:11, color:'#ff6a00', weight:3, fill:false, interactive:false}).addTo(layers.route); });
    (r.extract && r.extract.contracts || []).forEach((s,k2)=>{ const ms=POI.missions[s.i];
      L.polyline([toLL(nodes[s.near].p), toLL(ms.p)], {color:'#ff6a00', weight:3, dashArray:'5 5', opacity:.95}).addTo(layers.route);
      L.marker(toLL(ms.p), {icon: L.divIcon({className:'mkw z-ms', html:`<div class="ms ct${ms.hv?' hv':''}"><span>!${k2+1}</span></div>`, iconSize:[24,24], iconAnchor:[12,12]}), zIndexOffset:650}).addTo(layers.route)
        .bindTooltip(`Hợp đồng ${k2+1}: trạm gần ${nodes[s.near].name.split(' (')[0]}`, {direction:'top'}); });
    map.fitBounds(L.latLngBounds(ll).pad(0.15));

    const sp = nodes[state.spawn];
    const pct = x => Math.round(x*100)+'%';
    let html = `<div class="sum"><div><span class="lbl">Spawn</span><b>${sp.name.split(' · ')[0]}</b> bên ${r.side==='W'?'Tây':'Đông'}</div>
      <div><span class="lbl">Loot kỳ vọng</span><b>~${fmt(Math.round((r.kept??r.value)/1000))}k</b>${r.kept!==undefined && r.kept<r.value?' <span class="sub">(bỏ ba lô)</span>':''}</div>
      <div><span class="lbl">Thời gian</span><b>~${Math.round(r.tMin)} ph</b></div>
      <div><span class="lbl">Quãng đường</span><b>~${fmt(Math.round(r.dist/10)*10)} m</b></div>
      <div><span class="lbl">Sống sót</span><b>${pct(r.pSurv)}</b></div>
      <div><span class="lbl">EV mỗi trận</span><b>${r.ev>=0?'+':'−'}${fmt(Math.round(Math.abs(r.ev)/1000))}k</b></div></div>`;
    if(state.forced.size){ const free = (()=>{ const f=new Set(state.forced); state.forced=new Set(); const x=plan(); state.forced=f; return x; })();
      html += `<div class="forced">Ép ghé: ${[...state.forced].map(id=>`<span class="chip">${nodes[id].name} <button type="button" class="unforce" data-id="${id}" aria-label="bỏ">×</button></span>`).join(' ')}<br><span class="sub">So với tuyến tự do (${free.stops.map(id=>nodes[id].name.split(' (')[0]).join(' → ')||'không loot'}): EV ${free.ev>=0?'+':'−'}${fmt(Math.round(Math.abs(free.ev)/1000))}k, sống ${pct(free.pSurv)} → tuyến ép: EV ${r.ev>=0?'+':'−'}${fmt(Math.round(Math.abs(r.ev)/1000))}k, sống ${pct(r.pSurv)}.</span></div>`; }
    html += '<ol class="steps">';
    const pbText = pb => { if(!pb || !pb.ids.length) return ''; const by={}; pb.ids.forEach(i=>{ const nm=POI.containers[i].n; by[nm]=(by[nm]||0)+1; });
      return `<br><span class="pbline">Nhặt dọc đường: ${Object.entries(by).map(([k4,v])=>v+' '+k4.toLowerCase()).join(', ')} (~${fmt(Math.round(pb.value/1000))}k, +${pb.min.toFixed(1)} ph), vòng cam trên map</span>`; };
    r.legs.forEach(l=>{ const n=nodes[l.id]; const keys=[...state.keys].filter(kk=>ZD.keycards[kk].node===l.id);
      const near = POI.missions.filter(ms=>Math.hypot((ms.p[0]-n.p[0])*ZD.image.metersX,(ms.p[1]-n.p[1])*ZD.image.metersY) < 65).length;
      html += `<li><b>${n.name}</b>${state.forced.has(l.id)?' <span class="chip">ép</span>':''} <span class="risk r${n.risk}">rủi ro ${RISK[n.risk]}</span> <span class="sub">đi ~${Math.round(l.m)} m · ${l.t.toFixed(1)} ph · loot ${n.lootMin} ph · p chết ${pct(l.p)}${l.pressure>0.25?' · <span class="hot">áp lực địch '+pct(Math.min(1,l.pressure))+'</span>':''}${l.rush>0.03?' · <span class="hot">tới phút '+l.tAt.toFixed(1)+': đội một hiệu đang lao vào Admin</span>':''}${l.passRush>0.03?' · <span class="hot">đường đi cắt qua Admin lúc các đội đang lao vào</span>':''}</span><br><span class="sub">${n.loot}</span>${pbText(l.pb)}${near?`<br><span class="sub">! ${near} trạm nhiệm vụ trong 65 m</span>`:''}${keys.map(kk=>`<br><span class="keyline">🔑 ${ZD.keycards[kk].name}: ${ZD.keycards[kk].tip}</span>`).join('')}</li>`; });
    if(r.extract && r.extract.ok){ const e=r.extract.n; const cts=r.extract.contracts||[];
      if(cts.length){ const byStop={}; cts.forEach(s=>{ const nm=nodes[s.near].name.split(' (')[0]; byStop[nm]=(byStop[nm]||0)+1; });
        html += `<li class="contract"><b>Làm ${cts.length} hợp đồng để đủ ${fmt(r.extract.fee)} hợp kim</b><br><span class="sub">${Object.entries(byStop).map(([k3,v])=>`${v} ở trạm gần ${k3}`).join(', ')} · thêm ~${r.extract.cMin.toFixed(1)} phút · giả định ${fmt(state.contractReward)} hợp kim mỗi hợp đồng. Nhận hợp đồng ngay khi tới cụm, làm xong trước khi rút.</span></li>`; }
      const fb = e.cond==='random' ? (r.allCands||[]).find(x=>x.ok && x.n.cond!=='random') : null;
      html += `<li class="exit"><b>Rút: ${e.letter} · ${e.name}</b>${pbText(r.exPb)}<br><span class="sub">${e.desc}${r.extract.fee?` · phí ${fmt(r.extract.fee)}`:''} · ~${Math.round(r.extract.t)} phút di chuyển · p chết ${pct(r.extract.p)}</span>${fb?`<br><span class="sub"><b>Không thấy khói xanh:</b> đi ${fb.n.letter} · ${fb.n.name} (~${Math.round(fb.t)} phút từ cụm cuối${fb.fee?', phí '+fmt(fb.fee):''}).</span>`:''}</li>`; }
    else html += `<li class="exit"><b>Không có điểm rút phù hợp</b> với điều kiện đã chọn.</li>`;
    html += '</ol>';
    html += '<details><summary>Điểm rút dự phòng</summary><ul class="alt">' + r.alternatives.map(a=>`<li><b>${a.n.letter} · ${a.n.name}</b> — ${a.ok?('~'+Math.round(a.t)+' phút'+(a.fee?', phí '+fmt(a.fee):'')+(a.contracts&&a.contracts.length?`, cần ${a.contracts.length} hợp đồng (+${a.cMin.toFixed(1)} ph), EV thấp hơn tuyến đang chọn`:'')):a.why.join('; ')}</li>`).join('') + '</ul></details>';
    const warn = [];
    const short = id => nodes[id].name.split(' ')[0];
    ['W','E'].forEach(side=>{ const S=ZD.squads[side]; const sideVi = side==='W'?'Tây':'Đông';
      if(S.pair.includes(state.spawn)){ const other=S.pair.find(id=>id!==state.spawn);
        warn.push(`Bạn là đội "một hiệu" bên ${sideVi}: ${short(other)} chắc chắn trống. 2 đội còn lại bên ${sideVi} nằm ở ${S.random.map(short).join(', ')} (40% mỗi điểm).`); }
      else warn.push(`Chắc chắn có đúng 1 đội ở ${S.pair.map(short).join(' hoặc ')} (50/50, không bao giờ cả hai). Đây là cặp "một hiệu" bên ${sideVi}, thường lao thẳng vào Admin.`); });
    warn.push('Vòng đỏ là bán kính 100 m quanh spawn có thể có địch, càng đậm càng chắc.');
    if(sp.pair) warn.push('Spawn này chạy tới Admin chỉ mất khoảng 30–50 giây: đội một hiệu bên kia cũng vậy, đừng đứng loot ở giữa.');
    if(r.ev < 0) warn.push('Với điều kiện đang chọn, mọi tuyến đều lỗ trung bình. Giữ tổng cân nặng dưới giới hạn để dùng Đỉnh đập, làm hợp đồng để trả phí, hoặc chơi Dễ.');
    if(state.payMode==='none' && sp.side==='W' && !state.weightLimit) warn.push(`Spawn bên Tây chưa có hợp kim: nếu giữ được tổng cân nặng dưới ${state.mode==='easy'?50:30} kg, tick ô cân nặng để mở Đỉnh đập, thường an toàn hơn điểm cố định B nhiều.`);
    if(state.payMode==='none' && sp.side==='E' && !state.allowDrop) warn.push('Spawn bên Đông chưa có hợp kim: lối miễn phí chỉ có điểm cố định A (xa, hay bị camp) hoặc Đường bảo trì E (bỏ ba lô). Nếu cất đồ quý trong Hộp An Toàn và áo chiến thuật, tick "Chấp nhận bỏ ba lô".');
    if(r.extract && r.extract.ok && r.extract.n.cond==='drop') warn.push(`Rút bỏ ba lô: trang giả định giữ được ${Math.round(ZD.dropKeep*100)}% giá trị loot (đồ nhỏ trong Hộp An Toàn và áo chiến thuật). Trước khi tới E, chuyển đồ quý khỏi ba lô.`);
    if(r.extract && r.extract.ok && r.extract.n.cond==='paid' && state.payMode!=='none') warn.push('Chỉ trả phí khi đồ ngoài Hộp An Toàn đáng khoảng 150.000 trở lên. Dưới mức đó, giữ lại hợp kim và đi Đỉnh đập hoặc điểm cố định.');
    if(state.keys.size) warn.push('Bán thẻ được trước khi dùng; nhìn qua cửa sổ trước khi mở.');
    warn.push('Cất đồ đỏ/vàng/thẻ vào Hộp An Toàn ngay khi nhặt. Ngừng loot khi còn 3 phút.');
    html += '<ul class="warn">' + warn.map(w=>`<li>${w}</li>`).join('') + '</ul>';
    out.innerHTML = html;
    out.querySelectorAll('.unforce').forEach(b=>b.addEventListener('click', ()=>{ state.forced.delete(b.dataset.id); render(); }));
    // options table: 1 / 2 / 3 clusters
    const rows = [1,2,3].map(n=>({n, r: plan({stops:n, maxLootMin: n===1?8:(n===2?14:20)})}));
    const bestN = rows.reduce((b,x)=> x.r.ev > b.r.ev ? x : b, rows[0]).n;
    opt.innerHTML = '<p class="sub">Mỗi dòng là tuyến tốt nhất khi dừng đúng số cụm đó. Cụm: '+rows.map(x=>x.n+' = '+(x.r.stops.map(id=>nodes[id].name.split(' (')[0].split(' / ')[0]).join(' → ')||'không')).join(' · ')+'</p><table class="opts"><thead><tr><th>Cụm</th><th>Loot</th><th>Phút</th><th>Sống</th><th>EV</th><th></th></tr></thead><tbody>' + rows.map(({n,r:x})=>
      `<tr class="${n===state.stops?'cur':''}"><td>${n}${n===bestN?' <span class="chip">khuyên dùng</span>':''}</td><td class="num">${fmt(Math.round(x.value/1000))}k</td><td class="num">${Math.round(x.tMin)}</td><td class="num">${pct(x.pSurv)}</td><td class="num">${x.ev>=0?'+':'−'}${fmt(Math.round(Math.abs(x.ev)/1000))}k</td><td><button type="button" class="pickopt" data-n="${n}">${n===state.stops?'đang xem':'xem'}</button></td></tr>`).join('') + '</tbody></table>';
    opt.querySelectorAll('.pickopt').forEach(b=>b.addEventListener('click', ()=>{ state.stops=+b.dataset.n; state.maxLootMin = state.stops===1?8:(state.stops===2?14:20); document.querySelectorAll('input[name=goal]').forEach(x=>x.checked = +x.value===state.stops); render(); }));
  }

  /* ---------- controls ---------- */
  const spawnSel = $('#spawnSel');
  ZD.nodes.filter(n=>n.type==='spawn').forEach(n=>{ const o=document.createElement('option'); o.value=n.id; o.textContent=n.name; spawnSel.appendChild(o); });
  spawnSel.addEventListener('change', e=>{ state.spawn=e.target.value||null; render(); });
  const keyBox = $('#keys');
  Object.entries(ZD.keycards).forEach(([id,k])=>{ const l=document.createElement('label'); l.innerHTML=`<input type="checkbox" id="key-${id}" value="${id}"> ${k.name} <span class="sub">~${fmt(Math.round(k.price/1000))}k</span>`; keyBox.appendChild(l);
    l.querySelector('input').addEventListener('change', e=>{ e.target.checked?state.keys.add(id):state.keys.delete(id); render(); }); });
  const keysCount = () => { const n = state.keys.size; const el = $('#keysCount'); if(el) el.textContent = n ? `(${n} đã chọn)` : ''; };
  keyBox.addEventListener('change', keysCount);
  try { if(window.matchMedia('(max-width: 860px)').matches) $('#keysBox').open = false; } catch(e) {}
  const paySel = $('#pay'), rewardIn = $('#reward'), rewardRow = $('#rewardRow');
  const syncPay = () => { paySel.value = state.payMode; rewardRow.hidden = state.payMode!=='contracts'; };
  paySel.addEventListener('change', e=>{ state.payMode=e.target.value; syncPay(); render(); });
  rewardIn.addEventListener('change', e=>{ const v=Math.max(1000, +e.target.value||10000); state.contractReward=v; e.target.value=v; render(); });
  syncPay();
  document.querySelectorAll('input[name=mode]').forEach(r=>r.addEventListener('change', e=>{ state.mode=e.target.value; state.payMode=PAY_DEFAULT[state.mode]; syncPay(); render(); }));
  document.querySelectorAll('input[name=goal]').forEach(r=>r.addEventListener('change', e=>{ state.stops=+e.target.value; state.maxLootMin = state.stops===1?8:(state.stops===2?14:20); render(); }));
  $('#avoid').addEventListener('input', e=>{ state.avoid=+e.target.value; $('#avoidV').textContent=['tắt','thấp','vừa','cao','rất cao'][Math.round(+e.target.value*2)]; render(); });
  $('#wl').addEventListener('change', e=>{ state.weightLimit=e.target.checked; render(); });
  $('#drop').addEventListener('change', e=>{ state.allowDrop=e.target.checked; render(); });
  $('#passby').addEventListener('change', e=>{ state.passBy=e.target.checked; render(); });
  document.querySelectorAll('[data-layer]').forEach(cb=>{ const l=layers[cb.dataset.layer]; if(cb.checked && !map.hasLayer(l)) map.addLayer(l); if(!cb.checked && map.hasLayer(l)) map.removeLayer(l);
    cb.addEventListener('change', e=>{ e.target.checked?map.addLayer(l):map.removeLayer(l); }); });

  window.ZDplan = (st)=>{ Object.assign(state, st); if(st.keys) state.keys=new Set(st.keys); if(st.forced) state.forced=new Set(st.forced); return plan(); };
  const lg=$('#legend'); $('#legendBtn').addEventListener('click', ()=>{ lg.hidden=!lg.hidden; });
  drawStatic(); render();
})();
