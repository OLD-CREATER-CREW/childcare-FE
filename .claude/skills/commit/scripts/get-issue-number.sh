#!/bin/bash

# 현재 브랜치명에서 GitHub 이슈 번호를 추출합니다.
# 브랜치명 형식: {prefix}/{이슈번호}-{설명}
# 예: feature/23-login-page → 23
#     fix/45-token-error    → 45
#     hotfix/67-null-error  → 67

BRANCH=$(git branch --show-current)

# {prefix}/{숫자}-{설명} 패턴에서 숫자 추출
# prefix 제거 후 선행 숫자만 추출하여 오탐 방지
ISSUE_NUMBER=$(echo "$BRANCH" | sed 's|.*/||' | grep -oE '^[0-9]+')

if [ -z "$ISSUE_NUMBER" ]; then
  echo ""
  exit 1
fi

echo "$ISSUE_NUMBER"
