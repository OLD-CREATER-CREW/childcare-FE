#!/usr/bin/env node
/**
 * 파일럿 핵심 지표(4개) 수집 스크립트 — 온디맨드 실행용 (Node, 무의존성)
 *
 * 측정 문서 "[김두리] 파일럿 프로젝트 측정 지표"의 지표 1~4를 자동 산출한다.
 * 세션 hook(pilot-session-metrics.mjs)이 잡는 토큰/메시지(=베이스라인·보조)와 달리,
 * 이 4개는 progress.md + git 에서 나오므로 "작업 repo"에서 돌려야 한다.
 *
 *   지표 1  progress.md 생존율  = 결정 로그 2건 이상인 폴더 / 전체 폴더
 *   지표 2  /commit 자동 기록률 = (Feat/Fix/Refactor 커밋 중 progress.md에 해시 등장) / 전체
 *   지표 3  /note 수동 기록 건수 = progress.md 의 시·분 없는 날짜 줄 수
 *   지표 4  /start 채택률(보조)  = /start 생성 폴더 / 기간 내 새 작업 브랜치  (근사값)
 *
 * 사용법 (작업 repo 루트에서):
 *   node .claude/scripts/pilot-core-metrics.mjs            # 기간 자동(태그→fallback)
 *   node .claude/scripts/pilot-core-metrics.mjs --since=2026-05-28 --until=2026-06-10
 *   node .claude/scripts/pilot-core-metrics.mjs --dry-run  # 파일 기록 없이 출력만
 *
 * 기간 결정 우선순위:
 *   ① --since 인자  ②  git tag `pilot-start` 의 커밋 시각  ③ 최근 14일(경고)
 *
 * 결과:
 *   - 사람이 읽는 요약 + 부록 양식 한 줄 블록을 stdout 출력
 *   - docs/pilot-metrics/core-metrics.jsonl 에 스냅샷 1줄 append (--dry-run 시 생략)
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const CWD = process.cwd();
const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes("--dry-run");
const getArg = (name) => {
  const hit = ARGS.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};

// ── git helpers (git 아닌 repo에서도 죽지 않도록 전부 try) ──────────────
function git(cmd) {
  return execSync(`git ${cmd}`, {
    cwd: CWD,
    encoding: "utf8",
    timeout: 15000,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}
function isGitRepo() {
  try {
    git("rev-parse --is-inside-work-tree");
    return true;
  } catch {
    return false;
  }
}

// ── progress.md 수집 (docs/features 하위 재귀) ─────────────────────────
function findProgressFiles() {
  const root = path.join(CWD, "docs", "features");
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name === "progress.md") out.push(full);
    }
  };
  walk(root);
  return out;
}

// 결정 로그 한 줄 = "- [YYYY-MM-DD" 로 시작 (자동/수동 공통)
const DECISION_RE = /^\s*[-*]\s*\[\d{4}-\d{2}-\d{2}/;
// 수동(/note) = 시·분 없이 날짜만: "- [YYYY-MM-DD]" (뒤에 시간 없음)
const MANUAL_NOTE_RE = /^\s*[-*]\s*\[\d{4}-\d{2}-\d{2}\]/;
// /start 사용 흔적 = 지표 1 분모 & 지표 4 의 B
//   "/start 실행, 작업 환경 셋업 완료" / "작업 환경 셋업 (/start 실행)" / "/start 절차" 등 변형 포괄
//   ⚠ /start2 는 별개 도구로 보고 제외(팀 결정) → \b 가 "start" 뒤 "2"를 경계로 안 봐 자동 배제됨
const START_USAGE_RE = /\/start\b[^\n]*(실행|절차|셋업)/;

// ── 기간 결정 ─────────────────────────────────────────────────────────
function resolvePeriod(gitOk) {
  const sinceArg = getArg("since");
  const untilArg = getArg("until");
  if (sinceArg) {
    return { since: sinceArg, until: untilArg || "", source: "arg(--since)" };
  }
  if (gitOk) {
    try {
      const tagDate = git("log -1 --format=%cI pilot-start");
      if (tagDate) {
        return { since: tagDate, until: untilArg || "", source: "tag(pilot-start)" };
      }
    } catch {
      /* 태그 없음 */
    }
  }
  return { since: "2 weeks ago", until: untilArg || "", source: "fallback(최근 14일)" };
}

