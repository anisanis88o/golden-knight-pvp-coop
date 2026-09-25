GILDED KNIGHT - BOSS DUELS
==========================

PVP DUEL (new - play online with a friend)
-------------------------------------------
From the title screen, click "PVP DUEL - PLAY ONLINE". One of you clicks
"Host a lobby" and gets a 5-letter code; the other clicks "Join a lobby" and
types that code in, then Connect. Once connected the duel starts after a
3-2-1 countdown.

Both fighters are the Gilded Knight - the host is gold, the guest's armor is
tinted violet - with the same full moveset used against the bosses (move,
jump, 3-hit attack combo, parry, block, ground/air dodge, Sunray Slash,
Cinder Bomb), but with only 3 healing flasks each (40% heal) and tuned-down
damage, since you're fighting a 500-HP knight instead of a boss.

This needs an internet connection (it uses the free PeerJS broker for
matchmaking, then talks directly between the two browsers) - the rest of the
game still works fully offline. Only two players per duel; whoever is
hosting runs the fight, so the joining player may feel a little input delay
depending on the connection. Esc opens a "leave the duel" confirmation.

CO-OP DUEL (new - fight a boss together with a friend)
--------------------------------------------------------
From the title screen, click "CO-OP - FIGHT BOSSES TOGETHER". Pick which
boss you want (the host's choice is the one that's used), then Host a lobby
(get a 5-letter code) or Join a lobby (type your ally's code in). The fight
starts after the usual intro.

You're gold, your ally is tinted violet, and you both have the exact same
moveset and stats used in the solo boss fights (500 HP, 7 flasks at 70%
heal, Sunray Slash, Cinder Bomb). If one of you falls the other can keep
fighting alone; the run only truly ends once both of you are down, or the
boss's health hits zero.

Same online setup as PVP Duel above (free PeerJS broker for matchmaking,
then a direct connection between your two browsers, needs internet), and
the same host-runs-the-fight tradeoff: the joining player may feel a little
input delay. Esc opens a "leave the duel" confirmation.



Choose your opponent on the title screen (click a card, or press 1 / 2):
  1. The Violet Sentinel  - 4000 health
  2. Artorias the Abysswalker - 20000 health, second phase at half health (+40% damage)

HOW TO PLAY (no install needed)
-------------------------------
Windows : double-click  Play.bat
Mac     : double-click  Play.command   (first time: right-click > Open)
Linux   : run           ./play.sh

The game opens in its own window with no address bar. It needs Google Chrome
or Microsoft Edge (Windows already has Edge). If neither is found, it opens in
your normal browser instead. Everything runs offline.

CONTROLS  (all rebindable: press Esc in a fight, or use the Controls & Music button on the title screen)
--------
Move A/D or arrows      Jump W or Space
Attack J, Z or click    Parry K, X or right click
Block (hold) B or I     Dodge slide L or Shift
Air dodge: jump, then L or Shift
Plunge strike: S + J in the air
Healing flask Q or H (7 flasks, each heals 70% of max health)
Sunray Slash R          Cinder Bomb E
F fullscreen    M mute    Esc pause

HERO STATS
----------
Health 500      Stamina 140 (sword swings and dodges each cost 20)
Sword damage 120 per hit

SKILLS
------
Sunray Slash (R) - a fast golden sword-beam thrown straight ahead.
  300 damage, 30 second cooldown, no stamina cost.
Cinder Bomb (E) - charge fire in your off-hand and detonate it at close
  range. 800 damage and staggers the boss (like a parry, it can act again
  once the stagger wears off) if you're close enough when it goes off.
  80 second cooldown, no stamina cost, melee range only.
Both show a cooldown ring with a countdown next to your flasks, and both
can be rebound to any key or mouse button in Controls & Music.

FOLDER
------
game/index.html  the page
game/style.css   look of menus
game/game.js     all game code (movement, combat, boss AI, drawing, sound)
game/assets/     hero.jpg, boss.jpg, art1.png, art2.png (your pictures)

TO MAKE A REAL .EXE / .DMG / APPIMAGE (optional)
------------------------------------------------
1. Install Node.js from https://nodejs.org
2. Open a terminal in this folder and run:
     npm install
     npm start            (runs the game as a desktop app)
     npm run build-win    (makes a portable .exe in the dist folder)
   Use build-mac on a Mac, build-linux on Linux. Each system builds its own.
Note: this Electron part was written but not test-built (it needs internet).

Menu font: Cinzel is downloaded from Google Fonts when online. Offline the
game uses a normal serif font. Everything still works.

REBINDING KEYS AND MUSIC
------------------------
Title screen > CONTROLS & MUSIC (or Esc during a fight > Controls & music).
Click a key box, then press the new key (or click the dashed box with a mouse
button to use Left / Middle / Right click). Every action has up to 3 boxes.
Esc cancels, Backspace clears a box. Esc, Enter, F, M, 1 and 2 are reserved
for menus. Your choices are saved in the browser, so they stay next time.

All music is original solo piano generated inside the game (no audio files):
a slow title theme, a battle theme for each boss (it gets more intense in
phase two), and a short victory piece. Music and Effects have volume sliders.
The browser starts sound only after your first click or key press.
