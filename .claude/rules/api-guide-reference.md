---
paths:
  - 'src/features/**'
  - 'src/entities/**'
  - 'src/app/mocks/**'
  - 'src/pages/**'
  - 'docs/features/**/api-mapping.md'
---

# API Guide 참조 규칙

페이지나 기능 개발을 시작할 때 프로젝트의 API 가이드 문서를 먼저 확인합니다.

API 가이드 위치는 `.claude/project.config.md`의 `API_GUIDE_PATH` 값을 따릅니다.

## 확인 항목

1. 화면 진입 시 호출 API
2. 사용자 액션과 API 매핑
3. 공통 파라미터 규칙
4. error code와 화면 처리 방식
5. 설계 근거와 예외 케이스

## 로컬 캐시

긴 API 문서를 매번 통째로 읽어야 한다면 `docs/features/{feature}/api-mapping.md`에 요약 캐시를 둡니다.

캐시에는 원본 포인터, 마지막 동기화 날짜, 진입 API, 액션 매핑, error code를 포함합니다.

원본과 캐시가 충돌하면 원본을 우선합니다.
