# 전체 플로우 실동작 연동 — 진행 상황

## 📌 현재 작업

- 이슈: #3 (Feat)
- 브랜치: feature/3-full-flow-integration
- 단계: Phase 1 시작
- 마지막 업데이트: 2026-07-28 00:00

---

## [Issue #3] 전체 플로우 실동작 연동

**Type**: Feat | **시작**: 2026-07-28

### ✅ 완료

- [x] 작업 환경 셋업 (/start 실행)
- [x] 로그인 → 대시보드 진입 플로우 실동작 연동 (인증 게이트 + 로그아웃)

### 🚧 진행 중

- [ ] 나머지 화면 플로우 실동작 점검 (관찰/알림장/사진/기록 등)

### 📝 결정 로그

- [2026-07-28 00:00] /start 실행, 작업 환경 셋업 완료
- [2026-07-28 00:00] 푸시 알림 연동은 범위에서 제외, 별도 이슈 #4로 분리
- [2026-07-28] 현행 진단: 타입체크·프로덕션 빌드 통과, 14개 라우트 전부 정적 프리렌더. 기록→알림장→발송, 사진, 관찰, 상담 등 핵심 플로우는 MSW 상태형 DB 위에서 이미 실동작. 유일한 표면적 지점은 로그인이었음(상태 미저장·가드 없음·로그아웃 없음).
- [2026-07-28] 로그인 실동작화 방향: 사용자 선택으로 "게이트+로그아웃" 채택. 클라이언트 세션(localStorage `childcare.auth`)로 게이팅 — 실서비스의 세션 쿠키 대체. 새로고침에도 유지, 미로그인 시 /login 리다이렉트.

### 🔧 이번 변경 파일

- `lib/store.tsx` — AppProvider에 auth 세션(auth/authReady/signIn/signOut) + localStorage 지속 추가
- `lib/api/index.ts` — `logout` seam(EP-002 `/auth/logout`) 추가
- `lib/queries/index.ts` — `useLogout` 훅(성공/실패 무관 QueryClient.clear)
- `components/AuthGate.tsx` — (신규) 세션 없으면 /login 리다이렉트, 하이드레이션 전 대기
- `app/(main)/layout.tsx` — Shell을 AuthGate로 감쌈
- `components/layout/Shell.tsx` — 사이드바 "로그인" 링크 → 로그아웃 버튼, 상단바에 로그인 교사명·역할 표시
- `app/(auth)/login/page.tsx` — 성공 시 signIn 후 `/`, 이미 로그인 시 `/`로 리다이렉트

### 🐛 트러블슈팅

<!-- /note troubleshoot 으로 추가 -->

### ⏭️ 남은 작업

- [ ] 관찰(observations) 기록 조회·추가 플로우 연동
- [ ] 알림장(notices)·일지(journal) 생성 플로우 연동
- [ ] 기록(records)·상담(consults)·평가(evaluations)·계획(plans) 화면 API 실연동
- [ ] 사진(photos)·체크리스트(checklist)·설정(settings) 플로우 연동
- [ ] 각 화면 로딩·에러·빈 상태 처리로 데모/테스트 시 끊김 없이 동작

---

### Commit — 2026-07-28

- Hash: `11daa36`
- Message: `Feat:#3 로그인 세션 지속·인증 게이트·로그아웃 추가`
- Issue: `#3`

**변경 요약**

- localStorage(`childcare.auth`) 기반 로그인 세션을 store에 추가, 새로고침 후 유지
- AuthGate로 (main) 셸 감싸 미로그인 리다이렉트 + 하이드레이션 전 대기 화면
- 로그아웃: 서버 세션 종료 시도 후 성공 여부와 무관하게 클라 세션·쿼리 캐시 clear

**결정 로그**

- 게이팅은 서버 세션 쿠키 대신 클라이언트 상태로 처리(목 데모 전제)
- 로그아웃은 `onSettled`에서 항상 세션 정리 — 데모에서 루프가 항상 닫히도록

**다음 작업**

- 나머지 화면 플로우(관찰/알림장/사진/기록 등) 실동작 점검
