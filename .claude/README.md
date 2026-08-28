# 팀 표준 .claude

Claude Code 팀 표준 workflow, rules, skills, hooks를 모아둔 폴더입니다.

## 빠른 적용

1. 이 `.claude` 폴더를 프로젝트 루트에 복사합니다.
2. `.claude/project.config.example.md`를 `.claude/project.config.md`로 복사합니다.
3. Jira, GitLab, Confluence, 기본 브랜치, reviewer 값을 채웁니다.
4. 프로젝트 스택에 맞는 rule을 확인합니다.
5. `glab auth status`로 GitLab CLI 인증 상태를 확인합니다.

## 필수 도구

| 도구 | 필요한 흐름 |
| --- | --- |
| Atlassian MCP | `/start` Jira 생성/수정, `/tech-doc` Confluence 발행 |
| Figma MCP | `/start` UI 기능 디자인 분석 |
| glab CLI | `/start` GitLab Issue 생성, `/mr` MR 생성, `/review` MR note 등록 |
| npm | hooks, type-check, audit |

## 폴더 구조

```text
.claude/
├── CLAUDE.md
├── README.md
├── project.config.example.md
├── settings.json
├── settings.local.example.json
├── hooks/
├── rules/
└── skills/
```

## 주요 skills

| Skill | 역할 |
| --- | --- |
| `/start` | plan.md 합의 → Jira/GitLab Issue → branch → progress.md |
| `/commit` | 이슈 번호/Jira 키 기반 커밋 메시지 생성, type-check 후 커밋 |
| `/mr` | GitLab MR 생성 후 `/review` 흐름 연결 |
| `/review` | 시니어/보안/아키텍트/QA 4 페르소나 병렬 리뷰 |
| `/secure-review` | 보안 전담 리뷰 |
| `/note` | 개발 히스토리 빠른 기록 |
| `/tech-doc` | 히스토리와 코드 분석 기반 Confluence 기술 문서 초안 |
| `/organize-imports` | import 정리 |

## glab CLI가 필요한 지점

- `/start`: GitLab Issue 자동 생성
- `/commit`: GitLab Issue description에서 Jira 키 추출
- `/mr`: MR 자동 생성
- `/review`: MR note 자동 등록

미설치 시 skill은 수동 등록이나 로컬 문서 저장 fallback을 사용합니다.

## 프로젝트 유형별 rule

- 프로젝트 고유 규칙: `rules/project.md`
- 디자인 시스템 / 퍼블리싱: `rules/fe/publishing-design-system.md`

Vue·AngularJS rule은 이 프로젝트(Next.js·React·TS)에 맞지 않아 제거했습니다.

## 주의

- `settings.local.json`은 개인 로컬 설정이므로 공유하지 않습니다.
- 프로젝트별 특수 hook은 팀 표준에 바로 넣지 말고 `project.config.md`에 필요성을 먼저 기록합니다.
- Jira/GitLab/Confluence 고정값은 skill 본문에 직접 박지 않고 프로젝트 설정으로 관리합니다.
