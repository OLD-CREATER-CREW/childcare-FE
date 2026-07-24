// Electron preload — 렌더러(웹 UI)에 노출하는 좁은 네이티브 통로.
// 파일 시스템을 통째로 열지 않고, 양식 폴더 지정/조회/읽기 채널만 노출한다.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  templates: {
    getConfig: () => ipcRenderer.invoke("templates:getConfig"),
    pickFolder: () => ipcRenderer.invoke("templates:pickFolder"),
    readAll: () => ipcRenderer.invoke("templates:readAll"),
  },
});
