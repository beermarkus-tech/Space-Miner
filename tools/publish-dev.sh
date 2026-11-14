#!/usr/bin/env bash
# Publish the test version (this frontier branch) to the separate Space-Miner-Dev project,
# which GitHub Pages serves at https://beermarkus-tech.github.io/Space-Miner-Dev/ (installable as "Ore Rush DEV").
# It has to be a separate project: an installed app owns its address and everything below it,
# so a test version inside /Space-Miner/ would be swallowed by the real Ore Rush app.
# Usage: tools/publish-dev.sh [path-to-Space-Miner-Dev-clone]   (default: ../space-miner-dev)
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DST="${1:-$SRC/../space-miner-dev}"
[ -d "$DST/.git" ] || { echo "No clone of Space-Miner-Dev at $DST"; exit 1; }
[ "$(git -C "$SRC" branch --show-current)" = "frontier" ] || { echo "Run this from the frontier branch"; exit 1; }
BUILD=$(grep -o 'const DEV=true,BUILD=[0-9]*' "$SRC/index.html" | grep -o '[0-9]*$')
[ -n "$BUILD" ] || { echo "index.html is not a DEV build (DEV=true missing)"; exit 1; }
rm -rf "$DST/icons"; mkdir -p "$DST/icons"
cp "$SRC/index.html" "$SRC/sw.js" "$SRC/manifest.webmanifest" "$DST/"
cp "$SRC"/icons/*.png "$DST/icons/"
touch "$DST/.nojekyll"
cat > "$DST/README.md" <<TXT
# Ore Rush DEV (test version)

Work-in-progress test build of [Ore Rush](https://github.com/beermarkus-tech/Space-Miner) (star map, stations, cargo and trading).
Play / install: https://beermarkus-tech.github.io/Space-Miner-Dev/

Do not edit here: this project is overwritten by \`tools/publish-dev.sh\` from the \`frontier\` branch of Space-Miner.
TXT
git -C "$DST" add -A
if git -C "$DST" diff --cached --quiet; then echo "Nothing changed"; exit 0; fi
git -C "$DST" commit -q -m "DEV build $BUILD (from Space-Miner frontier $(git -C "$SRC" rev-parse --short HEAD))" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git -C "$DST" -c push.negotiate=true push -u origin HEAD:main
echo "Published DEV build $BUILD"
