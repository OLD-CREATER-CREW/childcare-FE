// Electron 메인 프로세스 — Next.js 웹앱을 노트북(데스크톱) 앱으로 감싸는 래퍼.
//
// - 개발:  `npm run electron:dev` → next dev(3000)를 창에 로드
// - 배포:  `npm run electron:build` → next build 정적 산출물(out/)을
//          내장 로컬 HTTP 서버(127.0.0.1 임의 포트)로 서빙해 로드.
//          file:// 대신 http://127.0.0.1을 쓰는 이유: MSW 서비스워커는
//          secure context(localhost)에서만 등록되기 때문.
const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// ELECTRON_USE_BUILD=1 이면 패키징 전에도 out/ 정적 빌드를 로드 (electron:preview)
const isDev = !app.isPackaged && process.env.ELECTRON_USE_BUILD !== "1";
const DEV_URL = "http://localhost:3000";

// ---------- 로컬 양식(서식) 폴더 ----------
// 각 노트북마다 서식이 다르므로, 사용자가 지정한 폴더 경로를 userData에 저장하고
// 그 폴더의 양식 파일을 읽어 렌더러에 넘긴다. 렌더러(웹 UI)는 파일 시스템에
// 직접 접근할 수 없고(contextIsolation), 오직 이 IPC 통로로만 접근한다.
const CONFIG_PATH = path.join(app.getPath("userData"), "childcare-config.json");
const TEMPLATE_EXTS = [".md", ".txt", ".json"];

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (e) {
    console.error("config 저장 실패:", e);
  }
}

/** 지정 폴더에서 양식으로 인정하는 확장자 파일명만 추린다(하위 폴더는 보지 않음) */
function listTemplateFiles(folder) {
  if (!folder) return [];
  try {
    return fs
      .readdirSync(folder)
      .filter((f) => TEMPLATE_EXTS.includes(path.extname(f).toLowerCase()))
      .sort();
  } catch {
    return [];
  }
}

function registerTemplateIpc() {
  // 현재 지정된 폴더 경로 + 인식된 파일 목록
  ipcMain.handle("templates:getConfig", () => {
    const folder = readConfig().templateFolder ?? null;
    return { folder, files: listTemplateFiles(folder) };
  });

  // OS 폴더 선택창 → 선택 경로를 저장하고 파일 목록 반환. 취소 시 기존 설정 유지.
  ipcMain.handle("templates:pickFolder", async () => {
    const res = await dialog.showOpenDialog({
      title: "양식 폴더 선택",
      properties: ["openDirectory"],
    });
    const cfg = readConfig();
    if (res.canceled || !res.filePaths[0]) {
      const folder = cfg.templateFolder ?? null;
      return { folder, files: listTemplateFiles(folder) };
    }
    cfg.templateFolder = res.filePaths[0];
    writeConfig(cfg);
    return {
      folder: cfg.templateFolder,
      files: listTemplateFiles(cfg.templateFolder),
    };
  });

  // 폴더의 양식 파일 전체를 { 파일명: 본문 } 으로 읽어 반환
  ipcMain.handle("templates:readAll", () => {
    const folder = readConfig().templateFolder;
    const out = {};
    for (const name of listTemplateFiles(folder)) {
      try {
        out[name] = fs.readFileSync(path.join(folder, name), "utf-8");
      } catch (e) {
        console.error("양식 읽기 실패:", name, e);
      }
    }
    return out;
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/** out/ 정적 산출물을 서빙하는 최소 HTTP 서버 (127.0.0.1 임의 포트) */
function serveOutDir(outDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
      // 경로 탈출 방지
      const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");

      // Next 정적 export 라우팅: /records → records.html → records/index.html → SPA 폴백
      const candidates = [
        path.join(outDir, safePath),
        path.join(outDir, `${safePath}.html`),
        path.join(outDir, safePath, "index.html"),
      ];
      let filePath = candidates.find((p) => {
        try {
          return fs.statSync(p).isFile();
        } catch {
          return false;
        }
      });
      let status = 200;
      if (!filePath) {
        status = 404;
        const notFound = path.join(outDir, "404.html");
        filePath = fs.existsSync(notFound)
          ? notFound
          : path.join(outDir, "index.html");
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(status, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        // MSW 서비스워커 스코프 허용
        ...(path.basename(filePath) === "mockServiceWorker.js"
          ? { "Service-Worker-Allowed": "/" }
          : {}),
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "어린이집 AI 행정비서",
    backgroundColor: "#FAFAF7",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 외부 링크는 앱 창이 아니라 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    await win.loadURL(DEV_URL);
  } else {
    const baseUrl = await serveOutDir(path.join(__dirname, "..", "out"));
    await win.loadURL(baseUrl);
  }

  // 패키징 전(개발·preview)에는 개발자 도구를 열어 둔다 — 양식 브리지 스모크
  // 확인용: 콘솔에서 `await window.desktop.templates.getConfig()` 등을 찔러볼 수 있다.
  if (!app.isPackaged) win.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(() => {
  registerTemplateIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
