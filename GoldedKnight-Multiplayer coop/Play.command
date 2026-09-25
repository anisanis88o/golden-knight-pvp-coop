#!/bin/bash
# Gilded Knight vs The Violet Sentinel - macOS launcher (double-click)
cd "$(dirname "$0")"
GAME="$PWD/game/index.html"
FLAGS=(--app="file://$GAME" --window-size=1280,760 --autoplay-policy=no-user-gesture-required)
for APP in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium"; do
  if [ -d "/Applications/$APP.app" ]; then open -na "$APP" --args "${FLAGS[@]}"; exit 0; fi
done
open "$GAME"
