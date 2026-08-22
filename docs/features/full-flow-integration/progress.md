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

---

### 명세 r11 인증 반영 — 2026-08-01

**배경**

백엔드에 인증이 실제로 붙으면서 명세서가 r5/r6 → r11로 개정됐다. 새 명세 7종을
`docs/spec/`에 반영하고, 프론트를 그 계약에 맞췄다.

- r7: 세션 쿠키 인증 구현 · 아동 인적사항 관리(EP-039~042) · 역할 권한 규약(1.2.1)
- r8: 계정 관리(EP-043~049) · 잠금 방지 규약(1.2.2)
- r9: **JWT 전환** — 액세스 JWT(15분) + 리프레시 토큰(12시간), EP-050 갱신
- r10: 원장 회원가입(EP-051) · SCR-018 · 프론트엔드 연동 가이드(1.2.3)
- r11: **쿠키 → `Authorization: Bearer` 전환.** 토큰을 응답 본문으로 준다

**변경 파일**

- `docs/spec/final_*.md` — 7종 전부 신규본으로 교체
- `lib/api/client.ts` — `tokenStore`(액세스=메모리·리프레시=localStorage), Bearer 헤더
  자동 부착, 401 → EP-050 갱신 → 원 요청 **1회** 재시도 래퍼(진행 중 갱신 프라미스 공유)
- `lib/api/index.ts` — `login`(EP-001) 실 호출, `signup`(EP-051), `restoreSession`(EP-050),
  `fetchMe`(EP-003), `logout`(EP-002, 본문에 refresh_token). EP-004의 `gender`(male/female)·
  `status`(enrolled/withdrawn) 매핑 추가
- `lib/types/index.ts` — `LoginResponse` 제거, `AuthUser`·`SignupInput`·`ROLE_LABEL` 신설
- `lib/store.tsx` — `childcare.auth` localStorage 세션 폐기. 기동 시 EP-050으로 세션 복구,
  갱신 실패(만료) 시 세션 비우기 핸들러 등록
- `app/(auth)/signup/page.tsx` — **SCR-018 신설**(기관 + 첫 원장 계정)
- `app/(auth)/login/page.tsx` — 실 로그인 + 오류 표시 + 「어린이집 등록하기」 링크
- `components/layout/Shell.tsx` — 역할 한글 표기(ROLE_LABEL), 상단바 기관명을 `center_name`으로
- `mocks/handlers.ts` — 인증 목을 토큰 응답 형태로 교체 + refresh·signup 핸들러 추가
- `.env.example` — 무인증 노출 경고 삭제, 토큰 인증 안내로 교체

**결정 로그**

- 토큰 보관은 명세 1.2.3 ② 규약 그대로 — 액세스는 메모리, 리프레시만 `localStorage`.
  액세스를 디스크에 남기지 않는 대신 새로고침마다 EP-050을 한 번 거친다
- 재시도는 1회, 갱신은 프라미스 공유로 1회 — 무한 루프와 중복 갱신 방지(명세 1.2.3 ④)
- 로그인·가입·갱신은 `skipAuth`로 래퍼를 우회 — 인증 배관 자체가 자기 자신을 재귀 호출하지 않도록
- 네트워크 오류(ApiError 아님)는 세션 만료로 보지 않고 토큰을 남긴다 — 지하철·터널에서
  끊겼다고 로그아웃되면 안 된다
- `signOut`은 서버 응답과 무관하게 토큰을 지운다 — 남기면 최대 15분간 유효한 액세스 토큰이 남는다

**검증**

- `tsc --noEmit` · `next lint` · `next build` 통과(17 라우트, /signup 포함)
- 실 서버 계약 확인: `/health` 200 · 로그인 실패 시 `401 LOGIN_FAILED` ·
  토큰 없는 `/api/children` `401 UNAUTHORIZED` · `/api/auth/refresh` `401` ·
  `/api/auth/signup` 빈 본문 `400 VALIDATION_ERROR` — 전부 명세와 일치
- 실 계정 로그인 왕복은 미검증(데모 계정 비밀번호 `DEMO_PASSWORD` 미보유)

**남은 작업 → 아래 「r7~r9 신규 기능 반영」에서 전부 처리함**

- [x] FN-021 아동 인적사항 관리 화면(SCR-016, EP-039~042)
- [x] FN-022 계정 관리 화면(SCR-017, EP-043~048)
- [x] EP-049 본인 비밀번호 변경
- [x] EP-028 지표 응답 확장(`by_user`·`unattributed_count`)
- [x] 역할 기반 UI 분기(1.2.1)

---

### 명세 r7~r9 신규 기능 반영 — 2026-08-01

