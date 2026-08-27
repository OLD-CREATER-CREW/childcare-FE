// Electron preload — 렌더러(웹 UI)에 노출하는 좁은 네이티브 통로.
// 파일 시스템을 통째로 열지 않고, 양식 폴더 지정/조회/읽기 채널만 노출한다.
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  templates: {
    getConfig: () => ipcRenderer.invoke("templates:getConfig"),
    pickFolder: () => ipcRenderer.invoke("templates:pickFolder"),
    readAll: () => ipcRenderer.invoke("templates:readAll"),
  },
  // 사진 폴더 — 폴더 자체는 렌더러가 파일 시스템 접근 API로 다루고(핸들을
  // IndexedDB에 저장한다 · `lib/face/photoRoot.ts`), 여기서는 **화면에 보여 줄
  // 절대 경로**만 거든다. 웹 표준은 경로를 감추지만 데스크톱 앱에서는
  // `D:\어린이집사진6`처럼 보여 주는 편이 교사에게 훨씬 분명하다.
  //
  // File 객체를 그대로 넘겨받아 preload 안에서 풀어야 한다 — contextBridge를
  // 건너오며 복제되면 경로를 되찾을 수 없다(Electron 문서의 권장 형태).
  photos: {
    pathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file) || "";
      } catch {
        return "";
      }
    },
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
