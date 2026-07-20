# Plan — 공통 UI를 상위 폴더 디자인 시스템(my-ui)으로 교체

- 작성일: 2026-07-20
- 상태: 검토 대기 (미해결 질문 확인 필요)

## 변경 목적

ChildCare 프로토타입에서 자체 구현한 공통 UI(버튼, 모달, 토스트, 스켈레톤 등)를
`~/design-system`(my-ui)의 컴포넌트로 통일해 스타일 일관성과 재사용성을 확보한다.

## 핵심 제약 — 스택 불일치

**my-ui는 Vue 3 + SCSS, ChildCare는 Next.js(React)라서 `.vue` 컴포넌트를 직접 import할 수 없다.**

다만 my-ui는 원래 설치형 라이브러리가 아니라 **폴더째 복사(shadcn식) grab-bag**으로 운영되므로
(`registry/registry.json`에 컴포넌트별 의존성 명시, `npm run eject` 스크립트 제공),
"가져온다"의 실질적 의미를 다음으로 정의한다:

> **디자인 토큰(`dist/tokens.css`) + 각 컴포넌트의 스펙(variant, 마크업 구조, SCSS 스타일)을
> React 컴포넌트로 포팅**해서 `components/ui/` 하위에 둔다.

- Vue SFC의 `<template>`/`<style>`과 `*.types.ts`를 참조해 동일한 클래스·토큰·props 체계를 유지
- `@heroicons/vue` 의존 컴포넌트는 `@heroicons/react`로 대체 (신규 의존성 — 승인 필요)
- 애니메이션은 기존 framer-motion 재사용

## 변경 범위 — 교체 매핑

### A. 교체 대상 (my-ui 대응 존재)

| 현재 (ChildCare)                  | 사용 규모             | my-ui 대응                                          | 비고                          |
| --------------------------------- | --------------------- | --------------------------------------------------- | ----------------------------- |
| raw `<button>` / `.btn` 클래스    | 36곳 / 27곳           | `AppButton`, `AppIconButton`                        | 최다 빈도, 1순위              |
| `Skeleton`                        | 11개 파일             | `AppSkeleton`                                       | 단순 포팅                     |
| raw `<select>`                    | 9곳                   | `AppSelect` (+`AppDropdownMenu` 계열 componentDeps) |                               |
| raw `<input>` / `.input`·`.field` | 6곳 / 27곳            | `AppTextInput`                                      |                               |
| raw `<textarea>`                  | 3곳                   | `AppTextarea`                                       |                               |
| `ConfirmDialog`, `Modal`          | 3 + 2개 파일          | `AppModal`                                          | confirm 변형은 wrapper로 유지 |
| `Progress`                        | 4개 파일              | `AppLoadingProgress` / `AppPercentage`              |                               |
| `.chip`·`.tag`·`.chiprow` 클래스  | 4/3/3곳               | `AppChip`, `AppChipGroup`                           |                               |
| `Toast`                           | 2개 파일 (store 연동) | `AppToast` (+composable → hook 포팅)                | store 인터페이스 유지         |

### B. 보류 (비용 대비 판단 필요)

| 대상                                           | 이유                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| raw `<table>` 5곳 → `AppTable`                 | `@tanstack/vue-table`/`vue-virtual` 의존 — React 포팅 시 `@tanstack/react-table`로 사실상 재구현. 프로토타입 단계에선 과함 |
| date 입력 → `AppDatepicker`                    | 캘린더 로직 포팅 비용 큼. 네이티브 input 유지 권장                                                                         |
| `AppCheckbox`/`AppRadio`/`AppSwitch`/`AppTabs` | 현재 프로젝트에서 대응 사용처가 적거나 없음 — 필요 시점에 포팅                                                             |

### C. 유지 (my-ui에 대응 없음 — 도메인/프로토타입 특화)

`N`, `SpecBar`(명세 주석용), `PageHead`, `Notice`, `QueryError`, `Avatar`, `EmptyState`, `FadeIn`, `.card` 레이아웃

## 접근 방식 — 단계별

### Phase 0. 토큰 기반 마련

1. `~/design-system/dist/tokens.css` → `app/tokens.css`로 복사, `globals.css`에서 import
2. `tailwind.config.ts`의 색상·radius 등을 토큰 CSS 변수 참조로 연결 (기존 팔레트와 충돌 지점 정리)

### Phase 1. 고빈도·저위험 atom 포팅

- `AppButton`(+IconButton), `AppTextInput`, `AppTextarea`, `AppSelect`, `AppSkeleton`
- `components/ui/` 하위에 컴포넌트별 파일로 분리 (현 단일 `index.tsx`에서 점진 분할)
- 페이지별 치환: dashboard → journal → photos → 나머지 순 (빈도순)

### Phase 2. molecule/organism 포팅

- `AppModal` — 기존 `Modal`/`ConfirmDialog` API를 유지한 채 내부를 교체
- `AppToast` — composable을 React hook으로 옮기고 `lib/store.tsx`의 toast 상태와 연결
- `AppChip`/`AppChipGroup`, `AppLoadingProgress`

### Phase 3 (선택). 보류 항목 재평가

- `AppTable`, `AppDatepicker`, 선택 컨트롤류

## 검증 계획

- 각 Phase 종료 시 `npm run lint && npm run build`
- 교체한 페이지 육안 확인 (MSW 목 데이터 기준 주요 플로우)
- 기존 클래스(`.btn` 등) 제거 후 `globals.css`의 사장 스타일 정리는 마지막에 일괄

## 미해결 질문

1. **접근 방식 확정**: (a) 컴포넌트 React 포팅(본 계획) vs (b) 토큰·스타일만 채택하고 컴포넌트는 현행 유지 — b는 비용이 1/4 수준
2. `@heroicons/react` 신규 의존성 추가 허용 여부 (팀 룰: 새 라이브러리 추가 전 확인)
3. Phase 3(AppTable 등) 포함 여부 — 프로토타입 단계에서는 제외 권장
