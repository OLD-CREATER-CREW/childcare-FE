---
name: organize-imports
description: Import 정리 - 미사용 제거, 그룹 정렬 (외부 라이브러리 → FSD 역순 → 상대경로), 알파벳순
argument-hint: '<file-path>'
---

# Import 정리

대상 파일: $ARGUMENTS

## 정리 규칙

### 1. 미사용 import 제거

- 파일 내에서 사용되지 않는 import를 제거한다
- `<template>`, `<script>`, `<style>` 모두 확인하여 실제 사용 여부를 판단한다
- auto-import 대상(vue, vue-router API, 컴포넌트 등)은 import 자체가 불필요하므로 제거한다

### 2. 그룹 정렬 (빈 줄로 그룹 구분)

아래 순서로 import 그룹을 정렬한다. 각 그룹 사이에 빈 줄 1개를 넣는다.

```
① 외부 라이브러리    (vue, @tanstack, @vueuse, lodash, dayjs 등 node_modules)
② type import        (import type { ... } from ...)
③ FSD 역순 절대경로  (pages → widgets → features → entities → shared)
④ 상대경로           (같은 모듈 내부의 ./  ../ — 가능하면 @/ 절대경로로 변환)
```

### 3. FSD 레이어 역순 (③ 내부 정렬)

상위 레이어(가까운 의존)를 먼저 배치한다:

```
@/pages/
@/widgets/
@/features/
@/entities/
@/shared/
```

### 4. 그룹 내 알파벳순

- 각 그룹 내에서 import 경로(from 뒤)를 기준으로 알파벳순 정렬한다

### 5. 상대경로 → 절대경로 변환

- `./` 또는 `../` 로 시작하는 상대경로 import를 `@/` 절대경로로 변환한다
- 파일의 현재 위치를 기준으로 올바른 `@/` 경로를 계산한다
- 단, 같은 디렉토리 내의 import (예: 같은 모듈 내부의 `./index`, `./utils`)는 상대경로를 유지해도 된다

### 6. type import 처리

- `import type { ... }` 은 ② type import 그룹으로 분리한다
- 단, 같은 모듈에서 value와 type을 함께 가져오는 경우 `import { type Foo, bar }` 인라인 형태도 허용한다

## 정리 예시

**Before:**

```typescript
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { getReportList } from '@/entities/report/api/report.api'
import AppButton from '@/shared/ui/atoms/AppButton/AppButton.vue'
import { useReportStore } from '@/entities/report/model/report.store'
import { formatDate } from '@/shared/lib/date'
import type { Report } from '@/entities/report/model/report.type'
import { useCampaignQuery } from '@/features/campaign-report/model/useCampaignQuery'
import dayjs from 'dayjs'
import { computed } from 'vue'
```

**After:**

```typescript
import dayjs from 'dayjs'

import type { Report } from '@/entities/report/model/report.type'

import { useCampaignQuery } from '@/features/campaign-report/model/useCampaignQuery'
import { getReportList } from '@/entities/report/api/report.api'
import { useReportStore } from '@/entities/report/model/report.store'
import { formatDate } from '@/shared/lib/date'
```

> `ref`, `computed`, `useRoute`, `AppButton`은 auto-import 대상이므로 제거됨

## 주의사항

- `<script setup>` 블록의 import만 정리 대상이다
- side-effect import (`import './style.css'`)는 순서를 변경하지 않고 최하단에 유지한다
- 정리 후 변경 사항을 diff로 보여준다
