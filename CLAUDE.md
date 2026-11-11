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
- **game data:** `SHIPS`, `WEAPONS` + `wstat()`, `UPG` (systems), `PU` (power-ups), `REGIONS`, `BOSSES`, `missionOf()`, `BRIEF` texts
- **state:** global `let`s (`level`, `credits`, `upg`, `wl` weapon levels with -1 = not owned, `shipId`, `stars`, …)
- **level setup:** `setupField()`, `startLevel()`, `spawnRandomAsteroid()`, `buildSpawnQueue()`
- **entities:** `makeEnemy()`, `breakAsteroid()`, `killEnemy()`, `hurt()`, `triggerNova()`
- **update:** `updateShip()` + `fireWeapon()`, `update()`, `updateMission()`, `updateEnemies()`
- **render:** `render()`, `drawShipBody()`, `drawEnemy()`, `drawHUD()`
- **overlays:** `showTitle/Brief/Shop/Fail/Transfer()`, `endLevel()`, `gameOver()`

## Save data
- `localStorage['orerush2_save']` holds `{v:2, level, credits, score, lives, upg, wl, weapon, shipId, ownedShips, bombs, hull, stars}`.
  `orerush_best` holds the best score, `orerush_muted` the sound setting. `orerush_save` is the old v1 format, migrated on load.
- Save codes are `ORS2:` + base64(JSON). If you change the save shape, keep `loadGame()` tolerant of old saves (defaults for missing keys)
  so players don't lose progress.

## Conventions
- Keep it one self-contained `index.html` unless the owner asks to split it.
- Everything must work with touch (twin-stick) **and** keyboard/mouse. Test phone layouts around 390×780.
- **When you change any shipped file, bump `VERSION` in `sw.js`**, otherwise installed copies keep the old cache.
- New file that must work offline → add it to `SHELL` in `sw.js`.
- Balance knobs live in data tables and small formulas (`wstat`, `upgCost`, `wUpCost`, `makeEnemy` HP, `quotaOf`, `defendTime`).

## Shipping
- The owner wants finished work merged to `main` automatically, without asking (GitHub Pages deploys from `main`).
  After testing and pushing the feature branch, merge it into `main` (fast-forward when possible) and push `main`.
  If the merge has conflicts or tests fail, stop and tell the owner instead of forcing it.

## Testing
No test suite. Serve with `python3 -m http.server` and play, or drive it headlessly with Playwright.
Handy console cheats: `credits=50000;showShop()`, `level=15;startLevel()`, `asteroids.forEach(a=>breakAsteroid(a))`.