// ── 지표 1 & 3 : progress.md 기반 ─────────────────────────────────────
function collectDocMetrics() {
  const files = findProgressFiles();
  let noteCount = 0;
  const perFolder = [];
  const texts = [];
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    texts.push(text);
    const lines = text.split("\n");
    let decisions = 0;
    let notes = 0;
    let isStart = false;
    for (const line of lines) {
      if (DECISION_RE.test(line)) decisions += 1;
      if (MANUAL_NOTE_RE.test(line)) notes += 1;
      if (!isStart && START_USAGE_RE.test(line)) isStart = true;
    }
    noteCount += notes;
    perFolder.push({
      folder: path.relative(CWD, path.dirname(f)),
      decisions,
      alive: decisions >= 2,
      isStart,
    });
  }
  // 지표 1 분모 = /start 로 생성된 폴더 (문서 정의). 전체 progress.md 가 아님.
  const startFolders = perFolder.filter((p) => p.isStart);
  const startAlive = startFolders.filter((p) => p.alive).length;
  return {
    total: files.length, // 전체 progress.md (참고용)
    startTotal: startFolders.length, // 지표 1·4 분모/B
    startAlive,
    pct: startFolders.length
      ? Math.round((startAlive / startFolders.length) * 100)
      : null,
    smallSample: startFolders.length > 0 && startFolders.length < 10,
    noteCount,
    perFolder,
    allText: texts.join("\n"),
  };
}

// ── 지표 2 : /commit 자동 기록률 ──────────────────────────────────────
const COMMIT_PREFIX_RE = /^(feat|fix|refactor)(?![a-z])/i; // feature/fixture 오탐 방지
function collectCommitRate(period, progressText) {
  const sinceFlag = period.since ? ` --since="${period.since}"` : "";
  const untilFlag = period.until ? ` --until="${period.until}"` : "";
  let raw = "";
  try {
    raw = git(`log${sinceFlag}${untilFlag} --no-merges --format=%H%x09%s`);
  } catch {
    return { measurable: false };
  }
  const commits = raw
    ? raw.split("\n").map((l) => {
        const [hash, ...rest] = l.split("\t");
        return { hash, subject: rest.join("\t") };
      })
    : [];
  const meaningful = commits.filter((c) => COMMIT_PREFIX_RE.test(c.subject.trim()));

  // progress.md 에 등장하는 해시 토큰(7~40자 hex) 집합
  const tokens = new Set();
  for (const m of progressText.matchAll(/\b([0-9a-f]{7,40})\b/g)) tokens.add(m[1]);

  const missing = [];
  let b = 0;
  for (const c of meaningful) {
    const found = [...tokens].some((t) => c.hash.startsWith(t));
    if (found) b += 1;
    else missing.push(`${c.hash.slice(0, 8)} ${c.subject}`);
  }
  const a = meaningful.length;
  return {
    measurable: true,
    a,
    b,
    pct: a ? Math.round((b / a) * 100) : null,
    missing,
  };
}

// ── 지표 4 : /start 채택률 (근사·보조) ────────────────────────────────
const BRANCH_PREFIX_RE = /^(feature|fix|hotfix|refactor|chore|docs)\//;
function detectBaseBranch() {
  for (const b of ["dev", "main", "master"]) {
    try {
      git(`rev-parse --verify ${b}`);
      return b;
    } catch {
      /* 없음 */
    }
  }
  return null;
}
function collectAdoption(period, docMetrics) {
  // B = /start 로 생성된 progress.md 폴더 수 (지표 1 분모와 동일 집계 재사용)
  const b = docMetrics.startTotal;

  // A = 기간 내 새로 생긴 작업 브랜치 수 (첫 커밋일로 근사)
  const base = detectBaseBranch();
  let a = null;
  let approxNote = "";
  if (base) {
    try {
      const branches = git("for-each-ref --format=%(refname:short) refs/heads")
        .split("\n")
        .filter((x) => BRANCH_PREFIX_RE.test(x) && x !== base);
      const sinceFlag = period.since ? ` --since="${period.since}"` : "";
      const untilFlag = period.until ? ` --until="${period.until}"` : "";
      let count = 0;
      for (const br of branches) {
        // base..br 의 가장 오래된 커밋 = 분기 근사 시점, 그게 기간 안이면 카운트
        let firstDate = "";
        try {
          const dates = git(`log --reverse --format=%cI ${base}..${br}`).split("\n");
          firstDate = dates[0] || "";
        } catch {
          continue;
        }
        if (!firstDate) continue;
        // 기간 필터를 git에 다시 태워 0/1 판정 (가장 단순·정확)
        try {
          const inRange = git(
            `log${sinceFlag}${untilFlag} --reverse --format=%H ${base}..${br}`,
          );
          if (inRange) count += 1;
        } catch {
          /* skip */
        }
      }
      a = count;
      approxNote = `base=${base} 기준, 첫 커밋일 근사`;
    } catch {
      approxNote = "브랜치 스캔 실패";
    }
  } else {
    approxNote = "base 브랜치(dev/main) 없음";
  }
  return { a, b, pct: a ? Math.round((b / a) * 100) : null, approxNote };
}

