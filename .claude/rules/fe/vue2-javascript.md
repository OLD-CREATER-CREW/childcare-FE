---
paths:
  - "src/**/*.vue"
  - "src/**/*.js"
---

# Frontend Convention (Vue 2 + JavaScript)

> **적용 대상**: Vue 2 + JS + Vuex + Webpack/Vue CLI
> **복사 시 파일명**: `fe-convention.md`

## Quick Rules

> 대표 규칙만. 상세·예외·근거는 본문 참조.

| 상황               | 수준     | 규칙                                 |
| ------------------ | -------- | ------------------------------------ |
| Vuex action 신규   | MUST     | async/await + try/catch              |
| Vuex state 변경    | MUST     | commit 경유 mutation                 |
| Props 정의 신규    | MUST     | 객체 형태 + type                     |
| SFC 블록 순서      | MUST     | template → script → style            |
| Component API      | MUST     | Options API (Composition API 금지)   |
| Vue 컴포넌트 mixin | MUST NOT | 신규 추가                            |
| 전역 이벤트 버스   | MUST NOT | 신규 사용                            |
| Emit 네이밍        | SHOULD   | 프로젝트 우세 스타일 따름            |
| API 팩토리 패턴    | 조건부   | 프로젝트에 있을 때만 유지            |
| 전역 CSS/SCSS      | SHOULD   | 우선 재사용, `<style scoped>` 예외적 |

## 핵심 철학

레거시 유지보수 + 카피베이스 관행 기반. 강제 도구는 Prettier뿐. **일관성 > 개별 코드의 우아함**.

1. **기존 파일 수정 시 그 파일의 기존 패턴 유지** — 이 convention보다 기존 파일 우선
2. **개선은 범위 제한** — 신규 파일/함수 단위에서만 본 문서 적용
3. **지나가다 리팩터링 금지** — 기능 수정 외 즉흥적 개선은 별도 MR
4. **부채 표시**: `// TODO: fe-convention 전환 필요 (JIRA-XXX)` 주석 추적

## 프로젝트 구조

프로젝트 CLAUDE.md에 구조 있으면 우선. 없으면:

```
src/
├── api/              # API 래퍼
├── components/
│   ├── common/       # 공통 컴포넌트 (재사용 우선)
│   └── <domain>/     # 도메인별 컴포넌트
├── config/
├── mixins/           # (신규 사용 지양)
├── router/
├── store/modules/
├── styles/           # 전역 CSS/SCSS
└── utils/            # 순수 유틸
```

## 상태 관리 (Vuex)

### 모듈 구조

- 위치: `src/store/modules/<module>.js`
- `namespaced: true` 기본
- `state / getters / mutations / actions` 분리

### Action 스타일 [MUST]

신규 action은 **async/await + try/catch**.

```js
// 권장 (신규)
async fetchCart({ commit }) {
  try {
    const res = await api.getCart()
    commit('SET_CART', res.data)
  } catch (e) {
    commit('SET_ERROR', e)
  }
}
```

**근거**: 레거시에 `.then()` 혼재라 "기존 따라" 무의미. 에러 핸들링 명시적.

### State 직접 수정 금지 [MUST]

state 변경은 **반드시 commit 경유**. 기존 `state.xxx = ...`는 TODO 부채 표시.

```js
// 지양 — state.cartLoading = true (직접 수정)
// 권장 — commit('SET_CART_LOADING', true)
```

**근거**: Vuex devtools 타임트래블·상태 추적.

### API 팩토리 패턴 [조건부]

`createXxxApiStore` 류 팩토리가 **프로젝트에 이미 있으면** 유지. 없는 프로젝트에는 **신규 도입 금지** (프로젝트별 자산).

```js
const apiStore = createXxxApiStore([
  { action: "_getMemberCart", path: "v4/members/carts", method: "get" },
]);
export default {
  namespaced: true,
  state: {
    /* ... */
  },
  mixins: [apiStore], // 팩토리 주입
  actions: {
    /* 비즈니스 로직 */
  },
};
```

## 컴포넌트 (Vue 2)

### API: Options API [MUST]

Composition API 플러그인 도입 금지.

### SFC 블록 순서 [MUST]

`<template>` → `<script>` → `<style>` (또는 `<style scoped>`)

### Props 정의 [MUST]

신규는 **객체 형태 + type/required/default**.

```js
// 지양 — props: ['productId', 'title']  (검증 없음)
// 권장
props: {
  productId: { type: [String, Number], required: true },
  title: { type: String, default: '' }
}
```

**근거**: Vue 공식 Style Guide Priority B. 타입 안정성.

### Emit 이벤트 네이밍 [SHOULD]

**프로젝트 우세 스타일** 따름 (camelCase 또는 kebab-case).

- 각 프로젝트 `.claude/CLAUDE.md`에 명시된 기준 우선
- 명시 없으면 기존 `$emit` 샘플링 후 우세 스타일 채택

**경향 (참고)**: admin/POC/레거시는 kebab 경향, 일부 모바일 웹은 camel 경향.

**근거**: Vue 공식 kebab-case 권장 근거(DOM template 이슈)는 .vue SFC 환경에선 해당 없음. 프로젝트별 우세 스타일이 정반대라 범용 고정 불가.

### Mixins [MUST NOT]

**Vue 컴포넌트 mixin 신규 추가 금지.** 기존 mixin은 건드릴 때 유지(갑작스러운 제거 금지).

공통 로직은 `utils/` 또는 `components/common/`으로 분리. 예외: Vuex 팩토리 주입용 mixin(`createXxxApiStore`)은 유지.

**근거**: prop/data/method 출처 추적 어려움, 충돌 위험.

### 전역 이벤트 버스 [MUST NOT]

`$bus.$emit`, `EventBus`, `eventBus` 류 **신규 사용 금지**. 부모-자식은 props/emit, 원거리 통신은 Vuex.

```js
// 지양 — main.js: Vue.prototype.$bus = new Vue()
// 지양 — this.$bus.$emit('cartUpdated', data)
// 권장 — Vuex mutation/action 사용
```

**근거**: 이벤트 발생 지점 추적 불가.

## 스타일링 [SHOULD]

- **전역 CSS/SCSS 우선 재사용** (`src/styles/`)
- 퍼블리셔 전달 스타일 수정 자제 → 필요 시 사용자 확인
- `<style scoped>` 예외적으로만
- **기존 클래스명 패턴 유지** — 카멜/스네이크 혼재해도 기존 파일 따름

## 파일/폴더 네이밍

| 대상                 | 규칙       | 예시                      |
| -------------------- | ---------- | ------------------------- |
| Vue 컴포넌트         | PascalCase | `ProductInfo.vue`         |
| JS (utils/api/store) | camelCase  | `priceFormat.js`          |
| 도메인 폴더          | 기존 관행  | 예: `product/`, `order/`  |
| Vuex 모듈            | camelCase  | 예: `product`, `userAuth` |

## Import

- `@/` alias로 absolute import
- auto-import 없음 → **모두 명시적**
- 순서 [MAY]: Vue/외부 → `@/` 내부 → 상대 경로

## API 호출 패턴 [MUST]

```
컴포넌트 → Vuex action → src/api/ 래퍼 → 서버
```

컴포넌트에서 axios 직접 호출 지양. 에러 핸들링은 action의 try/catch에서.

## ESLint / Prettier

- **Prettier 저장 시 자동 포맷** [MUST]
- ESLint 완화: `vue/multi-word-component-names` OFF, `no-debugger` 프로덕션만 에러
- **신규 ESLint 룰 추가 [MAY NOT]** — 카피베이스 관행상 파편화 유발
