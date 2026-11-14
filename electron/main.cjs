/**
 * Electron 主进程：打开游戏窗口，提供写入用户目录的存档。
 * 存档文件：<用户数据目录>/save.json（Windows 一般在 %APPDATA%/25-and-school/）
 */
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SAVE_FILE = () => path.join(app.getPath('userData'), 'save.json');

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(SAVE_FILE(), 'utf8'));
  } catch {
    return {};
  }
}

function writeStore(store) {
  const file = SAVE_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // 先写临时文件再替换，避免写到一半崩溃导致存档损坏
  fs.writeFileSync(file + '.tmp', JSON.stringify(store, null, 1), 'utf8');
  fs.renameSync(file + '.tmp', file);
}

// 渲染进程同步读写（游戏的存储接口是同步的）
ipcMain.on('storage:read', (e, key) => {
  e.returnValue = readStore()[key] ?? null;
});
ipcMain.on('storage:write', (e, key, value) => {
  const store = readStore();
  store[key] = value;
  writeStore(store);
  e.returnValue = true;
});
ipcMain.on('storage:remove', (e, key) => {
  const store = readStore();
  delete store[key];
  writeStore(store);
  e.returnValue = true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 360,
    backgroundColor: '#000000',
    title: '25-and-school',
    useContentSize: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // F11 切换全屏；开发时 Ctrl+Shift+I 打开调试工具
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
    if (input.control && input.shift && input.key.toLowerCase() === 'i' && !app.isPackaged) {
      win.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
