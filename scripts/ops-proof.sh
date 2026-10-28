#!/usr/bin/env bash
# Ops and its shell served for real, before (the merge-base with main) and after (HEAD): full-page frames at phone and desktop
# widths in both themes, a failing exit when a page scrolls sideways, and done-done's own 390 px look at the after page.
set -euo pipefail
: "${DONE_DONE_EVIDENCE_ROOT:?Run this script through done-done run ops}"
out=$DONE_DONE_EVIDENCE_ROOT d=$(mktemp -d) c=chrome-devtools-axi
export CHROME_DEVTOOLS_AXI_SESSION="lookout-ops-${DONE_DONE_RUN_ID}"
trap '$c stop >/dev/null 2>&1; kill $(jobs -p) 2>/dev/null; rm -rf -- "$d"' EXIT
git archive "$(git merge-base HEAD origin/main)" | tar -x -C "$d"
node "$d/bin/lookout.js" serve --port 4421 > "$out/serve-before.log" 2>&1 & node bin/lookout.js serve --port 4422 > "$out/serve-after.log" 2>&1 & sleep 1
{ $c start; $c selectpage 1; } > "$out/browser.log"
for state in before:4421 after:4422; do for width in 360 390 445 1280 1440; do for theme in light dark; do
  $c emulate --viewport "${width}x$((width < 1000 ? 844 : 900))" --color-scheme "$theme" && $c open "http://127.0.0.1:${state#*:}/" && sleep 1.5
  $c eval '() => { const w = document.documentElement.scrollWidth; if (w > innerWidth) throw new Error(`scrolls sideways: ${w}`); return document.querySelector("h1").textContent }'
  $c screenshot "$out/ops-${state%:*}-$width-$theme.png" --full-page
done; done; done >> "$out/browser.log"
done-done look http://127.0.0.1:4422/ --out "$out/ops-look-390.png" && echo "{\"target\":{\"version\":\"$(node bin/lookout.js --version)\"},\"start\":\"lookout serve on the sample fleet\",\"steps\":[\"open http://127.0.0.1:4422/ at 360, 390, 445, 1280 and 1440 px in light and dark\"],\"result\":\"Ops: waiting on you, stuck, running, pipeline and two history charts in the rail shell, no sideways scroll\"}" > "$out/steps.json"
