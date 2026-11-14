// Cloud save sync test against a fake GitHub Gist API, with two simulated devices.
// Run:  node tests/sync-test.js      (needs Playwright + Chromium; set CHROME=/path if Chromium isn't found)
// Each device is its own browser context (separate localStorage), both talking to the same fake GitHub.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const server = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
  const fp = path.join(ROOT, f);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { r.writeHead(404); return r.end(); }
  const ext = path.extname(fp), type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png' }[ext] || 'text/plain';
  r.writeHead(200, { 'content-type': type }); fs.createReadStream(fp).pipe(r);
});

// ---- fake GitHub Gist API ----
const TOKEN = 'ghp_test123';
const GHS = { gists: {}, n: 0, offline: {}, privacy: {} };
const gjson = g => ({ id: g.id, description: g.description, public: g.public, files: Object.fromEntries(Object.entries(g.files).map(([k, v]) => [k, { filename: k, content: v, truncated: false, raw_url: 'https://example.invalid/' + k }])) });
const gist = () => Object.values(GHS.gists)[0];
const meta = () => { const g = gist(); return g && g.files['orerush-meta.json'] ? JSON.parse(g.files['orerush-meta.json']) : null; };
const live = () => { const g = gist(); return g && g.files['orerush-live.json'] ? JSON.parse(g.files['orerush-live.json']) : null; };
async function fakeGitHub(ctx, dev) {
  await ctx.route('https://api.github.com/**', async route => {
    if (GHS.offline[dev]) return route.abort('internetdisconnected');
    const r = route.request(), u = new URL(r.url()), m = r.method();
    if (r.headers()['authorization'] !== 'Bearer ' + TOKEN) return route.fulfill({ status: 401, body: '{}' });
    const send = o => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.pathname === '/gists' && m === 'GET') return send(Object.values(GHS.gists).map(g => ({ id: g.id, description: g.description })));
    if (u.pathname === '/gists' && m === 'POST') {
      const b = JSON.parse(r.postData()), id = 'g' + (++GHS.n);
      GHS.gists[id] = { id, description: b.description, public: b.public, files: Object.fromEntries(Object.entries(b.files).map(([k, v]) => [k, v.content])) };
      return send(gjson(GHS.gists[id]));
    }
    const g = GHS.gists[u.pathname.split('/')[2]]; if (!g) return route.fulfill({ status: 404, body: '{}' });
    if (m === 'PATCH') { const b = JSON.parse(r.postData()); for (const [k, v] of Object.entries(b.files)) if (v) g.files[k] = v.content; else delete g.files[k]; }
    return send(gjson(g));
  });
}

// helpers that run inside a device's page
const IN = {
  // make a saved game at a given sector (as if the player got there)
  save: (p, lvl, sc, t) => p.evaluate(([lvl, sc, t]) => { resetProgress(); level = lvl; score = sc; credits = sc / 2; playT = t; saveGame(); }, [lvl, sc, t]),
  level: p => p.evaluate(() => (store.get(SAVE) || {}).level),
  dlg: p => p.evaluate(() => state === 'syncask' && !!SY.ans ? document.getElementById('ov').textContent : ''),
  waitDlg: async (p, text) => { for (let i = 0; i < 150; i++) { const t = await IN.dlg(p); if (t && (!text || t.includes(text))) return t; await p.waitForTimeout(40); } return ''; },
  answer: (p, v) => p.evaluate(v => SY.ans && SY.ans(v), v),
  idle: async p => { for (let i = 0; i < 150; i++) { if (await p.evaluate(() => !SY.busy && !SY.asking)) return; await p.waitForTimeout(40); } },
  sync: async (p, manual) => { await p.evaluate(m => { syncNow(m); }, !!manual); await p.waitForTimeout(80); },
  syncDone: async (p, manual) => { await p.evaluate(m => syncNow(m), !!manual); await IN.idle(p); },
};

