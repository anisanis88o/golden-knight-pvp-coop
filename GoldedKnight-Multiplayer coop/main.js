// Turns the game folder into a real desktop app window (Electron).
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 640,
    minHeight: 380,
    backgroundColor: '#050409',
    autoHideMenuBar: true,
    title: 'Gilded Knight vs The Violet Sentinel',
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'game', 'index.html'));
  // F11 = fullscreen
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
