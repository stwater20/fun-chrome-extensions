#!/usr/bin/env bash
# Zips each extension into dist/<name>-<version>.zip, ready for the Chrome Web Store.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
for dir in typing-rampage page-physics tab-pet web-graffiti wiki-race page-dungeon page-symphony time-machine; do
  version=$(node -p "require('./$dir/manifest.json').version")
  out="dist/$dir-$version.zip"
  rm -f "$out"
  (cd "$dir" && zip -qr "../$out" . -x 'server/*' -x 'icons/512.png' -x '.*')
  echo "$out  $(du -h "$out" | cut -f1)"
done
