// Electron 메인 프로세스 — Next.js 웹앱을 노트북(데스크톱) 앱으로 감싸는 래퍼.
//
// - 개발:  `npm run electron:dev` → next dev(3000)를 창에 로드
// - 배포:  `npm run electron:build` → next build 정적 산출물(out/)을
//          내장 로컬 HTTP 서버(127.0.0.1 임의 포트)로 서빙해 로드.
//          file:// 대신 http://127.0.0.1을 쓰는 이유: MSW 서비스워커는
//          secure context(localhost)에서만 등록되기 때문.
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// ELECTRON_USE_BUILD=1 이면 패키징 전에도 out/ 정적 빌드를 로드 (electron:preview)
const isDev = !app.isPackaged && process.env.ELECTRON_USE_BUILD !== "1";
const DEV_URL = "http://localhost:3000";

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
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
