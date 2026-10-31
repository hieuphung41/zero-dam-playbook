// Real-Chromium session against the planner: every spawn clicked on a fresh page, occlusion check, legend, cards, options, forced cluster.
const path=require('path'), fs=require('fs'); const {chromium}=require(path.join(process.argv[2],'node_modules/playwright'));
const OUT=process.argv[3], URL=process.argv[4]; const log=[]; const say=(...a)=>{ const m=a.join(' '); log.push(m); console.log(m); };
const SPAWNS=['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','s12','s13','s14'];
(async()=>{
  const browser=await chromium.launch(); const problems=[];
  for(const vp of [{name:'desktop',width:1400,height:900,scheme:'light'},{name:'phone',width:390,height:844,scheme:'dark',mobile:true}]){
    const ctx=await browser.newContext({viewport:{width:vp.width,height:vp.height}, colorScheme:vp.scheme, isMobile:!!vp.mobile, hasTouch:!!vp.mobile});
    const page=await ctx.newPage(); const errs=[], failed=[];
    page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); }); page.on('pageerror',e=>errs.push('pageerror: '+e.message));
    page.on('response',r=>{ if(r.status()>=400) failed.push(r.url()+' HTTP '+r.status()); });
    const open=async()=>{ await page.goto(URL,{waitUntil:'load',timeout:90000}); await page.waitForSelector('.mkh[data-id="s1"]'); await page.waitForTimeout(400); };
    await open();
    const legend0=await page.evaluate(()=>getComputedStyle(document.getElementById('legend')).display);
    await page.click('#legendBtn',{timeout:3000}); const legend1=await page.evaluate(()=>getComputedStyle(document.getElementById('legend')).display);
    await page.screenshot({path:`${OUT}/${vp.name}_legend_open.png`});
    await page.click('#legendBtn',{timeout:3000}); const legend2=await page.evaluate(()=>getComputedStyle(document.getElementById('legend')).display);
    say(`[${vp.name}] legend at load=${legend0}, after 1 click=${legend1}, after 2 clicks=${legend2}`); if(legend0!=='none'||legend1==='none'||legend2!=='none') problems.push(vp.name+': legend toggle');
    const scroll=await page.evaluate(()=>({sw:document.documentElement.scrollWidth, vw:innerWidth})); say(`[${vp.name}] page width ${scroll.sw} / viewport ${scroll.vw}`); if(scroll.sw>scroll.vw) problems.push(vp.name+': horizontal scroll');
    await page.screenshot({path:`${OUT}/${vp.name}_0_load.png`});
    // every spawn on a fresh page
    for(const id of SPAWNS){
      await open();
      const info=await page.evaluate(id=>{ const el=document.querySelector(`.mkh[data-id="${id}"]`); const r=el.getBoundingClientRect(); const mr=document.getElementById('map').getBoundingClientRect();
        const x=(r.left+r.right)/2, y=(r.top+r.bottom)/2; const top=document.elementFromPoint(x,y); const hit=top && (top===el || el.contains(top) || top.closest('.mkh')===el);
        return {x,y,inMap: x>=mr.left&&x<=mr.right&&y>=mr.top&&y<=mr.bottom, hit, topDesc: top? (top.closest('.mkh')?.dataset.id || top.className?.baseVal || top.className || top.tagName):'none'}; },id);
      if(!info.inMap){ say(`[${vp.name}] ${id}: outside visible map`); problems.push(`${vp.name}: ${id} outside map`); continue; }
      if(vp.mobile) await page.tap(`.mkh[data-id="${id}"]`,{force:false,timeout:3000}).catch(async e=>{ await page.mouse.click(info.x,info.y); });
      else await page.mouse.click(info.x,info.y);
      await page.waitForTimeout(500);
      const st=await page.evaluate(()=>({sel:document.getElementById('spawnSel').value, path:document.querySelectorAll('.leaflet-overlay-pane path').length, head:document.querySelector('#out .sum')?.innerText.replace(/\s+/g,' ')||'', steps:[...document.querySelectorAll('#out .steps li')].map(li=>li.querySelector('b')?.innerText).join(' > ')}));
      const ok = st.sel===id && st.path>0;
      say(`[${vp.name}] ${id}: ${ok?'OK':'FAIL'} (on top at click point: ${info.hit?'marker itself':info.topDesc}) route: ${st.steps} | ${st.head}`);
      if(!ok) problems.push(`${vp.name}: click ${id} failed, covered by ${info.topDesc}`);
      if(['s4','s1','s8'].includes(id)) await page.screenshot({path:`${OUT}/${vp.name}_spawn_${id}.png`});
    }
    // cards, options, forced cluster on W4
    await open(); await page.selectOption('#spawnSel','s4'); await page.waitForTimeout(300);
    const kb=await page.$('#keysBox'); const kOpen=await kb.evaluate(e=>e.open); say(`[${vp.name}] keycard list open at load: ${kOpen}`); if(!kOpen) await page.click('#keysBox>summary');
    await page.check('#key-tech'); await page.waitForTimeout(300); say(`[${vp.name}] keycard counter: `+await page.innerText('#keysCount'));
    say(`[${vp.name}] W4 + Tech Room card: `+[...(await page.$$eval('#out .steps li b',els=>els.map(e=>e.innerText)))].join(' > '));
    await page.uncheck('#key-tech');
    await page.click('.pickopt[data-n="1"]'); await page.waitForTimeout(300);
    say(`[${vp.name}] option 1: `+(await page.$$eval('#out .steps li b',els=>els.map(e=>e.innerText))).join(' > '));
    await page.click('.pickopt[data-n="2"]'); await page.waitForTimeout(300);
    const pm=await page.$('.mkh[data-id="adminOut"]');
    if(pm){ const vis=await pm.isVisible(); if(vis){ await pm.click({timeout:3000}).catch(()=>{}); await page.waitForTimeout(300); const b=await page.$('.pick-poi'); if(b){ await b.click(); await page.waitForTimeout(400);
      say(`[${vp.name}] forced container: `+(await page.innerText('#out .forced')).replace(/\s+/g,' ')); await page.screenshot({path:`${OUT}/${vp.name}_forced.png`}); } else { say(`[${vp.name}] popup without force button`); problems.push(vp.name+': force popup'); } }
      else say(`[${vp.name}] container marker hidden at route zoom`); }
    // layers toggles
    for(const ly of ['ly-heat','ly-box','ly-mission']){ await page.uncheck('#'+ly); await page.waitForTimeout(150); }
    const after=await page.evaluate(()=>({heat:document.querySelectorAll('.leaflet-overlay-pane path').length, box:document.querySelectorAll('.mkw.z-bx').length, ms:document.querySelectorAll('.mkw.z-ms').length}));
    say(`[${vp.name}] after hiding heat/boxes/missions: `+JSON.stringify(after));
    if(vp.mobile){ await page.screenshot({path:`${OUT}/${vp.name}_panel_full.png`, fullPage:true}); }
    say(`[${vp.name}] console errors: ${JSON.stringify(errs)}`); say(`[${vp.name}] failed requests: ${JSON.stringify(failed)}`);
    if(errs.length) problems.push(vp.name+': console errors'); if(failed.length) problems.push(vp.name+': failed requests');
    await ctx.close();
  }
  await browser.close(); say('PROBLEMS: '+(problems.length?problems.join('; '):'none')); fs.writeFileSync(OUT+'/log2.txt', log.join('\n'));
})().catch(e=>{ console.error('E2E FAILED', e.message); process.exit(1); });
