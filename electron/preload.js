// Electron preload — 현재는 브릿지 없음.
// 이후 네이티브 기능(파일 저장, 알림 등)이 필요하면 contextBridge.exposeInMainWorld로 추가.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
});
