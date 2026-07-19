---
description: 작업 시작 — plan.md 작성 → GitHub 이슈 생성 → 브랜치 생성 → progress.md 생성 (로컬/GitHub 전용)
argument-hint: "[GitHub 이슈 번호] (선택, 없으면 신규 생성 모드)"
---

## Context (자동 수집)

- current_branch: !`git branch --show-current`
- git_user: !`git config user.name`
- gh_available: !`which gh`
- gh_repo: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null`
- gh_username: !`gh api user -q .login 2>/dev/null`

---

당신은 작업 시작 도우미입니다. plan.md 작성부터 progress.md 생성까지 한 번에 처리합니다.

핵심 원칙: GitHub 이슈를 먼저 부르면 description이 빈약해서 plan.md도 부실해집니다.
그래서 plan.md를 가장 먼저 작성하고, 그 내용을 GitHub 이슈 본문에 채우는 방향으로 동작합니다.

> 이 스킬은 **로컬 + GitHub 전용**입니다. Jira / GitLab / Confluence 연동은 없습니다.

## 입력

- GitHub 이슈 번호: `$ARGUMENTS` (선택, 예: `42`)
- 인자가 있으면 **업데이트 모드**(기존 이슈 사용), 없으면 **생성 모드**로 동작합니다.

---

## 실행 절차

### Stage 1: plan.md 작성 (첫 단계, 사용자 입력 기반)

사용자에게 다음 항목을 순서대로 입력받습니다.

**🚨 입력 방식 (강제) — 하이브리드 방식**

질문 성격에 따라 입력 방식을 다르게 사용합니다:

| 질문 성격              | 입력 방식              | 예시                                               |
| ---------------------- | ---------------------- | -------------------------------------------------- |
| **보기가 명확한 선택** | `AskUserQuestion` 카드 | Type 선택(Feat/Fix/...), "이대로 진행할까요?" 확인 |
| **자유 텍스트 입력**   | **평문 채팅 메시지**   | 작업 제목, 작업 목적, In Scope, URL 등             |

평문(plain text) 질문 = 카드 UI 없이 그냥 채팅 메시지로 짧게 한 줄 물어봄. 사용자는 답을 채팅창에 타이핑.

**`AskUserQuestion` 사용 시 절대 금지:**

- options에 "직접 입력하기", "Other 선택", "수동 작성" 같은 중복/안내 옵션 넣기 — UI가 "Other"를 자동으로 붙이므로 중복이고 사용자가 헷갈림.
- question 문구에 "Other 선택해서 입력" 같은 안내 — 자유 텍스트는 어차피 평문으로 물을 거라 이런 안내 자체가 필요 없음.

**평문 질문 원칙:**

- 한 질문만 한 줄로. 예시 1개 정도 괄호로 같이.
- 한 메시지에 여러 항목을 한꺼번에 나열해서 묻지 않음 (한 항목씩 순차).
- 단, 참고 링크 묶음(Figma/Storybook/API/기타)처럼 짧은 URL 입력 여러 개는 한 메시지에 묶어서 한 번에 물어도 됨.

#### 1-1. 작업 유형(Type) 선택

`AskUserQuestion` 1회 호출. options는 다음 4개로 둡니다 (나머지 Chore/Docs는 사용자가 "Other"에 직접 타이핑):

| label    | description                          |
| -------- | ------------------------------------ |
| Feat     | 신규 기능 추가                       |
| Fix      | 버그 수정                            |
| Hotfix   | 운영 긴급 수정 (main 브랜치 기반)    |
| Refactor | 리팩터링                            |

> Style, Test는 단독 브랜치 없음 — 다른 작업에 묻어가는 것이 팀 컨벤션이므로 `/start`로 시작하지 않습니다.

#### 1-2. 작업 제목 → 기능명 확정

**평문**으로 작업 제목을 묻습니다.

> 작업 제목을 한 줄로 적어주세요. (예: 로그인 페이지, 이슈 알림 페이지)

**중요**: 사용자가 입력한 **원본 한글 제목은 반드시 보존**합니다 — GitHub 이슈 제목, plan.md 본문 등에 그대로 사용. kebab-case는 폴더명·브랜치명 전용입니다.

응답을 받으면 kebab-case로 변환한 뒤 기능명 확정을 **`AskUserQuestion` 카드**로 확인합니다 (이 단계는 보기 선택이라 카드가 자연스러움):

- question: `기능명 "{변환된 기능명}" 로 진행할까요?`
- options:
  - `{ label: "이대로 진행", description: "{변환된 기능명}" }`
  - `{ label: "다른 이름으로 변경", description: "다음 메시지에서 새 기능명 입력" }`

"다른 이름으로 변경"을 고르면 다시 평문으로 새 기능명을 묻습니다.

같은 기능명 폴더가 이미 존재하면 → **후속 이슈 모드**로 전환:

- plan.md는 건드리지 않음 (v1 정책)
- progress.md만 Stage 5에서 새 이슈 섹션 추가

#### 1-3. 작업 목적 / 범위 / 접근 방식 / 참고 자료 입력

**모두 평문**으로 한 항목씩 순차적으로 묻습니다. 카드(`AskUserQuestion`) 사용 금지.

질문 순서 및 문구 — **각 질문에 "이게 뭔지" 한 줄 설명 + 예시를 반드시 같이** 적어주세요. 사용자가 항목의 역할을 못 헷갈리게.

1. 🎯 **작업 목적** (필수, 한 줄) — **왜** 이걸 하는지
   > 🎯 작업 목적을 한 줄로 적어주세요. 이 작업이 왜 필요한지 한 문장으로.
   > 예: 사용자에게 이슈 변동 알림을 누락 없이 전달하기 위해
2. 📋 **In Scope** (필수, 형식 자유) — **무엇을** 할 것인지 (체크리스트가 됨)
   > 📋 이번 PR에서 끝낼 작업 내용을 적어주세요. 형식 자유 — 글머리표(`-`/`*`/번호), 줄바꿈, 줄글(문단) 어느 쪽이든 됩니다.
   > 기획 문서를 그대로 붙여넣어도 좋고, "A 페이지 구현하고 B API 연동하고 C 처리까지" 같은 한 문단도 됩니다.
   > → plan.md 작성 시 항목 단위로 자동 분해해서 체크박스로 변환합니다.
3. 📋 **Out of Scope** (선택, 형식 자유) — **안 할 것** 명시
   > 📋 이번 작업에서 빼는 항목이 있나요? (나중에 "왜 빠졌어?" 방지용)
   > 형식 자유 — 글머리표든 줄글이든 OK.
   > 예: 푸시 알림 설정 페이지는 별도 이슈로 분리
   > (없으면 "없음")
4. 🛠️ **접근 방식** (선택) — **어떻게** 할 것인지 (기술 전략)
   > 🛠️ 기술적 접근 방식이 정해진 게 있나요? 구현 전략·재사용할 모듈 등.
   > 예: 기존 NotificationStore 확장 / MSW로 mock 우선
   > (없으면 "없음")
5. 🔗 **참고 자료 묶음** (선택) — 기획·디자인·API 문서 **링크**. **한 메시지에 묶어서** 한 번에 묻습니다:
   > 🔗 참고 자료 링크가 있으면 알려주세요. 없는 항목은 빈 줄로 두세요.
   >
   > - Figma:
   > - Storybook:
   > - API 명세 (FRONTEND_API_GUIDE.md 경로 등):
   > - 기타:

빈 응답·"없음"·"skip"·"건너뛰기"는 해당 항목을 비운 것으로 간주합니다.

#### 1-4. plan.md 생성

`docs/features/{기능명}/plan.md` 경로에 아래 템플릿으로 생성합니다.
**GitHub Issue / Branch 항목은 빈 상태로 둡니다** (Stage 2~3에서 자동 갱신).

**In Scope / Out of Scope 정규화 (필수):**
사용자가 In Scope·Out of Scope를 줄글(문단)로 적은 경우, plan.md에 그대로 붙여넣지 말고 **항목 단위로 분해해서 체크박스 리스트로 변환**합니다.

- 분해 기준: 문장 단위, 그리고 동사 단위로 끊을 수 있는 작업 단위 (예: "A 페이지 구현하고 B API 연동" → `A 페이지 구현` / `B API 연동` 두 항목)
- 사용자가 이미 글머리표·줄바꿈으로 구분했으면 그 구분을 그대로 사용
- 의역·요약은 최소화 (원문 표현 유지). 단, 체크박스 항목 단위로 자연스럽게 끝나도록 어미만 다듬음
- 분해 결과가 애매하면 그대로 한 항목으로 두고 사용자가 plan.md에서 수동 분리하도록 둡니다.

```markdown
# {기능명}

