#!/usr/bin/env bash
# Ops or the board ($1) and the shell served for real, before (the merge-base with main) and after (HEAD): full-page and first-screen frames at phone and desktop
# widths in both themes, a failing exit when a page scrolls sideways, and done-done's own 390 px look at the after page.
set -euo pipefail
: "${DONE_DONE_EVIDENCE_ROOT:?Run this script through done-done run ops or board}"
s=${1:-ops} h=; [ "$s" = board ] && h='#/lanes'
out=$DONE_DONE_EVIDENCE_ROOT d=$(mktemp -d) c=chrome-devtools-axi
export CHROME_DEVTOOLS_AXI_SESSION="lookout-$s-${DONE_DONE_RUN_ID}"
trap '$c stop >/dev/null 2>&1; kill $(jobs -p) 2>/dev/null; rm -rf -- "$d"' EXIT
git archive "$(git merge-base HEAD origin/main)" | tar -x -C "$d"
node "$d/bin/lookout.js" serve --port 4421 > "$out/serve-before.log" 2>&1 & node bin/lookout.js serve --port 4422 > "$out/serve-after.log" 2>&1 & sleep 1
{ $c start; $c selectpage 1; } > "$out/browser.log"
for state in before:4421 after:4422; do for width in 360 390 445 1280 1440; do for theme in light dark; do
  $c emulate --viewport "${width}x844" --color-scheme "$theme" && $c open "http://127.0.0.1:${state#*:}/$h" && sleep 1.5
  $c eval '() => { const w = document.documentElement.scrollWidth; if (w > innerWidth) throw new Error(`scrolls sideways: ${w}`); return document.querySelector("h1").textContent }'
  $c screenshot "$out/$s-${state%:*}-$width-$theme.png" --full-page && $c screenshot "$out/$s-${state%:*}-$width-$theme-fold.png"
done; done; done >> "$out/browser.log"
done-done look "http://127.0.0.1:4422/$h" --out "$out/$s-look-390.png" && echo "{\"target\":{\"version\":\"$(node bin/lookout.js --version)\"},\"start\":\"lookout serve on the sample fleet\",\"steps\":[\"open http://127.0.0.1:4422/$h at 360, 390, 445, 1280 and 1440 px in light and dark\"],\"result\":\"$s renders in the redesigned shell, no sideways scroll\"}" > "$out/steps.json"
