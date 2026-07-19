# 팀 표준 .claude 구성 계획

대상 경로: `C:\Users\insu12021202\Desktop\projects\2Q-claude\.claude`

참고 기준:

- 운영 계획: https://incross-platform.atlassian.net/wiki/spaces/UX/pages/239697958
- start / plan / progress 변경 노트: https://incross-platform.atlassian.net/wiki/spaces/UX/pages/266502148
- 기준 샘플: `C:\Users\insu12021202\Desktop\projects\vibe-catch-front\.claude`

---

## 1. 현재 샘플 구성 요약

`vibe-catch-front/.claude`는 이번 Q2 운영에서 목표로 했던 핵심 흐름을 대부분 포함하고 있다.

```text
.claude/
├── CLAUDE.md
├── README.md
├── settings.json
├── hooks/
│   ├── block-mock-write.js
│   ├── check-commit-typecheck.js
│   └── notify-sensitive-edit.js
├── rules/
│   ├── api-guide-reference.md
│   ├── fe-convention.md
│   └── team.md
└── skills/
    ├── commit/
    ├── mr/
    ├── note/
    ├── organize-imports/
    ├── review/
    ├── secure-review/
    ├── start/
    └── tech-doc/
```

특히 `.claude/commands/`가 아니라 `.claude/skills/`로 통일되어 있고, `/start`, `/mr`, `/review`, `/commit`, `/note`가 서로 이어지는 구조도 이미 잡혀 있다.

---

## 2. 목표 기능 포함 여부

| 목표 기능 | 샘플 포함 여부 | 판단 |
| --- | --- | --- |
| `.claude/skills/` 기반 표준화 | 포함 | 공식 skills 구조로 정리되어 있음 |
| `/start` Plan-first 흐름 | 포함 | plan.md 합의 후 Jira/GitLab/브랜치 생성 흐름 포함 |
| `plan.md` / `progress.md` 관리 | 포함 | 템플릿과 세션 append 정책 포함 |
| Jira 티켓 생성 / 상태 전이 | 포함 | Atlassian MCP 기반 생성/전이 흐름 포함 |
| GitLab Issue 생성 | 포함 | `glab issue create` 기반 흐름 포함 |
| Jira ↔ GitLab 링크 연결 | 포함 | Jira description에 GitLab 이슈 링크 추가 흐름 포함 |
| 브랜치 생성 / 전환 | 포함 | `origin/dev` 기반 브랜치 생성 포함 |
| `/commit` 커밋 메시지 생성 | 포함 | 이슈 번호, Jira 키, Refs/Closes 구분 포함 |
| `/commit` 전 type-check 게이트 | 포함 | hook과 skill 양쪽에 포함 |
| `/mr` GitLab MR 생성 | 포함 | `glab mr create` 기반 흐름 포함 |
| `/mr` 이후 `/review` 연결 | 포함 | MR 생성 후 review 실행 질문 및 `/review origin/<target>...HEAD` 전달 포함 |
| `/review` 페르소나 리뷰 | 포함 | 시니어/보안/아키텍트/QA 4 페르소나 병렬 리뷰 구조 포함 |
| `/secure-review` 보안 리뷰 | 포함 | fork context 기반 스탠드얼론 보안 리뷰 포함 |
| `/note` 히스토리 기록 | 포함 | `tech.md`, `troubleshoot.md`, `ux.md` 기록 흐름 포함 |
| `/tech-doc` Confluence 기술 문서화 | 포함 | 로컬 히스토리와 코드 분석 후 Confluence 발행 흐름 포함 |
| MCP 설정 | 부분 포함 | Atlassian, Figma MCP는 포함. 프로젝트별 추가 MCP는 확장 필요 |
| hooks 운영 | 포함 | 민감 파일 경고, mock write 차단, commit type-check 포함 |
| 레거시 프로젝트 적용 기준 | 미흡 | Vue3/FSD 기준이 강해서 Vue2/AngularJS/Node 레거시 분기 필요 |
| 릴리즈 모니터링 | 미포함 | `.claude` 내부 기능보다 별도 운영 문서/자동화 영역으로 분리 권장 |

---

## 3. 팀 표준으로 옮기기 전에 손봐야 할 지점

### 3.1 프로젝트 고정값 제거

샘플에는 `vibe-catch-front` 전용 값이 들어 있다. 팀 표준에서는 그대로 복사하지 않고 변수화한다.