| 항목         | 값                                    |
| ------------ | ------------------------------------- |
| GitHub Issue | (Stage 2 완료 후 자동 주입)           |
| Branch       | (Stage 3 완료 후 자동 주입)           |
| 작성자       | {git_user}                            |
| 작성일       | {YYYY-MM-DD}                          |
| Type         | {Feat/Fix/Hotfix/Refactor/Chore/Docs} |

## 🎯 작업 목적

{사용자 입력값}

## 📋 작업 범위

**포함 (In Scope)**

- [ ] {사용자 입력값 1}
- [ ] {사용자 입력값 2}

**제외 (Out of Scope)**

- {사용자 입력값, 없으면 "(수동 작성)"}

<!-- 후속 이슈 섹션은 여기 아래로 추가 — v2 자동화 예정 -->

## 🛠️ 접근 방식

{사용자 입력값 — 비워두면 "[작업 진행하면서 채워주세요]" 그대로}

## 🔗 참고 자료

| 유형      | 링크                    |
| --------- | ----------------------- |
| Figma     | {사용자 입력, 없으면 -} |
| Storybook | {사용자 입력, 없으면 -} |
| API 명세  | {사용자 입력, 없으면 -} |
| 기타      | {사용자 입력, 없으면 -} |

## 🤔 주요 결정 사항

