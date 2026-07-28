# api-integration — 진행 상황

## 📌 현재 작업

- 이슈: #1 (Feat)
- 브랜치: feature/1-api-integration
- 단계: Phase 1 시작
- 마지막 업데이트: 2026-07-24 23:10

---

## [Issue #1] api-integration

**Type**: Feat | **시작**: 2026-07-24

### ✅ 완료

- [x] 작업 환경 셋업 (/start 실행)

### 🚧 진행 중

- (없음 — In Scope 전 항목 완료. 백엔드 배포 후 실 API 스모크만 남음)

### ✅ 추가 완료 (2026-07-25)

- [x] 실 API 연동 (와이어 계약 전면 교체)
- [x] 기능에 맞게 플로우 수정
- [x] 양식 연동(파일 시스템) 기능 확인

**변경 파일**

- `lib/api/client.ts` — 세션 쿠키 인증(`credentials:"include"`)·명세 오류 봉투(`{error:{code,message}}`) → `ApiError(status,code,message)`·204 방어.
- `lib/api/spec.ts` (신설) — 명세 와이어 타입 + UI↔명세 매퍼(발달영역 한글↔영문, DocType, childId "c01"↔101, record/consult ID 브리지) + 하루기록 encode/decode + 상담요약 3키 파싱. seam·mock 공용.
- `mocks/db.ts` — 내부 모델·시드·로직 유지, document_id 브리지(assignDocId/resolveDocId/listDocuments/getDocByTarget)·`getMetricsSpec()` 추가.
- `mocks/handlers.ts` — 명세 경로/메서드/바디/응답 봉투/정수ID/영문enum/오류형식으로 전면 재작성(EP-001~031 + 데스크톱 확장 2종).
- `lib/api/index.ts` — seam 전면 재작성. UI 함수 시그니처 유지, 내부에서 명세 EP 호출·매핑. 홈 현황/알림장 대기열은 여러 EP 합성.
- `lib/types`·`lib/queries`·화면 11개 — **무수정**(seam이 계약 차이를 흡수).

**검증**: `tsc --noEmit` 0, `next lint` 0, `next build` 성공(16 route). msw/node로 실 seam↔핸들러 e2e 24개 플로우 전부 통과(로그인·기록 저장왕복·문서 생성/확정/발송·일괄생성·관찰/태그/직접추가·상담 확정·사진·체크리스트·지표·설정·시드·양식).

**양식 연동(파일 시스템) 점검 결과** (2026-07-25)

- 데스크톱 체인 전체 결선 확인: `electron/main.js` IPC 3종(getConfig/pickFolder/readAll) ↔ `electron/preload.js` `window.desktop.templates` ↔ `lib/templates.ts` 브리지 타입 — 채널·시그니처 완전 일치. `TemplateBootstrap`은 `app/(main)/layout.tsx`에 마운트되어 부팅 시 자동 동기화, 설정 페이지(SCR-014)는 수동 폴더 지정 지원.
- e2e 8종 통과: 순수 서식 로직(fileNameToDocType·applyTemplate), 웹 모드 무해 폴백(브리지 없음→loadTemplateMap={}), 데스크톱 브리지 시뮬레이션→loadTemplateMap 매핑→`syncTemplates`(POST /templates, 와이어)→**동기화한 로컬 서식이 실제 알림장 초안 생성을 구동**(`[우리원 서식] 김민준(해님반)…`)까지 확인.
- 미실행: 실제 Electron 런타임 + OS 폴더 선택창(GUI, 헤드리스 불가)은 코드 리뷰로 갈음. `POST /api/templates`는 명세 공식 EP 아님 — 데스크톱 전용 확장으로 유지(백엔드 계약 확정 시 대조 대상).

### 📝 결정 로그

- [2026-07-24 23:10] /start 실행, 작업 환경 셋업 완료
- [2026-07-24 23:40] 현황 파악: 실행 중 백엔드 없음(localhost:8000 무응답), 배포 전. 프론트는 자체 계약(문자열 ID·한글 enum·구조화 기록)으로 MSW와 정합. 실제 명세(docs/spec/final_API_명세서.md, EP-001~031)와 경로·형태 전면 불일치.
- [2026-07-24 23:40] 전략 확정: **와이어 계약 전면 교체**. 실제 HTTP 계약(경로·메서드·바디·{items,total} 봉투·정수 ID·영문 enum·세션 쿠키 인증)을 명세로 전부 교체하고 MSW를 명세대로 재작성. UI↔명세 매핑은 설계된 이음새 lib/api/index.ts에서 흡수. lib/types·화면 11개·lib/queries는 유지(무회귀).
- [2026-07-24 23:40] 매핑 규약: childId 문자열"c01"↔정수 101 / 발달영역 한글↔영문(physical…) / DocType plan↔weekly_plan·evaluation↔dev_eval / editDistance UI 0~~100%↔spec 0~~1 / 문서는 UI가 (type,childId)로 주소지정→seam이 GET /documents로 document_id 해소. 명세에 없는 UI 표현 필드(색·아이콘·출결 등)는 mock 부가 반환 또는 seam 파생으로 무회귀 유지.

### 🐛 트러블슈팅

<!-- /note troubleshoot 으로 추가 -->

### ⏭️ 남은 작업

- [x] 양식 연동(파일 시스템) 기능 확인 — 체인 결선 + e2e 8종으로 검증(Electron GUI 실행만 코드리뷰 갈음)
- [ ] 백엔드 배포 시 `NEXT_PUBLIC_USE_MOCK=false` + `NEXT_PUBLIC_API_BASE_URL` 지정 후 실 API 스모크 (매핑 규약 실계약 대조: record 필드 세분화·관찰 직접추가 EP·양식 동기화 EP)

---

### Commit — 2026-07-28 18:06

- Hash: `081122b`
- Message: `Feat:#1 MSW 목을 명세 기반 실 API 계약으로 전환`
- Issue: `#1`

**변경 요약**

- 와이어 계약 전면 교체: client.ts(세션 쿠키·오류 봉투), spec.ts(신설, 와이어 타입+매퍼), index.ts(seam 재작성), mocks/{db,handlers}(명세 EP·document_id 브리지·getMetricsSpec).
- lib/types·화면·lib/queries 무수정 — seam이 UI↔명세 계약 차이 흡수.

**결정 로그**

- 명세에 없는 UI 표현 필드(색·출결 등)는 mock 부가/seam 파생으로 무회귀 유지.
- 관찰 직접추가·양식 동기화는 공식 EP 밖 → REST 확장(POST /children/{id}/observations, POST /templates)으로 유지, 백엔드 계약 확정 시 대조.

**다음 작업**

- 백엔드 배포 후 실 API 스모크.

### Commit — 2026-07-28 18:06

- Hash: `77fbc8c`
- Message: `Style:#1 UI 스페이싱·레이아웃 정리로 밀집감 해소`
- Issue: `#1` (Closes)

**변경 요약**

- globals.css 섹션 리듬 20px화 + 표/필드 여백, 셀렉트 기본폭 부풀림으로 세로로 쌓이던 필드 고정폭 정렬(하루기록·관찰), 사진함 헤더·탭·계획안 기간 레이아웃 정리.

**결정 로그**

- 동작 변경 없음(순수 시각). `.inline .input` 전역 규칙은 건드리지 않고 인스턴스별 고정폭으로 해결(회귀 위험 최소화).

**다음 작업**

- 없음 (이슈 #1 범위 완료 → PR 머지 시 Closes).
