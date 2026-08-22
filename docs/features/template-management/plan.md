# SCR-015 양식 템플릿 관리 — 계획

작성: 2026-08-23

## 변경 목적

백엔드(`OLD-CREATER-CREW/childcare-ai-assistant` · `feat/template-driven-draft`)에
**서식을 원본 그대로 채워 내려주는 기능**이 들어갔다. 교사가 올린 `.hwpx`를 열어
표 칸 안의 글자만 갈아 끼우므로 표·괘선·글꼴이 그대로 남고, 받아서 바로 제출할 수
있는 파일이 나온다.

그런데 **이 기능을 사람이 쓸 화면이 없다.** 스토리보드 SCR-015가 미구현이고,
`lib/api/index.ts:1047`의 `syncTemplates()`는 목 응답을 돌려주는 자리표시자다.

이 작업은 SCR-015를 만들고, 문서 화면 4종(SCR-004·006·007·011)에 완성 파일
생성·내려받기와 칸 단위 검토를 붙인다.

## 변경 범위

| 계층 | 파일 | 내용 |
|---|---|---|
| 계약 | `lib/api/spec.ts` | `SpecTemplate`·`SpecStructureMeta`(v2)·`SpecDocumentCell` 추가, `SpecDocument`에 `template_id`·`cells`·`file_key`·`file_render_status` 추가 |
| 전송 | `lib/api/client.ts` | 바이너리 응답용 `api.getBlob` — EP-036은 JSON이 아니라 파일 스트림이다 |
| UI 타입 | `lib/types/index.ts` | `FormTemplate`·`TemplateStructure`·`TemplateCell`·`DocumentCell` |
| seam | `lib/api/index.ts` | EP-032~035·037·052(템플릿), EP-036·038(문서 파일), 칸 저장 |
| 훅 | `lib/queries/index.ts` | 템플릿·문서 파일·칸 저장 훅 + 캐시 무효화 |
| 화면 | `app/(main)/templates/page.tsx` | **SCR-015 신규** |
| 화면 | `components/document/DocumentWorkbench.tsx` | 완성 파일 버튼·칸 단위 검토·긴 생성 진행 표시·503 처리 |
| 내비 | `components/layout/Shell.tsx` | 「양식 관리」 메뉴(운영 그룹) |
| 목 | `mocks/handlers.ts`·`mocks/db.ts` | 실계약과 같은 모양의 템플릿 목 |

## 접근 방식

### 1. 업로드 예외가 이 화면의 핵심이다

현장 표본 16개 중 14개가 구 `.hwp`다. 확장자만 `.hwpx`로 고쳐 올리는 일도 실제로
있어서 **서버가 파일 내용으로 판별한다.** 세 예외를 코드로 갈라 처리한다.

| 상태 | code | 화면 |
|---|---|---|
| 415 | `HWP_NEEDS_CONVERSION` | 서버 `message`를 그대로 노출 — **변환 방법 안내**다. "지원하지 않는 형식"으로 뭉개지 않는다 |
| 415 | `UNSUPPORTED_TEMPLATE_FILE` | `.docx`/`.hwpx`만 지원 |
| 422 | `TEMPLATE_ANALYSIS_FAILED` | 표를 못 읽음 — 다른 서식 권유, 활성화 버튼 비활성 |

업로드 버튼 아래에 hwpx 저장 안내를 **상시** 표시한다(스토리보드 r12).

### 2. 2단계 등록 — 업로드는 비활성, 활성화는 사람이

`POST /api/templates`는 `active:false`로만 등록한다. `structure_meta`(v2)의
`cells`로 **채울 칸이 몇 개인지·어떤 라벨인지**를 보여 준 뒤에야
`POST /api/templates/{id}/activate`가 열린다. "AI는 분석, 사람이 확정".

### 3. `style_enabled`는 눈으로 확인하고 켠다

켜면 서식에 이미 적혀 있던 문안이 프롬프트에 실린다. 교사가 올리는 서식은 빈
양식이 아니라 **작년 작성본인 경우가 많고 실제 아동·교사 이름이 들어 있다.**
서버가 마스킹하지만 완전하지 않다. 그래서 토글 옆에 각 칸의 `existing_text`를
펼쳐 보여 주고, 경고를 읽은 뒤에 켜는 흐름으로 만든다. 기본 꺼짐.

### 4. 표 구조는 문서가 아니라 템플릿에 속한다

`DocumentCell`에는 라벨·본문만 오고 표 구조(행·열·병합)는 오지 않는다.
`template_id`로 `GET /api/templates/{id}`를 **한 번 받아 캐시**하고 문서마다 다시
받지 않는다(TanStack Query `staleTime: Infinity`).

### 5. 확장자를 고정하지 않는다

서식을 채우면 `.hwpx`, 폴백이면 `.docx`다. Content-Type도 서버가 확장자로 갈라
준다(`docfill.media_type_for`). 파일명은 `Content-Disposition`에서 뽑고, 아이콘도
확장자로 고른다.

### 6. 생성이 느리다 — 진행 표시

실물 서식 11칸에 약 2~5분, 호출 8~12회. 활성 템플릿이 있는 문서 타입은 안내
문구를 "20~40초"가 아니라 "2~5분"으로 바꾸고 경과 시간을 보여 준다.

### 7. 빈 칸이 와도 화면이 깨지지 않아야 한다

간헐적으로 칸 1개가 비어 올 수 있다(모델 형식 이탈, 서버가 재시도하지만 100%는
아니다). 빈 칸은 자리를 유지한 채 "비어 있음"으로 표시하고 교사가 직접 채울 수
있게 둔다.

### 8. 503 `LLM_UNAVAILABLE`은 "다시 시도"를 권하지 않는다

메시지에 원인이 담겨 있다("크레딧이 소진되었습니다" 등). 그대로 보여 주고
재시도 버튼을 권하지 않는다 — 재시도해도 실패하는 종류다.

## 검증 계획

- `npx tsc --noEmit` / `npm run build` 통과
- 목(MSW) 모드에서 SCR-015 전 흐름: 업로드 → 미리보기 → 활성화 → 교체 → 비활성화
- 목에서 예외 3종(415×2·422)이 각각 다른 화면으로 갈리는지
- 실서버(`uvicorn backend.main:app --reload`, `LLM_PROVIDER=mock`) 왕복:
  로그인 → 시드 → 서식 업로드 → 활성화 → 문서 생성 → 확정 → 문서 만들기 → 내려받기

## 미해결 질문

- `spec/final_API_명세서.md`의 템플릿 절이 r5 시점(`structure_meta.fields`)에
  멈춰 있고, 실제 백엔드는 v2(`tables`/`cells`)다. **구현은 백엔드 실계약을
  따르고**, 명세 갱신은 백엔드 쪽에 남긴다
- `PATCH /api/templates/{id}/style`(EP-052)은 명세서에 아직 절이 없다
- `syncTemplates()`(로컬 폴더 텍스트 양식)는 목 문서 생성에서 아직 쓰이므로
  이번에는 건드리지 않는다. SCR-015가 실서버 경로를 대체하면 제거 대상이다
