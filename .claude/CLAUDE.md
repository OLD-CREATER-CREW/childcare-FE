# CLAUDE.md

이 파일은 프로젝트에서 Claude Code가 항상 먼저 읽는 팀 표준 진입점입니다.

## 사용 전 설정

새 프로젝트에 `.claude`를 적용한 뒤, 먼저 아래 파일을 프로젝트 상황에 맞게 채웁니다.

1. `.claude/project.config.md`
2. `.claude/CLAUDE.md`의 프로젝트 개요
3. 필요한 기술 스택 rule

`project.config.md`가 없다면 `.claude/project.config.example.md`를 복사해서 만듭니다.

## 프로젝트 개요

- 프로젝트명: `{PROJECT_NAME}`
- 설명: `{PROJECT_DESCRIPTION}`
- 주요 스택: `{PROJECT_STACK}`
- 기본 브랜치: `{BASE_BRANCH}` (예: `main`)
- GitHub 레포: `{GITHUB_REPO}` (예: `owner/repo`)
- 기본 리뷰어: `{DEFAULT_REVIEWER}` (선택)

## 기본 작업 원칙

- 의미 있는 변경은 Plan → Code → Review 순서로 진행합니다.
- `/start`를 사용하면 plan.md 합의 후 GitHub Issue, branch, progress.md를 생성합니다.
- 개발 중 결정은 `progress.md` 또는 `/note`로 남깁니다.
- 커밋은 `/commit`, PR은 `/pr`, 리뷰는 `/review` 흐름을 우선 사용합니다.
- 프로젝트별 예외는 `.claude/project.config.md`에 명시하고, skill 본문을 직접 고치기 전에 팀 표준 반영 여부를 검토합니다.

## 필수 사전 준비

- `gh` CLI: GitHub Issue / PR 생성, PR 코멘트 등록에 필요
- Figma MCP: 디자인 분석이 필요한 UI 작업에 필요
- Node.js/npm: hooks와 type-check 실행에 필요

## 기술 스택별 rule

이 프로젝트는 **Next.js 14 (App Router) · React 18 · TypeScript**입니다.
팀 표준에 있던 Vue·AngularJS rule은 해당 사항이 없어 제거했습니다.

- 프로젝트 고유 규칙: `.claude/rules/project.md`
- 디자인 시스템 / 퍼블리싱: `.claude/rules/fe/publishing-design-system.md`

## 진행 문서

진행 중 기능의 컨텍스트는 `docs/features/{feature}/plan.md`와 `docs/features/{feature}/progress.md`에 누적합니다.

세션을 이어갈 때는 먼저 해당 feature의 `progress.md`를 확인합니다.
