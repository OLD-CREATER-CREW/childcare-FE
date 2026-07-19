---
paths:
  - 'src/**/*.scss'
  - 'src/**/*.css'
  - 'src/**/*.vue'
  - 'src/**/tokens/**'
  - 'src/**/styles/**'
---

# 디자인 시스템 / 퍼블리싱 기준

디자인 시스템과 퍼블리싱 작업은 시각적 일관성과 재사용성을 우선합니다.

## 원칙

- 기존 token, variable, mixin, component API를 먼저 확인합니다.
- 하드코딩 값은 필요한 경우에만 사용하고 이유를 남깁니다.
- 공통 컴포넌트 변경은 variant, state, responsive 영향을 확인합니다.
- 접근성, 키보드 포커스, contrast를 함께 확인합니다.

## 검증

- 주요 viewport를 확인합니다.
- hover, active, disabled, loading, empty 상태를 확인합니다.
- Storybook이 있는 프로젝트는 관련 story 업데이트를 검토합니다.
