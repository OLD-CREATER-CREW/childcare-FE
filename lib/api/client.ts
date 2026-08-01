/**
 * 네이티브 fetch 래퍼 — 의존성 0.
 * 명세서(final_API_명세서.md) 1절 규약을 그대로 따른다:
 *  - 모든 경로는 `/api`로 시작한다.
 *  - 인증은 액세스 JWT(15분) + 리프레시 토큰(12시간) 2단 구조이며, 전달은
 *    `Authorization: Bearer` 헤더다(명세 r11 1.2). 쿠키를 쓰지 않는다.
 *  - 오류는 `{ "error": { "code", "message" } }` 한 형식.
 *  - 목록은 `{ "items": [...], "total": n }` 봉투(unwrap은 seam에서).
 *
 * NEXT_PUBLIC_API_BASE_URL이 비어 있으면 same-origin `/api/*` 요청이 되고,
 * NEXT_PUBLIC_USE_MOCK=true면 MSW 서비스워커가 가로챈다.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** 명세 1.4 오류 응답 규약 — code는 분기용 영문 상수, message는 화면 표시용 한글 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type SpecErrorBody = { error?: { code?: string; message?: string } };

// ---------- 토큰 보관 (명세 1.2.3 ②) ----------
//
// 액세스 토큰은 **메모리에만** 둔다 — 새로고침하면 사라지지만 리프레시로 즉시
// 복구되고, 디스크에 남기지 않으면 유출 경로가 하나 줄어든다.
// 리프레시 토큰만 localStorage에 영속 저장한다(새로고침·앱 재시작을 넘겨야 함).

const REFRESH_KEY = "childcare.refresh_token";

let accessToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export const tokenStore = {
  get access() {
    return accessToken;
  },
  get refresh(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  setAccess(token: string) {
    accessToken = token;
  },
  setRefresh(token: string) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(REFRESH_KEY, token);
    } catch {
      /* 저장 실패해도 이 탭이 살아 있는 동안은 메모리 토큰으로 동작 */
    }
  },
  clear() {
    accessToken = null;
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* noop */
    }
  },
  /** 갱신까지 실패해 되살릴 수 없을 때 호출된다 — 화면을 로그인으로 돌린다 */
  onSessionExpired(handler: (() => void) | null) {
    sessionExpiredHandler = handler;
  },
};

// ---------- 401 자동 갱신 (명세 1.2.3 ④) ----------

/** EP-050 응답 — 리프레시 토큰은 회전하지 않으므로 access만 온다 */
type RefreshResponse = { access_token: string };

// 진행 중인 갱신을 공유한다: 화면 하나가 API를 3개 동시에 부르면 401도 3개가
// 오는데, 그때마다 갱신하면 refresh가 3번 나간다.
let refreshing: Promise<boolean> | null = null;

/** 저장된 리프레시 토큰으로 액세스 토큰을 새로 받는다. 성공 여부를 돌려준다. */
export function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = tokenStore.refresh;
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as RefreshResponse;
      if (!body?.access_token) return false;
      tokenStore.setAccess(body.access_token);
      return true;
    } catch {
      // 네트워크 오류는 "세션 만료"가 아니다 — 토큰을 지우지 않는다.
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

type RequestOptions = {
  /** 인증 배관 자체(로그인·가입·갱신)는 헤더도 재시도도 붙이지 않는다 */
  skipAuth?: boolean;
};

async function request<T>(
  path: string,
  init?: RequestInit,
  opts?: RequestOptions,
): Promise<T> {
  const call = () =>
    fetch(`${BASE_URL}/api${path}`, {
      // 쿠키를 쓰지 않으므로 credentials도 쓰지 않는다(명세 r11 1.2) — 그래서
      // 서버의 `Access-Control-Allow-Origin: *`가 그대로 동작한다.
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
        ...(!opts?.skipAuth && accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
    });

  let res = await call();

  // 401이면 갱신을 한 번 시도하고 원래 요청을 **한 번만** 재시도한다.
  // 갱신 후에도 401이면 토큰 문제가 아니므로(계정 잠금 등) 로그인 화면으로 보낸다.
  if (res.status === 401 && !opts?.skipAuth) {
    const renewed = await refreshAccessToken();
    if (!renewed) {
      tokenStore.clear();
      sessionExpiredHandler?.();
    } else {
      res = await call();
      if (res.status === 401) {
        tokenStore.clear();
        sessionExpiredHandler?.();
      }
    }
  }

  if (!res.ok) {
    let code = "INTERNAL_ERROR";
    let message = `${init?.method ?? "GET"} ${path} → ${res.status}`;
    try {
      const body = (await res.json()) as SpecErrorBody;
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* 본문이 JSON이 아니어도 기본 메시지로 둔다 */
    }
    throw new ApiError(res.status, code, message);
  }

  // 204 No Content 등 본문이 없는 성공 응답 방어
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** 명세 5절: 목록 응답 봉투 */
export type ListEnvelope<T> = { items: T[]; total: number };

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(
      path,
      {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      opts,
    ),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(
      path,
      {
        method: "PUT",
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      opts,
    ),
  /** 부분 수정 — EP-041·EP-046. 보내지 않은 키는 그대로 두는 것이 명세 규약이다 */
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(
      path,
      {
        method: "PATCH",
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      opts,
    ),
  /** 소프트 삭제 — EP-042(퇴소)·EP-047(계정 잠금). 행을 지우지 않는다 */
  del: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(
      path,
      {
        method: "DELETE",
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      opts,
    ),
};