| 현재 고정값 | 표준화 방향 |
| --- | --- |
| `VibeCatch` 프로젝트 설명 | `{PROJECT_NAME}`, `{PROJECT_DESCRIPTION}` |
| Jira 프로젝트 `VC` | `{JIRA_PROJECT_KEY}` |
| Jira 이슈 타입 `프론트`, id `10652` | 프로젝트별 설정 섹션으로 이동 |
| GitLab assignee `insu12021202` | `git config user.email` 기반 조회 또는 `{GITLAB_USERNAME}` |
| Reviewer `ksw1222` | `{DEFAULT_REVIEWER}` |
| Confluence Space `VC` / page ID `199819267` | `{CONFLUENCE_SPACE}`, `{TECH_DOC_PARENT_PAGE_ID}` |
| base branch `dev` | 기본값은 `dev`, 프로젝트별 override 허용 |
| BE API 가이드 경로 `vibe-backend-web-api/...` | 프로젝트별 API 문서 위치로 분리 |

### 3.2 FE 컨벤션 분리

현재 `fe-convention.md`는 Vue3 + TypeScript + Vite + FSD 전제에 강하게 맞춰져 있다.

팀 표준에는 다음처럼 분리하는 편이 좋다.

```text
rules/
├── team.md
├── project.md
├── fe/
│   ├── vue3-typescript.md
│   ├── vue2-javascript.md
│   ├── angularjs-legacy.md
│   └── publishing-design-system.md
└── api-guide-reference.md
```

`team.md`는 모든 프로젝트 공통 원칙만 담고, 기술 스택별 규칙은 필요한 프로젝트에서 선택 적용한다.

### 3.3 settings.local.json 제외

`settings.local.json`은 개인 로컬 권한이므로 팀 표준에 포함하지 않는다.

대신 아래처럼 예시 파일을 둔다.

```text
.claude/settings.local.example.json
```

### 3.4 glab CLI 선행 조건 명시

운영 계획과 샘플 모두 `/start`의 GitLab Issue 생성, `/mr`의 GitLab MR 생성이 `glab`에 의존한다.

팀 표준 README에는 아래를 명시한다.

- `/start`에서 GitLab Issue 자동 생성 사용 시 `glab` 설치 필요
- `/mr`에서 GitLab MR 자동 생성 및 MR note 등록 시 `glab` 설치 필요
- `glab auth login` 또는 사내 GitLab 인증 상태 확인 필요
- 미설치 시 파일 저장 또는 수동 등록 fallback 사용

### 3.5 start skill 최신 문서 반영

`start` 샘플은 plan-first 구조가 잘 반영되어 있으나, 변경 노트 기준으로 아래를 더 명확히 다듬는다.

- 자유 입력은 일반 대화로 받고, 선택지는 `AskUserQuestion`을 사용한다는 원칙을 skill 본문에 명시
- 선택지에 `직접 입력하기`, `Other`를 직접 넣지 않는다
- Type 기본 선택지는 `Feat`, `Fix`, `Hotfix`, `Refactor` 중심으로 노출한다
- `Chore`, `Docs`는 Other 또는 추가 입력으로 받는다
- In Scope / Out of Scope는 자유 입력 후 체크박스로 정규화한다
- 각 질문에는 “왜 묻는지”와 예시를 함께 제공한다

현재 샘플은 `Hotfix`가 Type 표에 없고 `chore`가 기본값으로 포함되어 있어, 최신 운영안 기준으로 조정이 필요하다.

---

## 4. 권장 표준 구조

`2Q-claude/.claude`에는 아래 구조로 구성한다.

```text
.claude/
├── CLAUDE.md
├── README.md
├── settings.json
├── settings.local.example.json
├── project.config.example.md
├── hooks/
│   ├── check-commit-typecheck.js
│   └── notify-sensitive-edit.js
├── rules/
│   ├── team.md
│   ├── project.md
│   ├── api-guide-reference.md
│   └── fe/
│       ├── vue3-typescript.md
│       ├── vue2-javascript.md
│       ├── angularjs-legacy.md
│       └── publishing-design-system.md
└── skills/
    ├── start/
    │   ├── SKILL.md
    │   └── templates/
    │       ├── plan-ui.md
    │       ├── plan-slim.md
    │       └── progress.md
    ├── commit/
    │   ├── SKILL.md
    │   └── scripts/
    │       └── get-issue-number.sh
    ├── mr/
    │   └── SKILL.md
    ├── review/
    │   ├── SKILL.md
    │   ├── personas.md
    │   └── report-template.md
    ├── secure-review/
    │   └── SKILL.md
    ├── note/
    │   └── SKILL.md
    ├── tech-doc/
    │   └── SKILL.md
    └── organize-imports/
        └── SKILL.md
```

`block-mock-write.js`는 `vibe-catch-front` 전용 성격이 강하므로 기본 표준에서는 제외하고, 프로젝트별 hook 예시로 분리한다.

---

## 5. 구성 단계

### Step 1. 기준 파일 복사

`vibe-catch-front/.claude`에서 아래 파일을 우선 복사한다.

