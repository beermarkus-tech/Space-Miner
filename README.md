# Ore Rush 🚀⛏️

A deep-space mining shooter for the browser, inspired by the classic iPhone game *Space Miner*.
Blast asteroids, scoop up the ore, fight pirates and pour every credit into a better ship.

**Play:** https://beermarkus-tech.github.io/Space-Miner/

It's an installable PWA: open the link on your phone and choose **Add to Home Screen**
(on Android/Chrome there is also an **Install as app** button on the title screen). After the first visit it works offline.

## Features
- 30-sector campaign across three regions (Kessler Belt, Crimson Expanse, Void Rim), then the endless *Deep*
- Missions: clear the field, ore quota against the clock, defend the mining rig, boss fights every 5th sector
- Bosses: Pirate Cruiser, Hive Carrier, Dreadnought
- 5 weapons (Pulse Blaster, Scatter Cannon, Mining Laser, Plasma Lobber, Arc Caster), each with 6 levels
- 5 ships, ship systems, wingman drones, seeker missiles, Nova bombs
- Power-ups, treasure caches, volatile asteroids, black holes, minefields
- 1–3 stars per sector, ore combo multiplier
- Auto-save, plus save export/import (copy a code or download a save file)

## Controls
| | |
|---|---|
| Phone | left thumb flies, right thumb aims & fires, buttons at the bottom: switch weapon / Nova |
| Keyboard | arrows / WASD fly · Space fire · Q/E or 1–5 weapons · B Nova · P pause |
| Mouse | hold to aim & fire at the cursor |

## Project structure
```
index.html            the whole game (HTML + CSS + JS, no build step)
manifest.webmanifest  PWA manifest
sw.js                 service worker (offline cache)
icons/                app icons
```

## Run locally
Any static server works, for example:
```
python3 -m http.server 8000
```
Then open http://localhost:8000. Opening `index.html` directly also works, but without offline support.
