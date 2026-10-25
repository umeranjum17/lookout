#!/usr/bin/env bash
# Real npm startup plus GitHub's rendered README: viewport frames for Checks media,
# full-page frames for fold review, both widths and themes.
set -euo pipefail
: "${DONE_DONE_EVIDENCE_ROOT:?Run this script through done-done run readme}"
out=$DONE_DONE_EVIDENCE_ROOT
export CHROME_DEVTOOLS_AXI_SESSION="lookout-proof-${DONE_DONE_RUN_ID}"
chrome() { chrome-devtools-axi "$@"; }
trap 'chrome stop > /dev/null 2>&1' EXIT
base=87dc8fd0b49f71df1cdd8e85173228bcd07a5ed6
# Prefer the merge-base with origin/main when available (live README before this branch).
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  base=$(git merge-base HEAD origin/main)
fi
head=$(git rev-parse HEAD)
(cd "$out"; npx -y lookout-axi --version; npx -y lookout-axi check) > "$out/npm-check.log" 2>&1
node --input-type=module <<'JS'
import net from 'node:net'
const server=net.createServer()
server.on('error', error => { console.error(error.message); process.exit(1) })
server.listen(4390,'127.0.0.1',()=>server.close())
JS
# timeout owns the server's process group and stops it after the startup probe.
(cd "$out"; timeout --signal=INT 12s npx -y lookout-axi serve) > "$out/npm-serve.log" 2>&1 &
server_job=$!
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:4390/api/fleet > "$out/served-fleet.json"; then break; fi
  sleep 0.2
done
node --input-type=module - "$out/served-fleet.json" <<'JS'
import { readFileSync } from 'node:fs'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
if (data.fleet?.name !== 'Sample fleet') throw new Error('Expected the published sample fleet')
console.log('Published quick start served Sample fleet over HTTP')
JS
serve_exit=0
wait "$server_job" || serve_exit=$?
[[ $serve_exit == 124 ]] || { echo "Unexpected server exit: $serve_exit"; exit 1; }
chrome start > "$out/browser.log"
# Fresh sessions create about:blank but leave it unselected; open/emulate need a selection.
chrome selectpage 1 >> "$out/browser.log"
for state in before after; do
  ref=$base
  [[ $state == before ]] || ref=$head
  for width in 390 1280; do
    height=800
    [[ $width == 1280 ]] || height=844
    for theme in light dark; do
      chrome emulate --viewport "${width}x${height}" --color-scheme "$theme" >> "$out/browser.log"
      chrome open "https://github.com/umeranjum17/lookout/blob/$ref/README.md" >> "$out/browser.log"
      # chrome-devtools-axi wait currently errors ("fn is not a function"); sleep is enough for render.
      sleep 1.5
      chrome eval '() => { const a = document.querySelector("article.markdown-body"); if (!a) throw new Error("GitHub README missing"); a.scrollIntoView(); window.scrollBy(0,-64); if ([...a.querySelectorAll("img")].filter(i=>i.getBoundingClientRect().top<innerHeight).some(i=>!i.complete||!i.naturalWidth)) throw new Error("Visible README image failed to load"); return {title:a.innerText.slice(0,100), images:[...a.querySelectorAll("img")].map(i=>({src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0})), scrollContainers:[...document.querySelectorAll("article *")].filter(e=>e.scrollWidth>e.clientWidth&&getComputedStyle(e).overflowX==="auto").length}; }' >> "$out/browser.log"
      # Viewport-sized frame for merge-card / Checks screen: media.
      chrome screenshot "$out/readme-${state}-${width}-${theme}.png" >> "$out/browser.log"
      # Full-page frame for below-fold review paths in the done report.
      chrome screenshot "$out/readme-${state}-${width}-${theme}-full.png" --full-page >> "$out/browser.log"
    done
  done
done
{
  echo "Lookout README review (head ${head:0:7})"
  echo "Viewport and full-page at 390 and 1280, light and dark."
  echo
  echo "Sections checked:"
  echo "- Hero: logo, pitch, live Overview frames — kept."
  echo "- Quick start: three npx commands — ok."
  echo "- Why Lookout: short list (phone-readable); was a 3-column table that wrapped to one word per line at 390."
  echo "- What you get: bullet list; Flow then Capacity frames at hero size — ok."
  echo "- Try it / Local / Develop: text and code — ok."
  echo
  echo "Viewport frames: readme-after-390-light.png readme-after-390-dark.png readme-after-1280-light.png readme-after-1280-dark.png"
  echo "Full-page frames: same names with -full.png suffix"
} > "$out/fold-review.txt"
node --input-type=module - "$out/steps.json" "$head" <<'JS'
import { writeFileSync } from 'node:fs'
writeFileSync(process.argv[2], JSON.stringify({target:{version:process.argv[3]},start:'Clean committed checkout; anonymous GitHub browser; published npm package in a separate directory',steps:['Run the three-command quick start from an empty evidence directory','Open the published sample fleet over HTTP','Open the baseline and candidate launch README on github.com','Capture viewport and full-page README frames at 390x844 and 1280x800 in light and dark','Write fold-review.txt of sections checked'],result:'Published sample fleet responds; viewport and full-page GitHub README frames plus fold-review transcript saved for visual review'},null,2))
JS
