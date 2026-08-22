# Plan — 놀이이야기(play_story) 화면 연동

## 변경 목적

백엔드에 문서 종류 `play_story`(월간 놀이이야기 소식지)가 추가되어 main에 merge·배포되었다.
프론트에는 이 종류가 없어 화면에서 쓸 수 없다. 문서 종류가 서버에서 내려오지 않고
프론트 코드에 하드코딩되어 있으므로(`DocType`·`SpecDocType`), 배포만으로는 나타나지 않는다.

백엔드 API 계약(`childcare-ai-assistant`):

- `POST /api/documents/generate` — `type: "play_story"` 추가
- 요청에 `class_name` **필수** (없으면 400 "반을 선택해 주세요.")
- 응답에 `photo_suggestions[]` 추가 (놀이이야기만, 비어 있을 수 있음)

## 변경 범위

1. **타입·매핑** — `DocType`·`SpecDocType`에 `play_story` 추가, 양방향 매핑,
   한글 라벨(`DOC_LABEL_KO`·`DOC_TYPE_LABEL`), 응답 타입 `SpecPhotoSuggestion`
2. **API 클라이언트** — `generateDocumentDraft`에 `className` 인자 추가.
   놀이이야기는 `child_id`가 아니라 `class_name`으로 범위를 정하는 첫 문서다.
3. **`DocumentWorkbench`** — `className`·`canGenerate` prop 추가. 나머지 골격
   (초안 생성·자동 저장·확정)은 그대로 재사용한다.
4. **화면** — `app/(main)/play-story/page.tsx` 신규. 반 선택 + 주제 입력 +
   사진 후보 사이드 패널.
5. **네비게이션** — Shell 사이드바 "하루 흐름" 그룹, 계획안 바로 아래.
6. **MSW 목** — 백엔드 없이 화면을 만들 수 있도록 놀이이야기 초안·사진 후보 목 추가.

## 접근 방식

- **기존 규율을 그대로 따른다.** UI 타입(`plan`)과 와이어 타입(`weekly_plan`)을
  분리해 두는 구조가 이미 있으므로 거기에 얹는다. 놀이이야기는 UI와 와이어 이름이
  같아 매핑이 단순하다.
- **반 목록은 `useChildren()`의 `className`을 모아 중복 제거**한다. 반 전용 표도
  API도 없다(백엔드도 `Child.class_name` 문자열이 곧 식별자다).
- **사진은 메타데이터만 보여 준다.** 아래 "미해결 질문" 참조.
- 반을 고르기 전에는 생성 버튼을 잠근다(`canGenerate`). 서버도 400으로 막지만
  누르기 전에 알려 주는 편이 낫다.

## 검증 계획

- `npm run type-check` · `npm run lint` 통과
- MSW 목으로 화면 확인 — 반 선택 전/후, 사진 후보 있음/없음 두 상태
- 배포 백엔드에 붙여 실제 생성 확인 (반 미선택 400, 없는 반 404, 정상 201)

## 미해결 질문

### 1. 사진 이미지를 띄울 방법이 없다

`photo_suggestions[].file_key`는 서버 저장소 내부 경로이고, **그 파일을 내려주는
엔드포인트가 백엔드에 없다.** 문서는 `GET /documents/{id}/file`이 있으나 사진은 없다.
기존 사진함 화면(`app/(main)/photos/page.tsx`)에 `img` 태그가 하나도 없는 것도 그래서다.

이번 범위에서는 **메타데이터만**(날짜·활동·장수) 보여 준다. 썸네일이 필요하면
백엔드에 `GET /api/photos/{id}/file`을 먼저 추가해야 한다 — 아동 얼굴이라 접근
통제를 함께 설계해야 하므로 별도 과제로 둔다.

### 2. 반별 초안을 따로 보관할 수 없다

`resolveDocumentId(type, childId)`가 타입·아이로만 거르고, 백엔드 `documents` 표에
`class_name` 칸이 없다. 그래서 "햇님반의 최신 놀이이야기"를 지목할 수 없고, 화면은
**타입 기준 최신 문서 하나**를 본다.

교사가 A반 초안을 만든 뒤 B반으로 바꾸면 A반 초안이 그대로 보인다. 초안 첫 줄이
`[A반 놀이이야기]`라 눈으로는 구분되지만, 근본 해결은 백엔드에 `documents.class_name`
칸을 더하고 목록 필터를 여는 것이다.

### 3. 말풍선은 AI가 지어낸 문구다

하루 기록에 아이의 발화가 담기지 않으므로 서버가 제안한 초안이다. 백엔드에서 칸
이름을 `말풍선 문구 제안`으로 바꿔 성격을 드러냈고, 화면 하단에도 안내를 둔다.
