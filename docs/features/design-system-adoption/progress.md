# Progress — 공통 UI를 my-ui 디자인 시스템으로 교체

- 시작일: 2026-07-20
- 계획: [plan.md](./plan.md)

## 확정된 결정

plan.md "미해결 질문"에 대한 답:

1. **접근 방식**: (a) 컴포넌트 React 포팅 — Vue SFC의 template/style과 `*.types.ts`를
   참조해 동일한 클래스·토큰·props 체계로 `components/ui/` 하위에 포팅
2. **`@heroicons/react`** 신규 의존성 추가 허용
3. **Phase 3**(AppTable, AppDatepicker, 선택 컨트롤류)는 이번 범위에서 제외

### 추가 결정 — 팔레트 충돌 (Phase 0 착수 전 확인)

plan.md Phase 0-2의 "기존 팔레트와 충돌 지점 정리"가 어느 쪽을 기준으로 할지
정하지 않아 확인했고, **"그린 유지 + DS 구조 채택"**으로 결정.

- 충돌 내용: my-ui primary는 인디고(`#4f68e7`)인데 이 앱의 정체성은
  그린(`#2E7D52`)이고, globals.css의 약 40개 규칙(`.nav-item.active`, `.chip.on`,
  `.metric.hero`, `.flowrail`, `.toggle`, `.photo.sel`, `.tl` 등)이 이미 그린을 씀.
  이들은 plan.md "C. 유지" 목록이라 건드리지 않으므로, 토큰을 그대로 채택하면
  한 화면에 인디고와 그린이 공존하게 됨.
- 결정: `app/tokens.css`(DS 원본)는 손대지 않고 `app/tokens.brand.css`에서
  브랜드 색상 토큰만 덮어씀. DS의 radius·typography·size·state 머신은 원본 사용.

## Phase 0 — 토큰 기반 마련 ✅

- `~/design-system/dist/tokens.css` → `app/tokens.css` **원본 그대로 복사** (530줄, 무수정)
- `app/tokens.brand.css` 신규 — 브랜드 오버라이드
  - primary ramp → 그린 (`--green*` 계열에서 파생, 100/500/700 = soft/green/deep)
  - error ramp → 코랄 (`.btn.danger`·`.notice.warn`·`.check.miss`와 맞춤)
  - item-selected / control-checked / focus ring → 그린
  - **secondary·grayblue·gray·info는 DS 원본 유지** — 이 앱의 브랜드 색이 아님
- `app/globals.css` 최상단에서 두 파일 `@import` (원본 → 오버라이드 순)
- `tailwind.config.ts` `borderRadius`를 `--radius-*` 토큰 참조로 치환

### 판단한 것

- **`rounded-xl`/`rounded-2xl`은 토큰에 연결하지 않음.** Tailwind 기본값은
  12/16px인데 DS 토큰은 20/24px이라, 연결하면 `.notice`·`.modal`·`.photo`·
  `.draftbox`·`.mcell`·`.btn.big` 등 기존 사용처의 모서리가 조용히 커짐.
  sm/md/lg는 기존 값과 토큰이 8/12/16px로 동일해 안전하게 치환됨.
- error ramp를 코랄로 오버라이드한 건 "그린 유지" 결정의 연장선으로 판단.
  코랄도 프로젝트 브랜드 색(`.btn.danger` 등)이므로 DS 빨강(`#e03131`)을
  그대로 쓰면 같은 종류의 불일치가 생김.

### 검증

`npm run lint` 통과, `npm run build` 성공(16 페이지).
빌드 CSS에서 `--semantic-action-background-primary-solid-default`가
`#4f68e7` → `#2e7d52` 순으로 들어가 오버라이드가 이기는 것 확인.

### 열어둔 질문

- **중립 텍스트 색상**: DS의 `--semantic-control-foreground-content-default`는
  슬레이트(`#475569`)인데 프로젝트 ink는 `#1F2A21`, muted는 `#68746C`(웜 그레이).
  포팅한 인풋의 본문 텍스트가 미세하게 차가워짐. Phase 1에서 실제 렌더를 보고
  오버라이드할지 판단 예정 — 지금은 DS 값 유지.