인증 외에 r7~~r9로 들어온 기능(FN-021 아동 인적사항 관리, FN-022 계정 관리,
FN-014 확정자별 지표)을 전부 화면까지 붙였다. 이로써 명세 r11의 EP-001~~051 중
프론트가 쓰는 경로는 모두 연결됐다.

**변경 파일**

- `lib/api/client.ts` — `patch`·`del` 메서드 추가(EP-041·046 부분 수정, EP-042·047 소프트 삭제)
- `lib/api/spec.ts` — `SpecChildDetail`·`SpecUserAccount`·`SpecPasswordChange` 신설,
  `SpecMetrics`에 `by_user`·`unattributed_count` 추가, `SpecChild`에 `status` 추가
- `lib/api/index.ts` — EP-039~~042(아동), EP-043~~048(계정), EP-049(본인 비밀번호),
  EP-028 `by_user` 매핑. `Child`에 `className`·`status` 매핑 추가
- `lib/types/index.ts` — `ChildProfile`·`ChildProfileInput`·`UserAccount`·
  `UserAccountInput`·`UserAccountPatch`·`PasswordChange*`, `MetricsSummary.byUser`
- `lib/queries/index.ts` — 아동 명부·인적사항·계정·비밀번호 훅 일습
- `app/(main)/children/page.tsx` — **SCR-016 신설**(명단·반 필터·퇴소 보기·인적사항 패널)
- `app/(main)/users/page.tsx` — **SCR-017 신설**(계정 목록·생성·수정·잠금·비밀번호 재설정)
- `components/PasswordChangeDialog.tsx` — **EP-049 신설**(공통 상단바 「비밀번호 변경」)
- `app/(main)/dashboard/page.tsx` — 확정자별 지표 표 + 귀속 불가 건수 안내
- `components/layout/Shell.tsx` — 「원 관리」 그룹(아동·계정) 추가, `directorOnly` 메뉴 분기
- `mocks/db.ts`·`mocks/handlers.ts` — 인적사항·계정 상태와 EP-039~049 목 구현

**결정 로그**

- 아동 목록(EP-004)과 인적사항(EP-040)을 명세대로 갈라 두었다 — 목록은 화면 진입마다
  부르는 경로라 가볍게 유지하고, 입소일·특이사항은 행을 눌렀을 때만 가져온다
- 부분 수정은 "키 없음 = 유지, null = 비우기"를 seam에서 지킨다(명세 EP-041).
  폼의 빈 문자열은 "비우기"로 보아 null로 바꿔 보낸다 — 빈 문자열을 날짜로 보내면
  `VALIDATION_ERROR`가 난다
- 역할 분기는 **숨김 + 서버 403** 이중으로 둔다(명세 1.2.1). 교사가 주소로 직접
  `/users`에 들어와도 화면에서 같은 문구로 막는다
- 퇴소는 소프트 삭제이므로 되돌리기(EP-041 `status=enrolled`) 버튼을 함께 뒀다 —
  퇴소 처리는 원장 손에서 한 번의 오조작으로 명단이 바뀌는 동작이다
- EP-049는 응답의 새 액세스 토큰으로 반드시 교체한다(seam이 처리) — 교체하지 않으면
  `token_version`이 올라가 다음 요청부터 401이다
- 목은 토큰을 검증하지 않아 역할을 모르므로 403(원장 전용) 판정은 흉내 내지 않았다.
  잠금 방지(SELF_LOCKOUT·LAST_DIRECTOR·ALREADY_INACTIVE)와 중복(DUPLICATE_*)은 구현했다

**검증**

- `tsc --noEmit` · `next lint` · `next build` 통과(19 라우트 — `/children`·`/users` 추가)
- 실 서버에 신규 경로가 존재함을 확인(토큰 없이 호출 시 401, 없는 경로는 404):
  `/api/children/{id}` · `/api/users` · `/api/users/{id}` · `/api/users/{id}/password` ·
  `/api/auth/password` · `POST /api/children` · `/api/metrics/summary`
- 실 계정으로의 왕복(등록·퇴소·계정 생성)은 미검증 — 로그인 자격 증명이 없다

---

### Commit — 2026-08-01

- Hash: `fce673a`
- Message: `Feat:#3 명세 r11 인증 전환과 신규 EP 계약 계층 반영`
- Issue: `#3`

**변경 요약**

- 인증을 세션 쿠키 → 액세스 JWT(15분) + 리프레시 토큰(12시간) Bearer 방식으로 전환
- `tokenStore`(액세스=메모리·리프레시=localStorage), 401 자동 갱신 래퍼, EP-001·002·003·050·051 실 호출
- SCR-018 원장 회원가입 화면 신설, 기동 시 리프레시 토큰으로 세션 복구
- EP-039~049·EP-028 확장을 계약(`spec.ts`)·타입·seam·목에 먼저 반영(화면은 다음 커밋)

