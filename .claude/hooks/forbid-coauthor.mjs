#!/usr/bin/env node
/**
 * PreToolUse hook: `git commit` 메시지에서 Co-Authored-By 트레일러 금지.
 *
 * 이 저장소는 커밋에 AI 공저자 표기를 남기지 않습니다.
 * Claude Code 기본 동작이 트레일러를 붙이려 하므로 훅으로 차단합니다.
 *
 * stdin으로 PreToolUse JSON 입력:
 *   { "tool_name": "Bash", "tool_input": { "command": "git commit ..." }, ... }
 *
 * 종료 코드:
 *   0  통과 (git commit이 아니거나, 트레일러가 없거나, 메시지를 못 읽은 경우)
 *   2  트레일러 발견 → Claude가 stderr 메시지를 받고 트레일러를 빼고 다시 작성
 *
 * 메시지를 명령어에서 읽어낼 수 없는 형태(-F 파일, -t 템플릿, 에디터 실행)는
 * 통과시킵니다 — 오탐으로 정상 작업을 막는 쪽이 더 나쁘기 때문.
 */

import { readFileSync } from "node:fs";

// 대소문자 무시하고 잡음 (Co-authored-by, CO-AUTHORED-BY 등)
const TRAILER = /co-authored-by\s*:/i;

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // 파싱 실패 시 조용히 통과 (방어)
}

const command = input?.tool_input?.command ?? "";

// `git commit` 매칭 — `git log`, `git commit-tree` 등은 통과
const isGitCommit = /(?:^|[\s;&|(])git\s+commit(?:\s|$)/.test(command);
if (!isGitCommit) {
  process.exit(0);
}

// --amend --no-edit / -C / --reuse-message 는 기존 메시지를 재사용하므로 검사 대상 아님
if (/--no-edit|--reuse-message|(?:^|\s)-C(?:\s|=)/.test(command)) {
  process.exit(0);
}

// 메시지 본문 추출 — heredoc, -m "...", -m '...' 순으로 시도
function extractMessage(cmd) {
  // heredoc: git commit -F - <<'EOF' ... EOF
  const heredoc = cmd.match(/<<-?\s*['"]?(\w+)['"]?\r?\n([\s\S]*?)\r?\n\1/);
  if (heredoc) return heredoc[2];

  // -m/--message 로 넘긴 인용 문자열 전부 (여러 번 쓸 수 있음)
  const quoted = [
    ...cmd.matchAll(/(?:-m|--message[= ])\s*("(?:[^"\\]|\\.)*"|'[^']*')/g),
  ];
  if (quoted.length > 0) return quoted.map((m) => m[1].slice(1, -1)).join("\n");

  return null;
}

const message = extractMessage(command);

// 메시지를 못 읽었으면 판단 불가 → 통과
if (message === null) {
  process.exit(0);
}

if (!TRAILER.test(message)) {
  process.exit(0);
}

console.error("❌ 커밋 메시지에 Co-Authored-By 트레일러가 있어 차단됐습니다.");
console.error("");
console.error("   이 저장소는 커밋에 AI 공저자 표기를 남기지 않습니다.");
console.error("   해당 줄을 지우고 다시 커밋하세요.");
process.exit(2);
