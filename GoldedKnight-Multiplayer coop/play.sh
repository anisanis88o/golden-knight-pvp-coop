#!/bin/bash
# Gilded Knight vs The Violet Sentinel - Linux launcher
cd "$(dirname "$0")"
GAME="$PWD/game/index.html"
for B in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
  if command -v "$B" >/dev/null 2>&1; then
    exec "$B" --app="file://$GAME" --window-size=1280,760 --autoplay-policy=no-user-gesture-required
  fi
done
xdg-open "$GAME"
