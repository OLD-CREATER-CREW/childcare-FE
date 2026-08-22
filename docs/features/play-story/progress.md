# Progress — 놀이이야기(play_story) 화면 연동

## 2026-08-23

### 완료

**타입·매핑**

- `lib/types/index.ts` — `DocType`에 `play_story` 추가. `PhotoSuggestion` 타입 신설,
  `DocumentDraft.photoSuggestions` 추가(항상 배열 — 다른 문서는 빈 배열)
- `lib/api/spec.ts` — `SpecDocType`에 `play_story`, 양방향 매핑 2곳,
  `SpecPhotoSuggestion` 신설, `SpecDocument.photo_suggestions` 추가
- `lib/api/index.ts` — `DOC_LABEL_KO`에 라벨, `mapDoc`이 snake_case → camelCase 변환
- `lib/templates.ts` — `DOC_TYPE_LABEL`에 라벨

`Record<DocType, …>`가 여러 곳에 있어 타입 추가만으로 누락 지점 2곳(`lib/templates.ts`,
`mocks/db.ts` 시드)이 `tsc`에 걸렸다. 망라 타입을 쓰는 구조가 그대로 효과를 봤다.

**API 클라이언트**

- `generateDocumentDraft(type, childId, topic?, className?)` — 인자 추가.
  `play_story`일 때 `class_name` + 월 기간을 실어 보낸다.
- `useRegenerateDraft` 뮤테이션도 `className`을 통과시킨다.

**공용 골격**

- `DocumentWorkbench`에 `className`·`canGenerate` prop 추가. 초안 생성·자동 저장·
  확정 흐름은 그대로 재사용. `canGenerate=false`면 「초안 만들기」가 잠긴다.

**화면**

- `app/(main)/play-story/page.tsx` 신설 — 반 선택(칩) → 주제 입력 → 생성.
  반이 하나뿐이면 자동 선택. 원천 패널에 반·기간·주제·근거를 보여 준다.
- 사이드 패널 `PhotoPanel` — 날짜·활동·장수. 후보가 없으면(기본 상태) 초안의
  '추천 사진 가이드'를 보라는 안내로 대체된다.
- `components/layout/Shell.tsx` — 사이드바 "하루 흐름"에 계획안 바로 아래 배치.

**목(MSW)**

- `mocks/db.ts` — `playStoryContent()` 신설. 실서버 출력의 짜임(대괄호 제목 →
  빈 줄 → 칸 이름/값 두 줄 → 소주제별 날짜·놀이 이야기·말풍선 문구 제안·추천 사진
  가이드)을 그대로 흉내낸다. 화면이 이 모양을 전제로 날짜를 짝짓기 때문이다.
- `playStoryPhotos()` — 사진 후보 목. `PLAY_STORY_HAS_PHOTOS` 상수로 있음/없음을
  전환한다. **기본은 `false`** — 실서버도 대개 빈 배열을 주므로 화면이 그 상태를
  먼저 견디는지 확인되어야 한다.

### 검증

- `npm run type-check` 통과
- `npm run lint` 통과 (경고 0)
- `npm run build` 통과 — `/play-story` 라우트 생성 확인 (2.87 kB)
- MSW 목으로 실제 화면 확인:
  - 반 선택 전/후 전환, 생성 버튼 잠금
  - 초안 생성 → 본문 632자·18줄 정상 수신
  - 사진 후보 **없음**(기본) — 안내 문구로 대체
  - 사진 후보 **있음**(플래그 on) — `08/06 낙엽 밟기 산책 1장` / `08/13 도토리 구슬
    굴리기 2장` 렌더 확인 후 플래그 원복

### 남은 일 / 확인 필요

1. **배포 백엔드 연동 확인 미완** — 목으로만 확인했다. `NEXT_PUBLIC_API_BASE_URL`을
   실서버로 두고 반 미선택 400 · 없는 반 404 · 정상 201을 눌러 봐야 한다.
2. **사진 썸네일 불가** — `file_key`를 이미지로 바꿀 엔드포인트가 백엔드에 없다
   (`GET /api/photos/{id}/file` 부재). 메타데이터만 보여 준다. plan.md 미해결 질문 1 참조.
3. **반별 초안 구분 불가** — `documents` 표에 `class_name`이 없어 "이 반의 최신
   놀이이야기"를 지목할 수 없다. 반을 바꿔도 직전 반의 초안이 보인다(초안 첫 줄의
   `[반이름]`으로만 구분 가능). plan.md 미해결 질문 2 참조.
4. **목 문안이 입력 주제를 반영하지 않는다** — `planContent()` 등 기존 목과 같은
   방식(문안 하드코딩)이라 그대로 뒀다. 실서버는 주제를 반영한다.
