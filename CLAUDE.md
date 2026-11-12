# CLAUDE.md: Ore Rush (Space-Miner repo)

Guidance for Claude Code when working on this repository.

## What this is
Ore Rush: a Space-Miner-style 2D mining shooter, shipped as a static PWA on GitHub Pages
(https://beermarkus-tech.github.io/Space-Miner/). The owner builds by prompting AI and verifying results
in the browser and on his phone, so keep changes playable and explain them in plain words.

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
- The owner wants finished work merged to `main` automatically, without asking (GitHub Pages deploys from `main`).
  After testing and pushing the feature branch, merge it into `main` (fast-forward when possible) and push `main`.
  If the merge has conflicts or tests fail, stop and tell the owner instead of forcing it.

## Testing
`node tests/sync-test.js` runs the cloud sync test (fake GitHub API, two simulated devices); it must pass before pushing sync changes.
Otherwise no test suite. Serve with `python3 -m http.server` and play, or drive it headlessly with Playwright.
Handy console cheats: `credits=50000;showShop()`, `level=15;startLevel()`, `asteroids.forEach(a=>breakAsteroid(a))`.
