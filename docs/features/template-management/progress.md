# SCR-015 양식 템플릿 관리 — 진행 기록

- Issue: [#14](https://github.com/OLD-CREATER-CREW/childcare-FE/issues/14)
- Branch: `feature/14-template-management` (base `main`)
- Plan: `docs/features/template-management/plan.md`

---

## 2026-08-23 — 구현

### 무엇을 만들었나

백엔드 `feat/template-driven-draft`가 서식을 원본 그대로 채워 내려주는데 **사람이
쓸 화면이 없었다.** SCR-015를 만들고, 문서 화면에 완성 파일과 칸 단위 검토를 붙였다.

| 계층 | 파일 |
|---|---|
| 계약 | `lib/api/spec.ts` — `SpecTemplate`·`SpecStructureMeta`(v2)·`SpecDocumentCell`·`SpecRenderFile`, `SpecDocument`에 `template_id`·`cells`·`file_key`·`file_render_status` |
| 전송 | `lib/api/client.ts` — `rawRequest` 분리 + `api.getFile`(바이너리 · `Content-Disposition` 파싱) |
| UI 타입 | `lib/types/index.ts` — `FormTemplate`·`TemplateStructure`·`TemplateCell`·`DocumentCell`·`FileRenderStatus` |
| seam | `lib/api/index.ts` — EP-032~035·037·052, EP-036·038, `saveDocumentCells` |
| 훅 | `lib/queries/index.ts` — 템플릿·활성 템플릿·문서 파일·칸 저장 |
| 화면 | `app/(main)/templates/page.tsx` **(신규)** |
| 화면 | `components/document/DocumentCells.tsx` **(신규)** · `DocumentFileBar.tsx` **(신규)** |
| 화면 | `components/document/DocumentWorkbench.tsx` — 칸/평문 전환 · 진행 표시 · 503 갈래 |
| 내비 | `components/layout/Shell.tsx` — 「양식 관리」(운영 그룹, SCR-015) |
| 목 | `mocks/db.ts`·`mocks/handlers.ts` — 실계약과 같은 모양 |

### 결정 로그

**1. 업로드 예외 세 갈래를 코드로 가른다.** 이게 이 화면의 값어치다.
`HWP_NEEDS_CONVERSION`은 서버 `message`를 **그대로** 노출한다 — 변환 절차가 거기
담겨 오므로 우리가 고쳐 쓰면 한글 메뉴 이름이 바뀔 때 두 곳을 고쳐야 한다.
업로드 버튼 아래 hwpx 저장 안내는 오류 시가 아니라 **상시** 표시한다(r12).

**2. 확정 시 `final`을 보내지 않는 경우를 만들었다 — 실제 데이터 손실 버그였다.**
서버 `confirm_document`는 `final_text = final or doc.working or doc.draft`다. 칸
저장(`PUT draft {cells}`)은 **서버 쪽 `working`만** 갱신하는데, 화면은 문서를 처음
읽을 때의 평문을 `working` state로 들고 있다. 그대로 `final`에 실어 보내면
**칸 편집 이전의 옛 글이 확정본으로 굳는다.** 그래서 칸이 있는 문서는 `final`을
아예 보내지 않고 서버가 칸에서 확정본을 만들게 했다. 실서버로 재현·확인했다.

**3. 표 구조는 문서가 아니라 템플릿에서 받는다.** `DocumentCell`에는 행·열 총량이
오지 않는다. `templateId`로 EP-034를 한 번 받아 `staleTime: Infinity`로 캐시한다.

**4. 확장자를 고정하지 않는다.** 실서버 확인 결과 hwpx 서식은
`filename*=UTF-8''journal_2026-08-22.hwpx` + `application/haansofthwpml+zip`,
docx 서식은 `.docx`로 갈려 나왔다. 파일명은 `Content-Disposition`에서 뽑는다.

**5. `style_enabled`는 경고만으로 끝내지 않고 실제 문장을 보여 준다.** 작년
작성본에 아이 이름이 남아 있는지는 그 글을 봐야 알고, 그 판단은 교사만 할 수 있다.
끄는 방향은 되돌리는 쪽이라 확인 없이 바로 끈다.

**6. `no_template`은 실패로 그리지 않는다.** 서식을 안 올린 기관의 정상 상태다.
「완성 문서를 만들지 못했습니다」가 아니라 양식 관리로 가는 안내를 띄운다.

**7. 503 `LLM_UNAVAILABLE`에 「다시 시도」를 두지 않았다.** 재시도해도 실패하는
종류라 버튼을 두면 원인을 모른 채 반복해서 누르게 된다. 서버 메시지를 그대로 보이고
관리자에게 알리라고 안내한다. 예전에는 생성 실패가 전부 "원천 기록이 없습니다"로
뭉개져 교사가 하루 기록을 다시 확인하러 갔다.

**8. `.notice`가 `flex gap-2.5`라 인라인 요소가 낱개로 흩어진다.** 내가 넣은
Notice는 내용을 `<div>` 하나로 감쌌다. **기존 화면에도 같은 문제가 있으나 전역 CSS
변경은 이번 범위 밖이라 손대지 않았다** — 아래 후속 작업 참조.

### 검증

- `npx tsc --noEmit` · `npm run build`(21 라우트 정적 프리렌더) · `npm run lint` 통과
- **실서버 왕복**(`uvicorn backend.main:app`, `LLM_PROVIDER=mock`, 로컬 PostgreSQL 17):
  - EP-033/034 — `structure_meta` v2(`version:2`·`tables`·`cells`) 매핑 확인
  - EP-032 세 갈래 — 정상 201(`active:false`) / `UNSUPPORTED_TEMPLATE_FILE` 415 /
    **OLE 바이너리를 `.hwpx`로 위장** → `HWP_NEEDS_CONVERSION` 415 / 빈 zip →
    `TEMPLATE_ANALYSIS_FAILED` 422
  - EP-037 활성화 시 같은 타입 기존 활성이 자동으로 내려감 · EP-052 토글
  - EP-013 `{cells}` 부분 병합 → **바뀐 칸만** 변경됨
  - EP-014 `final` 없이 확정 → 칸 편집이 확정본에 보존됨(결정 2 검증)
  - EP-038/036 — `NOT_CONFIRMED` 409 / `NO_ACTIVE_TEMPLATE` 409 /
    `FILE_NOT_AVAILABLE` 404 / 성공 시 `.hwpx` 다운로드
- **브라우저(Playwright, 실서버 연동)**: 로그인 → SCR-015 렌더(콘솔 오류 0) →
  업로드 3갈래 화면 분기 → 미리보기 → 활성화 → 계획안 칸 편집(서버에 그 칸만 반영
  확인) → 확정 → 문서 만들기 → 내려받기(`weekly_plan_2026-08-22.docx`, 37KB)
- **목(MSW) 모드**: 빈 상태 → 업로드 → 미리보기 → 활성화 → 구 hwp 갈래 →
  문체 예시 동의 다이얼로그까지 동작

---

## 2026-08-23 — 확정 전 서식 파일 검토 허용 (후속)

### 계기

"보육일지에서 바로 한글 파일 뽑아 줄 수 있냐"는 요청. 확인해 보니 **이미 붙어
있었지만 `status === "draft"`에서 `null`을 돌려주고 있어 보이지 않았다.**

그 판단은 명세 r6("생성·확정은 파일을 만들지 않는다")을 따른 것인데, 백엔드
`feat/template-driven-draft`가 **그 결정을 뒤집어 놓았다**:

> 한때는 만들지 않았다. … 그 판단은 산출물이 새로 그린 `필드/내용` 2열 .docx이던
> 시절의 것이다. 지금은 교사가 올린 서식을 그대로 채우므로, 한글에서 열어 봐야
> 비로소 제대로 검토할 수 있다 — 칸이 넘치는지, 요일별로 제자리에 들어갔는지는 칸
> 목록을 스크롤해서는 판단하기 어렵다. **검토를 지키려던 원칙이 검토를 막고 있었다.**
> — `backend/services/documents.py`

실제로 생성 직후 `file_key: center1/documents/67_preview.hwpx`,
`file_render_status: ok`가 오고, 초안 상태에서 EP-036을 부르면
`journal_2026-08-23_초안.hwpx`가 그대로 내려온다. 화면만 그걸 감추고 있었다.

### 바꾼 것

`DocumentFileBar`를 문서 상태 × 파일 종류 **네 갈래**로 다시 짰다.

| 문서 상태 | 파일 | 화면 |
|---|---|---|
| `draft` | `_preview` | 「초안 한글 파일(.hwpx) 내려받기」 + 초안임을 명시 |
| `draft` | 없음 | 서식은 있는데 파일이 없다는 안내(만들기는 409라 막는다) |
| `confirmed`·`sent` | `_preview` | **경고** + 「확정본 파일 만들기」가 주 동작 |
| `confirmed`·`sent` | `_final` | 「내려받기」가 주 동작, 「다시 만들기」는 서식 교체용 |

- **확정 직후에도 파일은 `_preview` 그대로다.** 여기서 「내려받기」만 내밀면
  파일명에 `초안`이 붙은 파일을 확정본으로 믿고 제출하게 된다. 그래서 확정 후
  `_preview` 상태에서는 「확정본 파일 만들기」를 주 버튼으로 올렸다.
  구분 신호는 `file_key`의 `_preview` / `_final` — 백엔드가 파일명 `_초안` 표기를
  같은 기준으로 정하므로 이게 계약이다.
- 버튼·안내에 **실제 확장자를 이름으로 박았다**(「한글 파일(.hwpx)」). 활성 서식
  상세(EP-034, 이미 캐시됨)의 `source_format`에서 가져오므로 추가 요청이 없다.

**빈 `template` 칸은 그리지 않는다.** 실물 주간보육일지에서 `월 / 놀이 평가 및
지원 계획`은 칸 두 개로 나뉜다 — 행 이름 칸(col 1, 서버가 채우지 않음)과 교사가
쓰는 칸(col 3). 앞쪽이 빈 `template` 칸으로 내려오는데 카드로 그리면 35칸 문서에
"비어 있는 칸입니다"만 반복하는 카드가 다섯 장 생겨 정작 읽을 칸을 밀어냈다.
문안이 **있는** `template` 칸은 남긴다(완성 문서에 그대로 나가므로).

### 검증 (실서버 · 실제 교사 서식)

교사가 올린 실물 주간보육일지 hwpx(표 2개·35칸·`시간대 × 요일` 격자)로 확인했다.

- 초안 상태 → `journal_2026-08-23_초안.hwpx` (79,804 bytes) 내려받기 성공
- 확정 직후 → 「확정본 파일 만들기」 경고·버튼 노출 확인
- 확정본 생성 후 → `journal_2026-08-23.hwpx` (`_초안` 없음) 내려받기 성공
- 받은 파일 내부 검사: `mimetype: application/hwp+zip`, zip 12엔트리, `<hp:tbl>` 2개
  보존, 원본 라벨(`달님반(만 1세) 주간보육일지`·`등원 및 통합보육`) 그대로,
  생성 문안 30칸 주입됨 — **서식이 살아 있고 칸 글자만 교체된다**
- 서식 라벨 칸 5개 숨김 표시 확인, AI 칸 30개 중 빈 칸 0개
- `tsc` · `build` · `lint` 통과

### 백엔드에 보고할 것

**결재란이 채움 대상으로 잡힌다.** 템플릿 19의 `t0r1c2` 라벨이 `김지선 / 원장`
(표0 = 담임·원장 결재란)인데 `budget_chars: 15`인 채움 칸으로 분석돼,
완성 문서의 결재란에 `김지선 / 원장에 대한 mock 문안입니다.`가 들어갔다.
실운영에서는 원장 서명란에 생성 문장이 찍힌다 — `template_fields.find_fillable_cells`가
결재란(표0의 소형 표)을 제외해야 한다.

### 후속 작업

- `.notice`의 `flex gap-2.5`가 인라인 `<b>`·`<code>`를 낱개 항목으로 흩뜨린다.
  **기존 화면 여러 곳에 이미 같은 증상이 있다**(예: 알림장의 "「발송」 버튼은
  <b>확정 후에만</b>"). 전역 CSS를 고칠지, 각 Notice를 감쌀지 팀 합의 필요
- `syncTemplates()`(로컬 폴더 텍스트 양식)는 여전히 서버를 부르지 않는 자리표시자다.
  이번에 목의 옛 `POST /api/templates`(텍스트 JSON) 핸들러를 실계약으로 교체했는데,
  `syncTemplates`가 이미 API를 부르지 않았으므로 **동작 변화는 없다**(죽은 경로였다).
  SCR-015가 실경로를 대체했으니 `TemplateBootstrap`·`lib/templates.ts` 정리는 별도 이슈로
- 명세서(`spec/final_API_명세서.md`)의 템플릿 절이 r5(`structure_meta.fields`)에
  멈춰 있다. 실제 백엔드는 v2(`tables`/`cells`)이고 EP-052는 절 자체가 없다 —
  **백엔드 레포에 명세 갱신 요청 필요**
- 칸 편집 디바운스(0.8초)가 끝나기 전에 「확정」을 누르면 마지막 타건이 유실될 수
  있다. 기존 평문 편집도 같은 성질이라 이번에는 맞추기만 했다 — 확정 전 플러시 필요
- 실물 서식 11칸 생성(2~5분)은 `LLM_PROVIDER=mock`으로 검증해 실모델 소요·빈 칸
  발생률은 확인하지 못했다. 실모델 1회 확인 권장
