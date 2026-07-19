# {{slug}} Progress

세션별 누적 로그. 매 세션 시작 시 이 파일부터 확인하세요.

---

## Session 1 — {{YYYY-MM-DD}}

**완료**

- 계획 합의 → [plan.md](./plan.md)
- GitHub Issue `{{#N}}` 생성 — {{URL}}
- 브랜치 `{{prefix}}/{{N}}-{{slug}}` 생성 및 체크아웃 (from `origin/{{BASE_BRANCH}}`)

**다음 작업**

- {{plan.md "접근 방식"의 첫 단계}}

**남은 미해결 질문**

- {{plan.md "위험/가정/미해결 질문" 중 ❓ 항목 복사}}

---

## Commit Log

커밋 단위로 구현 요약과 결정 로그를 누적합니다. `/commit` 완료 후 자동 append됩니다.

### Commit — {{YYYY-MM-DD HH:mm}}

- Hash: `{{commit hash}}`
- Message: `{{commit message}}`
- Issue: `{{#N}}`

**변경 요약**

- {{이번 커밋에서 바뀐 핵심 내용}}

**결정 로그**

- {{이번 커밋에서 확정된 구현 방향, 예외 처리, 구조 선택}}

**다음 작업**

- {{이어질 작업}}
