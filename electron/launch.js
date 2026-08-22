/**
 * Electron 실행 런처 — Windows·macOS·리눅스에서 똑같이 동작한다.
 *
 * ■ 왜 필요한가
 * 원래 스크립트는 `env -u ELECTRON_RUN_AS_NODE electron .` 이었는데, `env` 는
 * 유닉스 명령이라 Windows 에는 없다. npm 스크립트는 Windows 에서 cmd.exe 로
 * 도니까 "'env'은(는) 내부 또는 외부 명령이 아닙니다" 로 죽는다.
 *
 * ■ ELECTRON_RUN_AS_NODE 를 왜 지우나
 * 이 값이 켜져 있으면 electron 바이너리가 **창을 띄우지 않고 그냥 Node 처럼** 돈다.
 * VS Code 통합 터미널 등 일부 환경이 이 변수를 심어 두기 때문에, 실행 직전에
 * 지워 주지 않으면 앱 창이 안 뜨고 조용히 끝난다.
 *
 * 사용:
 *   node electron/launch.js          개발(next dev 를 창에 로드)
 *   node electron/launch.js --build  out/ 정적 빌드를 로드(preview)
 */

const { spawn } = require("node:child_process");

// require("electron") 는 일반 Node 에서 실행 파일 경로(문자열)를 돌려준다
const electronPath = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
if (process.argv.includes("--build")) env.ELECTRON_USE_BUILD = "1";

const child = spawn(electronPath, ["."], { stdio: "inherit", env });

child.on("close", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Electron 실행 실패:", err.message);
  process.exit(1);
});
