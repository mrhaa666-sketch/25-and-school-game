/**
 * 把存档读写交给主进程（写入用户目录的 JSON 文件）。
 * 游戏里的 src/core/storage.ts 检测到 window.gameStorage 就会改用它。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gameStorage', {
  read: (key) => ipcRenderer.sendSync('storage:read', key),
  write: (key, value) => ipcRenderer.sendSync('storage:write', key, value),
  remove: (key) => ipcRenderer.sendSync('storage:remove', key),
});
