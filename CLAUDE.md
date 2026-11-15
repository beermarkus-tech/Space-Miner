# CLAUDE.md: Ore Rush (Space-Miner repo)

Guidance for Claude Code when working on this repository.

## What this is
Ore Rush: a Space-Miner-style 2D mining shooter, shipped as a static PWA on GitHub Pages
(https://beermarkus-tech.github.io/Space-Miner/). The owner builds by prompting AI and verifying results
in the browser and on his phone, so keep changes playable and explain them in plain words.

## Branch `frontier` (this branch): the star-map / trading update, published as the test version
- Published to the separate project `beermarkus-tech/Space-Miner-Dev` → https://beermarkus-tech.github.io/Space-Miner-Dev/ as the app "Ore Rush DEV"
  (own manifest + `icons/dev-*`). Publish with `tools/publish-dev.sh /home/user/space-miner-dev` after pushing frontier
  (a separate project is needed: an installed app owns its address and everything below it).
- `DEV=true` in `index.html`: every localStorage key gets the prefix `dev_` (`KP`), its own cloud Gist (`GIST_DESC`), title shows "DEV BUILD n".
  The real game's save (`orerush2_save` without prefix) is only read, by "Copy my real game into this test version".
- **On every push to frontier, bump `BUILD` (dev counter) and `VERSION` in `sw.js` (`'ore-rush-dev-N'`) together.** Tell the owner "DEV build N".
- **Never merge frontier into main** until the owner says the new version is better. When merging: `DEV=false`, restore the real manifest,
  icons and sw names, continue the real BUILD number from main.
- Galaxy: `HOME_SYS` = 14 hand-made systems (4 `story` systems r=0..3 + 10 side systems opening at sector `unlock`), each with map
  position (x,y), `links`, market `mul`, `kind`/`icon` and `look` (sun type from `SUN`, nebula hues, density, planet). Missions have a `site`
  (belt/sun/giant/nebula). Star map: `showGalaxy` (canvas, fog of war `gmapFogLayer`, `routeTo`, `travel` → `nextHop` → warp → `arriveAt`;
  `eventRoll` decides jump events). Generated frontier systems sit east of the Frozen Halo (`GSCALE` map units apart).
- Frontier section `// === frontier`: `HOME_SYS` (the hand-made systems), generated systems in `fr.gen` (`genNeighbors`), `fr` state in the save
  (sys, day, fuel, cargo, known prices, saturation, gen, links, visited, seed). Flights: `cur` = location, `startFlight/endFlight`; while flying
  `level` is the flight difficulty and `homeLevel` the campaign progress. Pause → "Return to the station" ends a flight keeping the hold.
  Rush orders (quota): ore goes to the client, not the hold; pays `rushFee(n)` (≈ half a full hold of that sector's ore) when filled,
  `RUSH_PARTIAL` of it × share delivered on failure. Asteroid fields (`clear`): exit gate open from the start (stay 1.4 s in it to leave early,
  `leaveEarly`); done when all pirates are destroyed, or after `FIELD_ORE` ore in fields without pirates. Hyperjump lasts `WARP_T` s.
- Trade: `GOODS` (basics, `spec` specialties, `illegal` contraband) + `TRADE[id]` profiles (`sells`, `buys` multipliers, `black` market,
  `navy` scans); generated systems get one from `tradeOf`. Cargo holds ore and goods (`fr.cargo`); `priceOf` handles both (`baseVal`),
  `buyPriceOf`/`buyGood` (+10% spread, `fr.bsat` raises buy prices), `canSellAt` (contraband only at black markets). Knowledge: `fr.known`
  (visits) + `fr.rum` (bar rumours from `makeRumour` in the station news) → `knownPrice`; `tradeDeals` = trade computer (profit after fuel).
  Navy scans on arrival (`scanRoll`, `navyScan`, submit/bribe). Rumours can exaggerate (25%); "Buy a round" in the bar gives a true price.
- Station = full-screen scenes (`stationScene(area)`, `sceneOv`, art from `sceneArt`): concourse (window shows the live canvas: `stationView`
  places the system's sun/planet there), bar (rumours, `barTip`, patron contracts), trade office (Ore / Goods / Price book tabs, deliveries,
  reputation), shipyard (`showShop` rendered in the scene), hangar (refuel, repair, jobs, Launch). Nav bar + door hotspots use `data-act="area"`.
- Reputation per station `fr.rep` (`repLvl`, 4 levels): better sell/buy prices; earned by selling what they need and by contracts.
  Delivering 15+ units into a shortage ends it (`fr.fixed`, `fr.thanks`). Contracts `fr.jobs` from `contractOffers` (supply / sealed crate
  with `surprise` normal|kitten|smuggle; smuggled crates count as contraband), deadlines checked by `checkDeadlines`.
- Pirate activity per system `dangerOf(id)` (map rings, info); raid chance on arrival grows with it, cargo value and HOT jobs.
  Raids (`cur.raid`): hull hits knock cargo pods loose (`dropPod`), pirates with `e.grab` grab them (`raidGrab`) and flee; kill them to drop
  the pod; fly over pods to recover (`updatePods`). A full hold slows the ship. Tests can force jump events with `forceEvent='raid'|'wreck'`.
- `hashStr` has a final mix step so consecutive days/blocks give unrelated values (prices, events, danger). Markets: `priceOf`, `sellOre`, `sysEvent`. Screens: `showStation`,
  `showSystem`, `showGalaxy`; actions in `FR_ACT`. After a win an `exitGate` opens; flying into it ends the flight.
- Tests: `node tests/sync-test.js` (cloud sync). Gameplay checks are ad-hoc Playwright scripts.

## Architecture
- **Single file:** `index.html` holds everything (CSS, HTML overlays, all JS). No framework, no build, no dependencies.
  Only Google Fonts (Orbitron, Exo 2) load from outside.
- Rendering: one `<canvas>`, 2D context. The world is drawn with a camera transform (`ZOOM`, `cam`); HUD in screen space.
  Glows come from cached radial-gradient sprites (`glow()`) drawn with `globalCompositeOperation='lighter'`. Avoid `shadowBlur` in hot paths (slow on phones).
- Asteroids are pre-rendered to offscreen canvases (`asteroidSprite`). Ships are drawn as paths (`drawShipBody`) from parameters in `SHIPS`.
- Audio: Web Audio synth (`sfx`), no files.
- UI screens (title, briefing, shipyard, summary, pause, transfer) are HTML overlays built by `show*()` functions in `#ov`;
  clicks are handled by one delegated listener on `#ov` using `data-act`, `data-buy`, `data-wbuy`, `data-wup`, `data-equip`, `data-ship`, `data-fly`, `data-tab`.

## Code map (search for these `// ===` section headers)
- **game data:** `SHIPS`, `WEAPONS` + `wstat()`, `UPG` (systems), `PU` (power-ups), `REGIONS`, `BOSSES`, `MISSION_PLAN` / `ENDLESS_PLAN` + `missionOf()`, `BRIEF` texts
- **missions:** clear, quota, defend (rig), escort (moving `rig` with `hauler:true`), storm (`storm` zone + lightning), lode (`lode` asteroid with 3 shells, scavengers), boss.
  Campaign is `LAST_SECTOR`=40 sectors in 4 regions; the Endless Deep follows.
- **state:** global `let`s (`level`, `credits`, `upg`, `wl` weapon levels with -1 = not owned, `shipId`, `stars`, …)
- **level setup:** `setupField()`, `startLevel()`, `spawnRandomAsteroid()`, `buildSpawnQueue()`
- **entities:** `makeEnemy()`, `breakAsteroid()`, `killEnemy()`, `hurt()`, `triggerNova()`
- **update:** `updateShip()` + `fireWeapon()`, `update()`, `updateMission()`, `updateEnemies()`
- **render:** `render()`, `drawShipBody()`, `drawEnemy()`, `drawHUD()`
- **overlays:** `showTitle/Brief/Shop/Fail/Transfer()`, `endLevel()`, `gameOver()`
- **cloud save sync:** section `// === cloud save sync` (same design as Frontier Works `js/sync.js`; rules in its header comment).
  Private Gist found by description `Ore Rush save (managed by the game, do not edit)`, files `orerush-save.txt|meta.json|live.json|backup.txt`.
  Device state in `localStorage['orerush_sync']` (token, name, gist id, base ver/dev/fingerprint); pre-sync local copy in `orerush_presync`.
  Loads and questions only happen in menus (`canAsk()`), never mid-sector.

## Save data
- `localStorage['orerush2_save']` holds `{v:2, level, credits, score, lives, upg, wl, weapon, shipId, ownedShips, bombs, hull, stars, oc, deeds, playT}`.
  `playT` = seconds spent flying sectors. `oc` = overclock levels (system ids, and `w_<weapon>` for weapons); `deeds` = sector numbers bought in the Belt tab.
  `orerush_best` holds the best score, `orerush_sound` the sound mode (0 all, 1 effects only, 2 off; `orerush_muted` is the old flag), `orerush_vibe` vibration strength (0 off, 1 normal, 2 strong; old saves stored true/false). `orerush_save` is the old v1 format, migrated on load.
- Save codes are `ORS2:` + base64(JSON). If you change the save shape, keep `loadGame()` tolerant of old saves (defaults for missing keys)
  so players don't lose progress.

## Conventions
- Keep it one self-contained `index.html` unless the owner asks to split it.
- Everything must work with touch (twin-stick) **and** keyboard/mouse. Test phone layouts around 390×780.
- **On every push, bump `BUILD` in `index.html` and `VERSION` in `sw.js` to the same next number** (`BUILD=6` ↔ `'ore-rush-v6'`),
  otherwise installed copies keep the old cache. Tell the owner the new build number after each push; it shows in the main menu.
- New file that must work offline → add it to `SHELL` in `sw.js`.
- Balance knobs live in data tables and small formulas (`wstat`, `upgCost`, `wUpCost`, `makeEnemy` HP, `quotaOf`, `defendTime`).
  `quotaOf(n)` scales with the sector's ore value, your ore multipliers and your firepower (`gearPower`); tune with `QUOTA_K`.
  Economy (see `// ---- economy`): sector unlocks `UPG_REQ`/`WUP_REQ` and `req` on `SHIPS`/`WEAPONS`, overclock `OC_GAIN`/`ocCost`/`wocCost`, Belt `deedCost`/`REGION_BONUS`; all applied in `computeStats()`.

## Shipping
- **Publishing:** `.github/workflows/pages.yml` publishes only `main` (the real game at `/Space-Miner/`). Pushes to `frontier` publish nothing by
  themselves: run `tools/publish-dev.sh` to update the test version in Space-Miner-Dev.
- **`frontier` branch = the star-map / trading update (work in progress).** Push it freely; do NOT merge it into `main`
  until the owner says the new version is better. The test version must use its own storage keys, Gist and manifest, and shows "DEV build N".
- The owner wants finished work merged to `main` automatically, without asking (GitHub Pages deploys from `main`).
  After testing and pushing the feature branch, merge it into `main` (fast-forward when possible) and push `main`.
  If the merge has conflicts or tests fail, stop and tell the owner instead of forcing it.

## Testing
`node tests/sync-test.js` runs the cloud sync test (fake GitHub API, two simulated devices); it must pass before pushing sync changes.
Otherwise no test suite. Serve with `python3 -m http.server` and play, or drive it headlessly with Playwright.
Handy console cheats: `credits=50000;showShop()`, `level=15;startLevel()`, `asteroids.forEach(a=>breakAsteroid(a))`.
