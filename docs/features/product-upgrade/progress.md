# Progress — 프로토타입 → 실제품 수준 업그레이드

## 2026-07-20 (야간 자율 작업 세션)

### 완료

**데이터·API 계층**

- `lib/types/index.ts` 전면 확장 — Child(생일·보호자·알레르기·등원·아바타색),
  DailyRecord/Input, DocumentDraft(원본 content / 작업본 working / status /
  editDistance), Photo(classifying·classified·unmatched + sent),
  ObservationEntry(manualTag), ConsultSession, 규칙엔진 ChecklistData,
  MetricsSummary(dailyConfirmed 추가)
- `lib/constants.ts` 신설 — TODAY·CLASS_NAME·TEACHER_NAME·활동 프리셋
  (기존 `lib/data/mock`은 삭제, 화면이 목 데이터를 직접 import하는 구조 제거)
- `mocks/db.ts` 신설 — **상태형 인메모리 DB**. 핵심 동작:
  - 하루 기록 저장 → 아동 recorded 갱신 + 미확정 알림장 초안 무효화
  - 알림장 초안은 해당 아이의 하루 기록에서 **파생 생성** (조사 처리 포함)
  - 보육일지 초안은 당일 기록 전체 집계에서 생성
  - 확정 시 Levenshtein 기반 편집거리(%) 박제, 확정 전 발송 409 (불변식)
  - 사진: 업로드 → classifying → 폴링마다 1장씩 분류 완료(tick), 수동 지정,
    발송 플래그
  - 체크리스트: 조회 시마다 문서·관찰·상담 실데이터 재집계 (규칙엔진)
  - 지표: 이번 세션 확정분이 채택률·분포·일별 추이에 실시간 합산
  - `reseed()` — 설정의 "시드 다시 불러오기"가 전체 상태 초기화
- `mocks/handlers.ts` 재작성 — EP-001~031 상태형 구현 (+EP-007-B 기록 단건,
  EP-009 태그 수정, EP-018 수동 지정 신규)
- `lib/api` · `lib/queries` 확장 — 사진 폴링(refetchInterval, 분류 중일 때만
  2.2s), 뮤테이션별 정밀 invalidate (확정 → 대기열·체크리스트·지표)

**디자인 시스템** (`globals.css` + `tailwind.config.ts`)

- 팔레트 미세 조정(paper #F7F8F4, ink #1F2A21) + `faint`·`green-ghost` 토큰 추가
- 4px 스페이싱 그리드 정리: 섹션 간 `.stack`(16px), 카드 패딩 22px, pagehead 마진 통일
- 인터랙션: 버튼/칩 hover·press(scale 0.98), input focus ring, 카드 hover lift,
  topbar·bottomtab 블러 배경, 사이드나브 active 인디케이터 바
- 신규 부품: `.modal`/`.overlay`, `.avatar`(sm/lg), `.seg`, `.rail`,
  `.tag.manual`, `.mcell.hot`, 사진 오버레이 그라데이션
- 프라이머리 버튼·로고·진행바에 은은한 그라데이션

**모션**

- `app/(main)/template.tsx` — 라우트 전환 페이드업 (0.32s, ease-out expo)
- `components/ui` — ConfirmDialog·Modal (AnimatePresence 등장·퇴장),
  FadeIn, Toast 슬라이드 개선
- 사진 그리드 layout 애니메이션 (탭 전환·분류 완료 시 부드럽게 재배치)
- `window.confirm` 전부 제거 (문서 확정, 상담 확정, 시드 초기화 → 모달)

**화면 (13개 전부 재작성)**

- 홈: 히어로 지표 + 아동 카드 그리드(기록 상태·결석 표시) + 오늘의 흐름
- 하루 기록: 좌측 아동 레일(완료 체크) · 기존 기록 자동 로드(수정 모드 배지) ·
  "저장하고 다음 아이" · 알레르기 표시
- 알림장: 아이별 대기열 칩(초안/확정/발송 상태) ↔ 워크벤치 전환, 원천 기록도
  해당 아이 것으로 동기화, `?child=` 딥링크 (기록 화면에서 연결)
- DocumentWorkbench: 서버 status 기반, 작업본 0.8s 디바운스 자동 저장
  ("작업본 저장됨 ✓"), 다시 생성 실동작, 확정 후 편집거리 뱃지, 404(기록 없음)
  빈 상태 처리
- 사진함: 분류 폴링 진행, 아이별 탭(사진 있는 아이만), 미분류 클릭 → 수동 지정
  모달, 발송됨 dim 처리
- 관찰: 매트릭스 최다 영역 하이라이트, 태그 수정 모달(수동 태그 ✎ 표시)
- 상담: 아이 전환, 화자별 색 구분 transcript, 확정 → 히스토리 테이블 반영
- 발달평가서: 아이 선택 → 해당 아이 관찰 집계 기반 초안
- 체크리스트: 실데이터 판정 (문서 확정하면 즉시 충족으로 변화)
- 대시보드: 일별 확정 추이 AreaChart 신설, 툴팁, 세션 확정분 실시간 반영
- 설정: 시드 초기화가 실제로 전체 리셋, 데인저 모달
- 로그인: 등장 모션, autocomplete 속성

**검증**

- `type-check` ✅ (TS2802 이터레이터 이슈 → Array.from 치환)
- `lint` ✅ (exhaustive-deps 1건 수정)
- `build` ✅ 16/16 정적 생성
- `out/` 정적 서빙 → 13개 라우트 전부 200, mockServiceWorker.js 포함 확인

### 결정 사항

- 명세 주석(SpecBar·①번호)은 **기본 off**로 변경 — 제품 인상 우선, 상단바
  토글로 언제든 복원 (심사·시연 시 켜기)
- 문서 상태의 소유권을 클라이언트 로컬 state → 서버(DocumentDraft.status)로
  이전 — 화면 이동·재방문에도 확정 상태 유지
- 오늘 날짜는 시드 앵커(2026-07-16) 고정 유지 — 목 데이터 정합성 우선

### 남은 일 / 다음 세션

- [ ] `npm run electron:preview`로 Electron 셸 스모크 (브라우저 검증은 완료)
- [ ] 알림장 "전체 생성" 일괄 트리거 UI (현재는 기록 저장 시 개별 파생)
- [ ] 관찰 기록 직접 추가 폼 (현재는 하루 기록 메모 유입 전제)
- [ ] 커밋은 사용자 확인 후 `/commit` 흐름으로
