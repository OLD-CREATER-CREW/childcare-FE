# Project Config Example

이 파일을 `.claude/project.config.md`로 복사한 뒤 프로젝트에 맞게 채웁니다.

## Project

- PROJECT_NAME:
- PROJECT_DESCRIPTION:
- PROJECT_STACK:
- BASE_BRANCH: dev

## Jira

- JIRA_PROJECT_KEY:
- JIRA_DEFAULT_ISSUE_TYPE:
- JIRA_DEFAULT_ASSIGNEE_EMAIL:
- JIRA_SITE_URL: https://incross-platform.atlassian.net

## GitLab

- GITLAB_PROJECT_URL:
- GITLAB_USERNAME:
- DEFAULT_REVIEWER:
- DEFAULT_TARGET_BRANCH: dev
- STAGING_BRANCH: staging
- PRODUCTION_BRANCH: product

## Confluence

- CONFLUENCE_SPACE:
- TECH_DOC_PARENT_PAGE_ID:
- TEAM_GUIDE_PAGE_URL:

## API / Design References

- API_GUIDE_PATH:
- SWAGGER_URL:
- FIGMA_LIBRARY_URL:

## Project-specific Hooks

필요한 프로젝트에서만 활성화합니다.

- READONLY_EXTERNAL_PATHS:
- SENSITIVE_PATH_PATTERNS:
- TYPECHECK_COMMAND: npm run type-check