<!-- /note 또는 수동으로 추가 -->
```

---

### Stage 2: GitHub 이슈 처리 (plan.md → 이슈 본문 채움)

`$ARGUMENTS` 유무에 따라 분기합니다. `gh_available`이 비어 있으면(미설치) 사용자에게 알리고 이슈 단계를 건너뛴 뒤 Stage 3에서 이슈 번호 없이 진행합니다.

#### 2-A. 업데이트 모드 (`$ARGUMENTS` 있음)

기존 GitHub 이슈를 조회한 후 plan.md 내용으로 본문을 갱신합니다.

```bash
gh issue view {번호} --json number,title,url
gh issue edit {번호} --body "$(cat <<'GH_BODY_END'
... 본문 ...
GH_BODY_END
)"
```

조회 실패 시 사용자에게 이슈 번호를 다시 확인 요청합니다.

#### 2-B. 생성 모드 (`$ARGUMENTS` 없음)

**원본 한글 작업 제목**(1-2에서 입력받은 값)을 제목으로, 작업 목적/범위/참고 자료를 본문으로 사용하여 GitHub 신규 이슈를 생성합니다. **kebab-case 기능명은 제목에 쓰지 않습니다.**

**이슈 제목:** `[Type] {작업 제목(한글)}`

Type 매핑 (제목 prefix + GitHub 라벨):

| Stage 1 Type | 제목 prefix  | `--label` |
| ------------ | ------------ | --------- |
| Feat         | `[Feat]`     | `feat`    |
| Fix          | `[Fix]`      | `fix`     |
| Hotfix       | `[Hotfix]`   | `hotfix`  |
| Refactor     | `[Refactor]` | `refactor`|
| Chore        | `[Chore]`    | `chore`   |
| Docs         | `[Docs]`     | `docs`    |

**이슈 본문:**

```markdown
## ✅ 개요

{plan.md의 🎯 작업 목적}

## 📝 상세 내용

{plan.md의 작업 목적 + 작업 범위}

## 🔧 작업 항목

{plan.md의 In Scope를 체크박스로 변환}

## 📎 참고 자료

| 유형      | 링크                    |
| --------- | ----------------------- |
| Figma     | {plan.md의 Figma 항목}  |
| Storybook | {plan.md의 Storybook}   |
| API 명세  | {plan.md의 API 명세}    |
| 기타      | {plan.md의 기타 항목}   |
```

생성 명령:

```bash
gh issue create \
  --title "[{Type}] {작업 제목(한글)}" \
  --body "$(cat <<'GH_BODY_END'
... 본문 ...
GH_BODY_END
)" \
  --assignee @me \
  --label {Type 매핑 라벨}
