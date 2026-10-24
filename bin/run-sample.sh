#!/usr/bin/env bash
# Serve the sample fleet: bin/run-sample.sh [port]. Open the printed address.
set -eu
cd "$(dirname "$0")/.."
exec node bin/lookout.js serve --adapter adapters/sample-fleet/fleet.json --port "${1:-4390}"
