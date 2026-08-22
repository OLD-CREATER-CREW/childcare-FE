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
  // 얼굴 갤러리 — 임베딩은 여기(교사 PC)에만 영속 저장된다.
  // 시그니처 정본: `lib/face/gallery.ts` 의 DesktopFaceBridge 타입.
  // 이 채널이 있으면 createGalleryStore() 가 메모리 대신 암호화 저장소를 고른다.
  face: {
    loadGallery: (classId) => ipcRenderer.invoke("face:loadGallery", classId),
    saveGallery: (classId, entries) =>
      ipcRenderer.invoke("face:saveGallery", classId, entries),
    removeGallery: (classId) =>
      ipcRenderer.invoke("face:removeGallery", classId),
    exportGallery: (classId, passphrase) =>
      ipcRenderer.invoke("face:exportGallery", classId, passphrase),
    importGallery: (passphrase) =>
      ipcRenderer.invoke("face:importGallery", passphrase),
  },
});