```

- `--assignee @me`: 작성자 본인. (또는 Context의 `gh_username`)
- `--label`: 위 Type 매핑 표의 라벨. **해당 라벨이 레포에 없으면 `gh issue create`가 실패**하므로, 실패 시 `--label`을 빼고 한 번 더 시도합니다. (라벨을 미리 만들고 싶으면 `gh label create {라벨}`.)
- heredoc 토큰: `EOF` 대신 `GH_BODY_END` 같은 충돌 가능성 낮은 토큰 사용 (사용자 입력에 `EOF`가 섞일 수 있음).
- 단일 따옴표 heredoc (`<<'GH_BODY_END'`) 필수 — 변수/명령 치환 차단.

생성/조회 후 이슈 **번호와 URL**을 확보하고, plan.md의 메타 표 `GitHub Issue` 항목을 `#{번호} — {URL}` 로 갱신합니다.

---

### Stage 3: 브랜치 생성 및 체크아웃

**브랜치명 규칙:** `{prefix}/{이슈번호}-{기능명}`

> 이슈 단계를 건너뛴 경우(gh 미설치 등)에는 이슈 번호 없이 `{prefix}/{기능명}` 으로 생성합니다.

prefix 매핑:

| Stage 1 Type | 브랜치 prefix | base 브랜치          |
| ------------ | ------------- | -------------------- |
| Feat         | `feature/`    | 현재 브랜치 또는 main |
| Fix          | `fix/`        | 현재 브랜치 또는 main |
| **Hotfix**   | `hotfix/`     | **main (강제)**      |
| Refactor     | `refactor/`   | 현재 브랜치 또는 main |
| Chore        | `chore/`      | 현재 브랜치 또는 main |
| Docs         | `docs/`       | 현재 브랜치 또는 main |

**Hotfix인 경우 — main에서 분기 (강제):**

```bash
git checkout main
git pull origin main
git checkout -b hotfix/{이슈번호}-{기능명}
```

**그 외 Type — 현재 브랜치에서 분기:**

```bash
git checkout -b {prefix}/{이슈번호}-{기능명}
```

생성 후 plan.md의 메타 표 `Branch` 항목을 갱신합니다.

---

### Stage 4: progress.md 생성

`docs/features/{기능명}/progress.md` 경로를 확인합니다.

#### 4-A. 신규 기능 (progress.md 없음)

아래 템플릿으로 신규 생성합니다.

```markdown
# {기능명} — 진행 상황

## 📌 현재 작업

- 이슈: #{이슈번호} ({Type})
- 브랜치: {prefix}/{이슈번호}-{기능명}
- 단계: Phase 1 시작
- 마지막 업데이트: {YYYY-MM-DD HH:MM}

---

## [Issue #{이슈번호}] {기능명}

**Type**: {Feat/Fix/...} | **시작**: {YYYY-MM-DD}

### ✅ 완료

- [x] 작업 환경 셋업 (/start 실행)

### 🚧 진행 중

- [ ] {plan.md In Scope 첫 항목}

### 📝 결정 로그

- [{YYYY-MM-DD HH:MM}] /start 실행, 작업 환경 셋업 완료

### 🐛 트러블슈팅

<!-- /note troubleshoot 으로 추가 -->

### ⏭️ 남은 작업

<!-- plan.md In Scope 미완 항목 자동 동기화 -->
```

#### 4-B. 기존 기능 후속 이슈 (progress.md 있음)

`plan.md`는 **건드리지 않습니다** (v1 정책).

`progress.md`는 다음과 같이 갱신합니다:

1. 상단 `## 📌 현재 작업` 블록을 새 이슈 정보로 갱신
2. **기존 이슈 섹션들 위에** 새 이슈 섹션을 삽입

---

### Stage 5: 완료 안내

```
✅ 개발 준비 완료!

📂 세션 문서:    docs/features/{기능명}/plan.md
                docs/features/{기능명}/progress.md
🔗 GitHub 이슈:  {이슈 URL}
🌿 브랜치:      {prefix}/{이슈번호}-{기능명} (체크아웃 완료)

이제 개발을 시작하세요!
커밋할 때 "커밋해줘"라고 하면 자동으로 처리됩니다.
```
