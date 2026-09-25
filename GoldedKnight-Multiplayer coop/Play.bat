@echo off
rem  Gilded Knight vs The Violet Sentinel - Windows launcher
rem  Opens the game in its own window (no address bar), like a normal game.
setlocal
set "GAME=%~dp0game\index.html"
set "URL=file:///%GAME:\=/%"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME%" goto chrome
if exist "%EDGE%" goto edge
rem No Chrome or Edge found: open in the default browser instead.
start "" "%GAME%"
goto :eof

:chrome
start "" "%CHROME%" --app="%URL%" --window-size=1280,760 --autoplay-policy=no-user-gesture-required
goto :eof

:edge
start "" "%EDGE%" --app="%URL%" --window-size=1280,760 --autoplay-policy=no-user-gesture-required
goto :eof