- `skills/start`
- `skills/commit`
- `skills/mr`
- `skills/review`
- `skills/secure-review`
- `skills/note`
- `skills/tech-doc`
- `skills/organize-imports`
- `hooks/check-commit-typecheck.js`
- `hooks/notify-sensitive-edit.js`
- `settings.json`
- `README.md`

복사 제외:

- `settings.local.json`
- `hooks/block-mock-write.js`
- `rules/fe-convention.md` 원본 그대로
- `rules/api-guide-reference.md` 원본 그대로
- `CLAUDE.md` 원본 그대로

### Step 2. 공통화 리팩터링

복사한 파일에서 프로젝트 고정값을 제거한다.

- `VC`, `VibeCatch`, `vibe-catch-front`
- `insu12021202`
- `ksw1222`
- `vibe-backend-web-api`
- Confluence space/page ID
- `origin/dev` 고정 여부

이 값들은 `project.config.example.md`와 각 skill의 “프로젝트별 설정” 섹션으로 이동한다.

### Step 3. start 최신 운영안 반영

`start/SKILL.md`를 변경 노트 기준으로 업데이트한다.

- `/start`는 plan.md 먼저 생성
- Jira, GitLab, branch, progress는 plan 승인 후 진행
- 각 단계 산출물을 `plan.md` 추적 정보에 즉시 백필
- 진행 중 실패해도 재실행 시 중복 생성하지 않는 멱등성 유지
- GitLab Issue 생성에는 `glab` 필요 조건 표시
- 질문 방식 원칙 반영

### Step 4. 프로젝트 유형별 rule 분리

`fe-convention.md`를 팀 표준으로 바로 쓰지 않고 아래 문서로 나눈다.

- `vue3-typescript.md`: 신규 Vue3/TypeScript 프로젝트 기준
- `vue2-javascript.md`: 레거시 Vue2/JavaScript 프로젝트 기준
- `angularjs-legacy.md`: Node/AngularJS 등 특수 레거시 기준
- `publishing-design-system.md`: 디자인 시스템/퍼블리싱 작업 기준

각 프로젝트는 필요한 rule만 `CLAUDE.md`에서 참조한다.

### Step 5. README를 팀 표준 가이드로 재작성

README는 팀원이 가장 먼저 보는 문서로 둔다.

포함할 내용:

- `.claude` 폴더 목적
- 설치/복사 방법
- 프로젝트별 설정값 채우는 방법
- glab CLI 설치 필요 지점
- MCP 설정 방법
- skills 사용 흐름
- hooks 동작 방식
- 파일럿 중 확인할 체크포인트

### Step 6. 파일럿 검증

신규 프로젝트 1개, 레거시 프로젝트 1개에 적용해 아래를 확인한다.

- `/start`가 plan.md를 먼저 만들고 외부 시스템 생성 전 승인을 받는지
- `/start`가 Jira/GitLab Issue/branch/progress를 중복 없이 생성하는지
- `/commit`이 이슈 번호와 Jira 키를 잘 연결하는지
- `/mr`이 glab으로 MR을 만들 수 있는지
- `/mr` 이후 `/review` 흐름이 자연스럽게 이어지는지
- `progress.md`에 의사결정/다음 작업이 남는지
- 팀원이 프로젝트별 설정값을 혼동하지 않는지

---

## 6. 우선순위

### 1순위

- `start`
- `commit`
- `mr`
- `review`
- `note`
- `settings.json`
- `README.md`

파일럿 운영에 직접 필요한 핵심 흐름이다.

### 2순위

- `secure-review`
- `tech-doc`
- `organize-imports`
- hooks 정리
- 프로젝트 유형별 rule 분리

파일럿 품질과 확장성을 높이는 영역이다.

### 3순위

- 레거시 프로젝트별 세부 rule 고도화
- 릴리즈 모니터링 문서/자동화 연결
- Confluence 발행 위치 표준화
- 프로젝트별 체크리스트 템플릿

운영 결과를 보고 다음 버전에서 보강한다.

---

## 7. 결론

`vibe-catch-front/.claude`는 팀 표준의 출발점으로 충분히 좋다.

다만 그대로 복사하면 특정 프로젝트 전용 자동화가 팀 표준처럼 보일 수 있으므로, 이번 `2Q-claude/.claude`에서는 다음 원칙으로 정리한다.

1. workflow skill은 최대한 재사용한다.
2. 프로젝트 고정값은 모두 설정값으로 분리한다.
3. Vue3/FSD 전용 규칙은 기술 스택별 rule로 분리한다.
4. `glab`, MCP, Jira/GitLab/Confluence 연결 조건은 README에 선명하게 둔다.
5. 파일럿에서 검증할 항목을 먼저 정하고, 검증 결과로 v2.0 표준을 확정한다.
