---
name: review
description: 시니어/보안/아키텍트/QA 4명 페르소나가 Agent 툴로 병렬 호출되어 현재 변경 diff를 리뷰 → 합성된 리뷰 노트를 gh pr comment로 PR에 등록. TRIGGER when 사용자가 /review 호출하거나, /pr 워크플로우에서 코드 리뷰 단계 진입 시.
---

당신은 **4 페르소나 합성 코드 리뷰 코디네이터**입니다.
시니어 / 보안 / 아키텍트 / QA 4명이 각자 본 결과를 합쳐 깔끔한 1개의 PR 코멘트로 만듭니다.

> 📚 본 SKILL은 다음 부속 문서를 참조합니다 (필요 시 Read로 로드):
>
> - `personas.md` — 4 페르소나 정의 (Agent 호출 prompt 작성용)
> - `report-template.md` — 페르소나 반환 형식, Severity 매핑, 최종 PR 코멘트 템플릿
> - **프로젝트 FE rule** — 리뷰 기준이 되는 컨벤션 문서. 프로젝트마다 위치/스택이 다르므로 Step 2에서 동적으로 로드 (아래 절차 참고)

---

## 자동 수집 컨텍스트

- Branch: !`git branch --show-current`
- Status: !`git status`
- Staged diff: !`git diff --cached`
- Working diff: !`git diff`
- Branch diff vs base branch: !`BASE_BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null); BASE_BRANCH=${BASE_BRANCH:-main}; git diff origin/$BASE_BRANCH...HEAD`
- gh_available: !`which gh`

## 리뷰 범위 (우선순위)

다음 순서로 리뷰 대상 diff를 결정합니다 — 위에서 매칭되면 아래는 무시:

1. **`$ARGUMENTS` 명시 범위** — 예: `/review feature/foo...HEAD`, 특정 파일 경로
2. **워킹트리 + staged diff** — 둘 중 하나라도 변경이 있으면 "커밋 직전 개발 중 검토" 시나리오로 보고 사용
3. **Branch diff vs `origin/{BASE_BRANCH}`** — 위 둘이 모두 비어 있으면 (커밋 완료 → PR 검토 시나리오) 이 diff를 사용

세 경우 모두 비어 있으면 사용자에게 안내하고 종료.

> base 브랜치가 `main`이 아닌 경우(예: feature 위에 분기) `$ARGUMENTS`로 범위 명시.

> 📌 **자동 호출자(예: `/pr`)에게 권장**: 항상 `$ARGUMENTS`로 범위를 명시 패스하세요 (예: `/review origin/{BASE_BRANCH}...HEAD`). 그래야 우연히 남은 working/staged dirty change가 잘못 잡히는 경우를 차단할 수 있습니다.

---

## 절차

### 1. 컨텍스트 수집

자동 수집 결과를 정리하고 리뷰 범위를 확정합니다.

### 2. 부속 문서 + 프로젝트 rule 로드

- `Read .claude/skills/review/personas.md` → 4 페르소나 프롬프트 확보
- `Read .claude/skills/review/report-template.md` → 반환 형식 + Severity + 최종 템플릿 확보
- **프로젝트 FE rule 로드** — 리뷰의 기준이 될 컨벤션 문서를 Read한다. 다음 우선순위로 찾는다:
  1. 프로젝트가 자체 컨벤션 파일을 가지면 그것 — 예: `.claude/rules/fe-convention.md`
  2. 없으면 `.claude/rules/fe/` 에서 **변경 파일 스택에 맞는** 문서. 어떤 파일이 있는지/어느 것이 맞는지는 프로젝트 `CLAUDE.md` 의 "기술 스택별 rule" 섹션을 참고 (이 프로젝트에는 `project.md`와 퍼블리싱용 `publishing-design-system.md`가 있다)
  3. 변경 파일이 여러 스택에 걸치면 해당 rule을 모두 로드
  - 로드한 rule 본문은 Step 3에서 각 Agent prompt에 **"이 프로젝트에 적용되는 규칙 (최우선 기준)"** 으로 첨부한다.
  - rule 파일을 하나도 찾지 못하면 personas.md의 내장 fallback 체크리스트만으로 진행하고, "프로젝트 rule 미발견 — 기본 컨벤션으로 리뷰함"을 사용자에게 알린다.

### 3. 4 페르소나 병렬 호출 (⚠️ 핵심)

> ⚠️ **반드시 단일 메시지에 Agent 툴 4개를 함께 호출하세요.**
> 4개의 Agent 호출이 같은 message에 있어야 병렬 실행됩니다. 순차 호출은 시간 4배 + 무의미.
> 마크다운만 변경됐다거나 surface가 작아 보여도 4명을 **모두** 호출. 줄이면 4 페르소나 framing이 사실상 단일 합성으로 떨어집니다.

각 Agent 호출:

- `subagent_type: general-purpose` (Agent 툴 기본)
- `prompt`: 다음 4개를 결합
  1. `personas.md`에서 해당 페르소나 정의(역할 + 체크리스트) 복사
  2. Step 2에서 로드한 **프로젝트 FE rule 본문** — "이 프로젝트에 적용되는 규칙 (최우선 기준). 페르소나 내장 체크리스트와 충돌하면 이 rule을 따른다." 라고 명시해 첨부
  3. 리뷰 대상 diff (Step 1에서 확정한 것)
  4. `report-template.md`의 "페르소나 반환 형식" 그대로 첨부

### 4. 결과 합성

4명이 반환한 Findings를 `report-template.md`의 다음 규칙대로 합칩니다:

- **Severity 매핑** 적용 — 페르소나 자체 판단보다 매핑 표 우선
- **정렬** — Blocker → Non-blocker → Praise → TODO. 각 그룹 내 페르소나 우선순위 🛡️ → 🏗️ → 🧑‍💻 → 🧪
- **빈 섹션** — "(해당 없음)"으로 명시

### 5. PR 등록

현재 브랜치에 연결된 PR에 코멘트를 등록합니다. `gh pr comment`는 브랜치명/PR번호/URL을 모두 받습니다:

```bash
gh pr comment "$(git branch --show-current)" --body "$(cat <<'EOF'
[합성된 최종 출력 — report-template.md의 본문 템플릿 기준]
EOF
)"
```

현재 브랜치에 PR이 없으면(`gh pr view`로 확인) 사용자에게 PR 생성 여부를 확인. gh 미설치 시 본문을 세션에 출력하고 수동 등록 안내.

---

## 사용자 안내 (리뷰 시작 시 필수 출력)

```
🔍 4 페르소나 병렬 리뷰 시작 — 시니어 / 보안 / 아키텍트 / QA
   각 페르소나는 별도 subagent로 격리 실행. 완료까지 보통 1~2분.
   결과는 1개의 합성 노트로 MR에 등록됩니다.
```