// ── 실행 ──────────────────────────────────────────────────────────────
function main() {
  const gitOk = isGitRepo();
  const period = resolvePeriod(gitOk);
  const doc = collectDocMetrics();
  const commit = gitOk
    ? collectCommitRate(period, doc.allText)
    : { measurable: false };
  const adoption = gitOk
    ? collectAdoption(period, doc)
    : { a: null, b: 0, pct: null, approxNote: "git repo 아님" };

  const project = path.basename(CWD) || "unknown";

  // ── 0단계: 컨벤션/환경 요약 ──
  console.log(`\n■ 파일럿 핵심 지표 — ${project}`);
  console.log(`  측정 기간: since="${period.since}"${period.until ? ` until="${period.until}"` : " (현재까지)"}  [${period.source}]`);
  console.log(`  progress.md: ${doc.total}개  |  git: ${gitOk ? "있음" : "없음(지표2·4 측정 불가)"}`);

  // ── 지표 1 ── (분모 = /start 로 생성된 폴더. 전체 progress.md 가 아님)
  console.log(`\n[지표 1] progress.md 생존율  (분모 = /start 생성 폴더)`);
  if (doc.startTotal === 0) {
    console.log(`  측정 불가 — /start 로 생성된 progress.md 없음 (전체 progress.md ${doc.total}개)`);
  } else {
    console.log(`  ${doc.pct}% (${doc.startAlive}/${doc.startTotal})${doc.smallSample ? "  ⚠ 표본<10 → %보다 건수로 판단" : ""}`);
    for (const p of doc.perFolder) {
      const tag = p.isStart ? (p.alive ? "✓" : "·") : "–"; // – = /start 외(분모 제외)
      console.log(`    ${tag} ${p.folder}  (결정로그 ${p.decisions}건${p.isStart ? "" : ", /start 아님→제외"})`);
    }
  }

  // ── 지표 2 ──
  console.log(`\n[지표 2] /commit 자동 기록률 (커밋 수 단위)`);
  if (!commit.measurable) {
    console.log(`  측정 불가 — git 로그 없음`);
  } else if (commit.a === 0) {
    console.log(`  기간 내 Feat/Fix/Refactor 커밋 없음 (A=0)`);
  } else {
    console.log(`  ${commit.pct}% (B=${commit.b}/A=${commit.a})`);
    if (commit.missing.length) {
      console.log(`  progress.md 미등장 커밋 ${commit.missing.length}건:`);
      for (const m of commit.missing.slice(0, 15)) console.log(`    - ${m}`);
      if (commit.missing.length > 15) console.log(`    … 외 ${commit.missing.length - 15}건`);
    }
  }

  // ── 지표 3 ──
  console.log(`\n[지표 3] /note 수동 기록 건수`);
  console.log(`  ${doc.noteCount}건  (사람별 분포: 확인 필요 — git blame 미적용)`);

  // ── 지표 4 ──
  console.log(`\n[지표 4] /start 채택률 (보조·근사)`);
  if (adoption.a === null) {
    console.log(`  A(새 작업 브랜치) 측정 불가 — ${adoption.approxNote}  /  B(/start 폴더)=${adoption.b}`);
  } else if (adoption.a === 0) {
    console.log(`  기간 내 새 작업 브랜치 없음 (A=0)  /  B(/start 폴더)=${adoption.b}`);
  } else {
    console.log(`  ${adoption.pct}% (B=${adoption.b}/A=${adoption.a})  [${adoption.approxNote}]`);
  }

  // ── 부록 양식 한 줄 블록 ──
  const line1 = doc.startTotal ? `${doc.pct}% (${doc.startAlive}/${doc.startTotal})` : "측정불가";
  const line2 = commit.measurable && commit.a ? `${commit.pct}% (${commit.b}/${commit.a})` : "측정불가";
  const line4 = adoption.a ? `${adoption.pct}% (${adoption.b}/${adoption.a})` : "측정불가";
  console.log(`\n── 부록 "측정 기록 양식"에 붙일 한 줄 ──`);
  console.log(`1. 생존율: ${line1}`);
  console.log(`2. /commit 기록률: ${line2}`);
  console.log(`3. /note: ${doc.noteCount}건`);
  console.log(`4. 채택률: ${line4}`);

  // ── 스냅샷 저장 ──
  const record = {
    ts: new Date().toISOString(),
    project,
    period,
    survival: { alive: doc.startAlive, total: doc.startTotal, pct: doc.pct, all_progress_md: doc.total },
    commit_rate: commit.measurable
      ? { a: commit.a, b: commit.b, pct: commit.pct, missing: commit.missing }
      : { measurable: false },
    note_count: doc.noteCount,
    adoption: { a: adoption.a, b: adoption.b, pct: adoption.pct, approx: true },
  };
  if (DRY_RUN) {
    console.log(`\n(--dry-run: 파일 미기록)`);
  } else {
    const outDir = path.join(CWD, "docs", "pilot-metrics");
    fs.mkdirSync(outDir, { recursive: true });
    fs.appendFileSync(
      path.join(outDir, "core-metrics.jsonl"),
      JSON.stringify(record) + "\n",
      "utf8",
    );
    console.log(`\n→ docs/pilot-metrics/core-metrics.jsonl 에 스냅샷 1줄 추가됨`);
  }
}

main();