(async () => {
  await new Promise(r => server.listen(8099, r));
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const results = [], check = (name, cond) => { results.push([name, !!cond]); console.log((cond ? 'PASS ' : 'FAIL ') + name); };
  const errs = [];
  const device = async (dev, ua) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, userAgent: ua, serviceWorkers: 'block' });
    await fakeGitHub(ctx, dev);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(dev + ': ' + e.message));
    await p.goto('http://localhost:8099/'); await p.waitForTimeout(500);
    await p.evaluate(() => { SYNC_SOON_MS = 1e9; });   // the test triggers syncs itself (the "soon after saving" upload is checked separately)
    return p;
  };
  const A = await device('A', 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130 Safari/537.36');            // tablet
  const B = await device('B', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36');    // phone

  // ---------- setup UI ----------
  await A.click('button[data-act=cloud]');
  const setup = await A.evaluate(() => ({ txt: document.getElementById('ov').textContent, name: document.getElementById('syncName').value, link: [...document.querySelectorAll('#ov a')].map(a => a.href).join() }));
  check('setup screen shows token link with gist scope + game name, device name defaults to Tablet',
    setup.link.includes('https://github.com/settings/tokens/new?scopes=gist&description=Ore%20Rush') && setup.name === 'Tablet' && setup.txt.includes('gist'));
  check('phone gets the default name Phone', await B.evaluate(() => devGuess()) === 'Phone');

  // ---------- 1. device A connects to an empty cloud → creates the private Gist and uploads ----------
  await IN.save(A, 5, 50000, 1800);
  await A.fill('#syncTok', TOKEN); await A.click('button[data-act=syncConnect]'); await IN.idle(A);
  const g1 = gist(), m1 = meta();
  check('A: first upload creates ONE private Gist found by "Ore Rush" description',
    Object.keys(GHS.gists).length === 1 && g1.public === false && g1.description === await A.evaluate(() => GIST_DESC) && /^Ore Rush (DEV )?save/.test(g1.description));
  check('A: Gist holds save + meta + live marker; meta has version, device, name, time, sector, score, play time',
    g1.files['orerush-save.txt'].startsWith('ORS2:') && m1.ver === 1 && m1.dev && m1.name === 'Tablet' && m1.level === 5 && m1.score === 50000 && m1.t === 1800 && m1.time > 0 && live().dev === m1.dev);
  check('token is kept on the device only (in localStorage, never in the Gist)',
    !JSON.stringify(GHS.gists).includes(TOKEN) && (await A.evaluate(() => JSON.parse(localStorage.getItem(KP + 'orerush_sync')).token)) === TOKEN);
  await A.evaluate(() => showTitle());
  check('menu shows status "Synced just now · Tablet"', (await A.evaluate(() => document.getElementById('syncSt').textContent)).includes('Synced just now · Tablet'));

  // ---------- 2. device B (own small game) connects → asks, shows both sides; B picks the cloud ----------
  await IN.save(B, 2, 3000, 300);
  await B.evaluate(t => { SC.token = t; SC.name = 'Phone'; scSave(); SY.liveOk = true; }, TOKEN);  // (the "is playing" warning is tested on A below)
  await IN.sync(B, true);
  let d = await IN.waitDlg(B, 'A cloud save already exists');
  check('B: first connection to a non-empty cloud asks, showing both sides (sector, haul, play time, when saved)',
    d.includes('Sector 2') && d.includes('Sector 5') && d.includes('Tablet') && d.includes('30 min played') && d.includes('saved just now') && d.includes('Decide later'));
  await IN.answer(B, 'cloud'); await IN.idle(B);
  check('B: "Use the cloud game" loads A\'s game and keeps B\'s old game locally (Undo available)',
    await IN.level(B) === 5 && (await B.evaluate(() => JSON.parse(store.get(PRESYNC).raw).level)) === 2 && await B.evaluate(() => SY.undo));

  // ---------- 3. B plays (saves) → its base is still in the cloud → uploads version 2 ----------
  await IN.save(B, 6, 60000, 2400); await IN.syncDone(B);
  check('B: played since its base and the cloud still holds the base → uploads v2', meta().ver === 2 && meta().name === 'Phone' && meta().level === 6 && !(await IN.dlg(B)));

  // ---------- 4. A (not played) while B was playing a moment ago → warning; continue → loads automatically ----------
  await IN.sync(A, false);
  d = await IN.waitDlg(A, 'is playing');
  check('A: another device\'s live marker is fresh and not closed → asks before taking over', d.includes('Phone is playing'));
  await IN.answer(A, '1'); await IN.idle(A);
  check('A: cloud newer + A not played since its base → loads v2 automatically, no conflict question; old game kept for Undo',
    await IN.level(A) === 6 && (await A.evaluate(() => SC.base)) === 2 && !(await IN.dlg(A)) && (await A.evaluate(() => JSON.parse(store.get(PRESYNC).raw).level)) === 5);

  // ---------- 5. Undo restores the local copy and pauses; Resume forgets the base and asks again ----------
  await A.evaluate(() => showCloud()); await A.click('button[data-act=syncUndo]');
  const vBefore = meta().ver;
  check('A: Undo last sync restores the game from before the sync and pauses sync', await IN.level(A) === 5 && await A.evaluate(() => SC.paused === true));
  await IN.syncDone(A, true);
  check('A: while paused nothing is uploaded or loaded', meta().ver === vBefore && await IN.level(A) === 5);
  await A.click('button[data-act=syncResume]');
  d = await IN.waitDlg(A, 'A cloud save already exists');
  check('A: Resume asks which game to keep (base forgotten)', !!d);
  await IN.answer(A, 'cloud'); await IN.idle(A);
  check('A: picked the cloud → back on v2', await IN.level(A) === 6 && (await A.evaluate(() => SC.base)) === 2);

  // ---------- 6. B plays and leaves the app → uploads and marks itself closed ----------
  await IN.save(B, 7, 70000, 3000); await B.evaluate(() => syncLeave()); await IN.idle(B);
  check('B: leaving the app uploads the change and marks the live marker closed', meta().ver === 3 && meta().level === 7 && live().closed === true && live().name === 'Phone');

  // ---------- 7. A comes back to the app → no warning (B closed) → loads v3 by itself ----------
  await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await A.waitForTimeout(100); await IN.idle(A);
  check('A: becoming visible again syncs; B closed the game so no warning; v3 loads automatically', await IN.level(A) === 7 && !(await IN.dlg(A)));

  // ---------- 8. downgrade guard: a newer version with LOWER progress → asks; keep this device → backup ----------
  const oldCode = await B.evaluate(() => { const keep = store.get(SAVE); resetProgress(); level = 3; score = 9000; saveGame(); const c = saveCode(); store.set(SAVE, keep); loadGame(keep); return c; });
  gist().files['orerush-save.txt'] = oldCode;
  gist().files['orerush-meta.json'] = JSON.stringify({ ver: 4, dev: 'C', name: 'Old phone', time: Date.now(), level: 3, score: 9000, stars: 0, t: 600 });
  gist().files['orerush-live.json'] = JSON.stringify({ dev: 'C', name: 'Old phone', time: Date.now(), closed: true });
  await IN.sync(A, false);
  d = await IN.waitDlg(A, 'looks older');
  check('A: cloud version is newer but has less progress → asks instead of loading', !!d && d.includes('Old phone') && await IN.level(A) === 7);
  await IN.answer(A, 'local'); await IN.idle(A);
  check('A: "Keep this device" = forced upload; the replaced cloud save goes into the backup file',
    meta().ver === 5 && meta().level === 7 && gist().files['orerush-backup.txt'] === oldCode);

  // ---------- 9. both devices played → asks; Decide later uploads nothing ----------
  gist().files['orerush-meta.json'] = JSON.stringify({ ver: 6, dev: 'C', name: 'Old phone', time: Date.now(), level: 9, score: 99000, stars: 5, t: 9000 });
  await IN.save(A, 8, 80000, 3600); await IN.sync(A, false);
  d = await IN.waitDlg(A, 'Both devices have new progress');
  check('A: both devices played → asks', !!d);
  await IN.answer(A, 'later'); await IN.idle(A);
  check('A: "Decide later" keeps both: nothing uploaded, local game untouched, waits', meta().ver === 6 && await IN.level(A) === 8 && await A.evaluate(() => SY.hold === true));
  await IN.syncDone(A, false);
  check('A: while waiting, automatic syncs do not ask again', !(await IN.dlg(A)));

  // ---------- 10. a normal upload never lowers the cloud's progress (e.g. after "New game") ----------
  await IN.sync(A, true); await IN.waitDlg(A, 'Both devices'); await IN.answer(A, 'local'); await IN.idle(A);   // A takes the cloud (v7, sector 8)
  await IN.save(A, 2, 1000, 3700); await IN.sync(A, false);
  d = await IN.waitDlg(A, 'less progress');
  check('A: after starting over, its smaller game is not uploaded silently → asks', !!d && meta().level === 8);
  await IN.answer(A, 'cloud'); await IN.idle(A);
  check('A: picked the cloud → sector 8 back, small game kept for Undo', await IN.level(A) === 8 && (await A.evaluate(() => JSON.parse(store.get(PRESYNC).raw).level)) === 2);

  // ---------- 11. never in the middle of a sector: loading waits for the menu ----------
  await IN.save(B, 11, 120000, 4000); await B.evaluate(() => { SY.hold = false; SC.base = null; scSave(); });
  await IN.sync(B, true); await IN.waitDlg(B, 'A cloud save already exists'); await IN.answer(B, 'local'); await IN.idle(B);  // B: v8, sector 11
  await A.evaluate(() => startLevel()); await IN.syncDone(A, false);
  check('A: while flying a sector, the newer cloud game is NOT loaded; status says it waits for the menu',
    await A.evaluate(() => state === 'play' && level === 8) && await A.evaluate(() => SY.deferred && syncStatus().includes('back in the menu')));
  await A.evaluate(() => showTitle()); await A.waitForTimeout(600); await IN.idle(A);
  d = await IN.dlg(A); if (d) { await IN.answer(A, '1'); await IN.idle(A); }   // (B's live marker may still be fresh)
  check('A: back in the menu → the newer cloud game (sector 11) loads', await IN.level(A) === 11);

  // ---------- 12. import asks: all devices (forced upload) / only this device (pause) ----------
  const impCode = await A.evaluate(() => { const keep = store.get(SAVE); resetProgress(); level = 14; score = 150000; saveGame(); const c = saveCode(); store.set(SAVE, keep); loadGame(keep); return c; });
  const cloudBefore = gist().files['orerush-save.txt'];
  await A.evaluate(() => showTransfer('title')); await A.fill('#imCode', impCode); await A.click('button[data-act=loadcode]');
  d = await IN.waitDlg(A, 'Use this save everywhere');
  check('A: importing a save asks "all devices" or "only this device"', d.includes('All devices') && d.includes('Only this device'));
  await IN.answer(A, 'all'); await IN.idle(A); await A.waitForTimeout(200);
  check('A: "All devices" = forced upload of the imported save; previous cloud save → backup',
    meta().level === 14 && gist().files['orerush-backup.txt'] === cloudBefore);
  await B.evaluate(() => showTransfer('title')); await B.fill('#imCode', impCode); await B.click('button[data-act=loadcode]');
  await IN.waitDlg(B, 'Use this save everywhere'); await IN.answer(B, 'here'); await B.waitForTimeout(200);
  check('B: "Only this device" pauses sync on B', await B.evaluate(() => SC.paused === true));
  await B.evaluate(() => { SC.paused = false; scSave(); });

  // ---------- 13. offline / errors never break the game ----------
  GHS.offline.A = true;
  await IN.save(A, 15, 160000, 5000); await IN.syncDone(A, true);
  const off = await A.evaluate(() => ({ st: syncStatus(), lvl: store.get(SAVE).level }));
  check('A offline: status says offline, local saving still works', off.st.includes('Offline') && off.lvl === 15);
  GHS.offline.A = false;
  await A.evaluate(() => dispatchEvent(new Event('online'))); await A.waitForTimeout(150); await IN.idle(A);
  check('A back online: the "online" event syncs the waiting change', meta().level === 15 && (await A.evaluate(() => syncStatus())).includes('Synced'));
  await A.evaluate(() => { SC.token = 'wrong'; }); await IN.syncDone(A, true);
  check('wrong key: clear message, game keeps running', (await A.evaluate(() => syncStatus())).includes('GitHub refused the key'));
  await A.evaluate(t => { SC.token = t; scSave(); }, TOKEN);

  // ---------- 14. upload soon after saving (no manual sync) ----------
  await A.evaluate(() => { SYNC_SOON_MS = 300; }); await IN.save(A, 16, 170000, 5100); await A.waitForTimeout(900); await IN.idle(A);
  check('A: saving the game uploads by itself a few seconds later', meta().level === 16);

  // ---------- 15. menu buttons + disconnect ----------
  await A.evaluate(() => showCloud());
  const btns = await A.evaluate(() => [...document.querySelectorAll('#ov button')].map(b => b.textContent).join('|'));
  check('cloud screen has Sync now, Pause, Undo, Disconnect', /Sync now/.test(btns) && /Pause/.test(btns) && /Undo/.test(btns) && /Disconnect/.test(btns));
  await A.click('button[data-act=syncOff]');
  check('Disconnect removes the key from the device; the Gist stays on GitHub',
    !(await A.evaluate(() => JSON.parse(localStorage.getItem(KP + 'orerush_sync')).token)) && Object.keys(GHS.gists).length === 1);

  // ---------- 16. every 3 minutes while visible (fake clock, so the test doesn't wait 3 real minutes) ----------
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, serviceWorkers: 'block' });
    await fakeGitHub(ctx, 'C'); await ctx.clock.install();
    const C = await ctx.newPage(); C.on('pageerror', e => errs.push('C: ' + e.message));
    await C.goto('http://localhost:8099/'); await C.clock.runFor(2000);
    await C.evaluate(t => { SYNC_SOON_MS = 1e9; SC.token = t; SC.name = 'Computer'; scSave(); }, TOKEN);
    await C.clock.runFor(1000); const v0 = meta().ver, beat0 = live().time;
    await C.clock.runFor(185000); await C.waitForTimeout(300);
    const d16 = await IN.dlg(C);
    check('C: the 3-minute timer syncs by itself (here: a new device meets the existing cloud and asks)', d16.includes('A cloud save already exists') && meta().ver === v0 && live().time === beat0);
    await ctx.close();
  }

  check('no script errors on either device', errs.length === 0);
  if (errs.length) console.log(errs.join('\n'));
  await b.close(); server.close();
  const failed = results.filter(r => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
