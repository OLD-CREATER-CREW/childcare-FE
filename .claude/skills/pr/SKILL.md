---
name: pr
description: GitHub PR 생성 — gh로 직접 생성, 미설치 시 안내 → docs/pr/*.md 저장 (로컬/GitHub 전용)
argument-hint: "[제목 힌트] (optional)"
---

## Context (자동 수집)

- current_branch: !`git branch --show-current`
- git_user: !`git config user.name`
- gh_available: !`which gh`
- gh_repo: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null`
- default_base: !`gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null`
- pr_template: `.github/PULL_REQUEST_TEMPLATE.md` 또는 `.github/pull_request_template.md`가 있으면 Read하여 본문 골격으로 사용

---

당신은 GitHub Pull Request 작성 도우미입니다.

> 이 스킬은 **로컬 + GitHub 전용**입니다. Jira / GitLab / Confluence 연동은 없습니다.

## PR 제목 형식

```
{Type}: #{이슈번호} {제목}
```

예시: `Fix: #35 키워드 조회 전 조기 렌더링 및 dialog 라우팅 버그 수정`

### 구성 요소

**1) `{Type}`** — 커밋 메시지 컨벤션과 동일 (commit skill 참조)

- Type: `Feat` / `Fix` / `Refactor` / `Chore` / `Style` / `Docs` / `Test`
- 본 브랜치에 여러 Type 커밋이 섞인 경우: **가장 비중·영향이 큰 것** 선택. 애매하면 사용자에게 확인.

**2) `#{이슈번호}`** — 본 브랜치가 연결된 GitHub 이슈 번호 (브랜치명에서 추출, 예: `feature/23-login-page` → `#23`). 연결 이슈가 없으면 생략.

**3) `{제목}`** — 한국어, 동사형으로 종결 (추가 / 수정 / 제거 / 통합 등). 마침표 붙이지 않음. 너무 길면 본문에 상세, 제목은 핵심만.

## 담당자 규칙

- **Assignee**: 작성자 본인 (`--assignee @me`).
- **Reviewer**: 지정할 사람이 있으면 `--reviewer {username}`. 개인 레포 등 지정 대상이 없으면 생략 (필수 아님).

---

## 실행 절차

### 1단계: 정보 수집

사용자에게 아래를 확인합니다:

```
1. 병합 대상(base) 브랜치: (기본값 default_base, 보통 main)
2. 리뷰어: (선택, 없으면 생략)
```

> 📦 **pr 책임 범위**: 본 skill은 **메타데이터만 수집**합니다 (변경 파일 목록, 커밋 이력 — 모두 작은 출력). 큰 diff 본문은 5단계의 `/review`가 자체적으로 수집·처리하므로 pr이 메인 컨텍스트를 오염시키지 않습니다.

그리고 자동으로 수집합니다:

- `git diff --name-only origin/<base>...HEAD` → 변경 파일 목록
- `git log origin/<base>...HEAD --oneline` → 커밋 이력

### 2단계: PR 본문 작성

`pr_template`(`.github/PULL_REQUEST_TEMPLATE.md`)이 있으면 그 골격을 기반으로, 없으면 아래 기본 골격으로 작성합니다.

```markdown
## ✅ 개요

{커밋 메시지 기반 요약}

## 📝 변경 사항

{변경 파일·커밋 기반 상세}

## 🧪 테스트

{테스트 방법/결과, 없으면 TBD}

## 🔗 관련 이슈

Closes #{이슈번호}
```

자동 추론 항목:

- 커밋 타입 → PR 유형
- 커밋 메시지 → 개요, 변경 사항
- 변경 파일 → 영향 범위
- 패키지 변경 여부 → 배포/설치 가이드

누락 정보는 `TBD` 또는 `확인 필요:`로 표시합니다.

**이슈 연결:**

- current_branch에서 이슈 번호 추출 (예: `feature/23-login-page` → `#23`)
- 본문에 `Closes #23` 자동 포함 (이슈 번호가 있을 때만)

### 3단계: 사용자 확인

작성된 PR 제목과 본문을 출력하여 확인을 받습니다.
수정 요청이 있으면 반영 후 재확인합니다.

### 4단계: PR 생성

**gh 설치된 경우:**

먼저 현재 브랜치를 원격에 push합니다 (이미 push돼 있어도 멱등):

```bash
git push -u origin HEAD
```

이어서 PR 생성:

```bash
gh pr create \
  --base "main" \
  --title "Fix: #35 ..." \
  --body "$(cat <<'GH_PR_BODY_END'
PR 본문 내용
GH_PR_BODY_END
)" \
  --assignee @me
```

- `--base`: 1단계에서 확정한 base 브랜치 (기본 `main`).
- 리뷰어가 있으면 `--reviewer {username}` 추가.
- heredoc 토큰은 `EOF` 대신 `GH_PR_BODY_END` 사용, 단일 따옴표(`<<'GH_PR_BODY_END'`)로 변수/명령 치환 차단.

생성 완료 후 PR URL을 안내합니다.

**gh 미설치된 경우:**

```
⚠️ gh CLI가 설치되어 있지 않습니다.

gh를 설치하면 PR을 자동으로 생성할 수 있습니다.
→ https://cli.github.com/

설치하시겠습니까?
1. 설치 방법 안내받기
2. 지금은 건너뛰고 PR 본문을 파일로 저장
```

거부 시: `docs/pr/<이슈번호>-<짧은설명>.md` 파일로 저장합니다.

### 5단계: 리뷰 실행 (Agent 툴 기반 페르소나 병렬)

PR이 생성된 상태이므로 리뷰 결과를 `gh pr comment`로 바로 코멘트 등록할 수 있습니다.
PR 생성 완료 후 **반드시** 리뷰를 진행합니다:

```
✅ PR 생성 완료: [PR URL]

📋 리뷰를 진행할까요? (PR 코멘트에 자동 등록됩니다)
1. 코드 리뷰 실행 (/review) — 시니어 / 보안 / 아키텍트 / QA 4명 페르소나 병렬 리뷰
2. 건너뛰기 (이미 완료한 경우)
```

`review` skill 호출 시 **리뷰 범위를 명시적으로 패스**합니다 (`/pr` 컨텍스트에서는 항상 origin/base 비교가 정답):

```
/review origin/<base>...HEAD
```

> 명시 패스를 안 하면 review의 우선순위 기본값(working/staged 우선)이 적용돼 우연히 남은 dirty change가 잘못 잡힐 수 있음.

`/review`는 코디네이터가 메인 컨텍스트에서 Agent 툴로 4 페르소나(시니어/보안/아키텍트/QA) **subagent를 단일 메시지 병렬 호출**하여 합성된 노트 1개를 PR에 등록합니다. 각 페르소나는 자체 subagent context로 격리되어 메인 컨텍스트 오염 없음.

> 보안만 빠르게 다시 보고 싶을 때는 별도로 `/secure-review`를 호출할 수 있습니다 (스탠드얼론, `context: fork` 격리, npm audit 포함).

리뷰가 완료되면 Blocker 항목을 안내합니다:

```
📋 리뷰 완료

Blocker: N건
[Blocker 목록]

Blocker가 있으면 수정 후 재커밋하고 리뷰를 재실행하세요.
없으면 리뷰어에게 PR 리뷰를 요청하세요.
```
