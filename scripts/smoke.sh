#!/usr/bin/env bash
# Waits for a Hexlode server to answer, then checks that its main pages render.
# Usage: scripts/smoke.sh http://localhost:3000
set -euo pipefail

base="${1:?Pass the server URL}"

for attempt in $(seq 1 60); do
  if curl -fs -o /dev/null "$base/"; then break; fi
  if [ "$attempt" = 60 ]; then
    echo "The server did not answer at $base within 60 seconds." >&2
    exit 1
  fi
  sleep 1
done

for path in / /studio /privacy; do
  curl -fsS -o page.html "$base$path" || { echo "$path did not return 200." >&2; exit 1; }
  # The streamed HTML can hold null bytes, so grep reads it as text.
  if ! grep -qa '<title>[^<]*Hexlode' page.html; then
    echo "$path did not render the Hexlode page." >&2
    exit 1
  fi
  echo "ok $path"
done
rm -f page.html