**결정 로그**

- 토큰 보관 위치는 명세 1.2.3 ② 규약 그대로 따랐다 — 액세스를 디스크에 남기지 않는 대신
  새로고침마다 EP-050을 한 번 거친다
- 재시도 1회·갱신 1회(프라미스 공유)로 무한 루프와 중복 갱신을 막는다
- 네트워크 오류는 세션 만료로 보지 않고 토큰을 남긴다 — 연결이 끊겼다고 로그아웃되면 안 된다
- 인증 배관 자체(로그인·가입·갱신)는 `skipAuth`로 래퍼를 우회한다(자기 재귀 방지)

**다음 작업**

- 신규 EP를 쓰는 화면 연결(다음 커밋)

---

### Commit — 2026-08-01

- Hash: `0c6f5ab`
- Message: `Feat:#3 아동·계정 관리 화면과 확정자별 지표 추가`
- Issue: `#3`

**변경 요약**

- SCR-016 아동 관리(FN-021)·SCR-017 계정 관리(FN-022) 화면 신설
- 공통 상단바에 비밀번호 변경(EP-049), 지표 대시보드에 확정자별 지표(EP-028 `by_user`)
- Shell에 「원 관리」 그룹과 `directorOnly` 메뉴 분기 추가

**결정 로그**

- 아동 목록(EP-004)과 인적사항(EP-040)을 명세대로 갈라 뒀다 — 목록은 화면 진입마다
  부르는 경로라 가볍게 두고, 입소일·특이사항은 행을 눌렀을 때만 가져온다
- 부분 수정은 "키 없음=유지 / null=비우기"를 seam에서 지킨다. 폼의 빈 문자열은
  비우기로 보아 null로 바꿔 보낸다 — 빈 문자열을 날짜로 보내면 `VALIDATION_ERROR`가 난다
- 퇴소는 소프트 삭제이므로 되돌리기(EP-041 `status=enrolled`)를 함께 뒀다
- 목은 토큰을 검증하지 않아 역할을 모르므로 403 판정은 흉내 내지 않았다.
  잠금 방지(SELF_LOCKOUT·LAST_DIRECTOR·ALREADY_INACTIVE)와 중복 검사는 구현했다

**다음 작업**

- 실 서버 실동작 왕복 검증(회원가입 → 로그인 → 아동 등록 → 기록 → 재접속) — 자격 증명 확보 후
- `pj.md`(제출 보고서) 갱신 — 현재 r5/r6·화면 13종 기준이라 r11·화면 16종으로 고쳐야 한다
- `app/(main)/notices/page.tsx`의 미커밋 변경 확인 — 제외 아동 안내 블록이 빈 div만 남아 있다

---

### Commit — 2026-08-04 14:47

- Hash: `6de6c8d`
- Message: `Fix:#3 사진 업로드를 명세대로 multipart 전송으로 교정`
- Issue: `#3`

**변경 요약**

- EP-016 업로드를 `multipart/form-data`(`files`) 전송으로 교정 — 사진함의 「사진 올리기」가
  파일 선택기를 열고 고른 파일을 실제로 올린다(실패 시 서버 메시지를 토스트로 노출)
- `api.postForm` 추가. FormData 본문이면 `Content-Type`을 붙이지 않는다
- 목 핸들러도 `files`를 검증(없음 400·비이미지 415·10MB 초과 413)해 실서버와 계약을 맞췄다
- Electron 기본 창 크기를 1420×832(콘텐츠 기준, `useContentSize`)로 조정
- 알림장 화면에 남아 있던 생성 제외 안내 블록(빈 div) 제거

**결정 로그**

- 증상은 실서버가 준 `VALIDATION_ERROR`였고, 원인은 본문 없이 JSON으로 POST한 것이었다.
  목이 본문을 보지 않고 3장을 넣어 주는 바람에 목에서만 통과하던 계약 어긋남이다 —
  목도 명세대로 검증하도록 함께 고쳐 같은 종류의 누락이 다시 숨지 않게 했다
- multipart는 boundary를 fetch가 만들어야 하므로 헤더를 직접 넣지 않는다.
  래퍼가 `Content-Type: application/json`을 무조건 붙이던 것이 두 번째 걸림돌이었다
- 사진 용량 상한은 명세에 숫자가 없어 목에만 10MB를 뒀다(413 처리 확인용).
  실서버 상한이 정해지면 클라이언트 사전 검증을 추가한다

**다음 작업**

- 실서버로 사진 업로드 왕복 확인(202 → 분류 폴링 → 발송)
- 실서버 사진 용량·형식 상한 확인 후 업로드 전 검증 추가
- `pj.md`(제출 보고서) 갱신 — r11·화면 16종 기준으로
