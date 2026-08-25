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

import type { SpecRefresh } from "@/lib/api/spec";

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
/**
 * 갱신 결과는 세 가지로 갈린다 — **이 구분이 없으면 와이파이 순단 한 번에
 * 12시간짜리 리프레시 토큰이 지워진다.** 명세 EP-050은 `401`일 때만 저장한
 * 토큰을 지우라고 규정한다.
 *
 * - `ok`         — 새 액세스 토큰을 받았다
 * - `expired`    — 401. 되살릴 수 없으므로 토큰을 버리고 로그인 화면으로
 * - `unavailable`— 네트워크 오류·5xx. 서버가 잠깐 없는 것이지 세션이 끝난 게 아니다
 */
export type RefreshOutcome = "ok" | "expired" | "unavailable";

// 진행 중인 갱신을 공유한다: 화면 하나가 API를 3개 동시에 부르면 401도 3개가
// 오는데, 그때마다 갱신하면 refresh가 3번 나간다.
let refreshing: Promise<RefreshOutcome> | null = null;

/** 저장된 리프레시 토큰으로 액세스 토큰을 새로 받는다(명세 EP-050). */
export function refreshAccessToken(): Promise<RefreshOutcome> {
  refreshing ??= (async (): Promise<RefreshOutcome> => {
    const refreshToken = tokenStore.refresh;
    // 애초에 토큰이 없으면 갱신할 것이 없다 — 만료와 같은 취급이다.
    if (!refreshToken) return "expired";
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (res.status === 401) return "expired";
      if (!res.ok) return "unavailable";
      const body = (await res.json()) as SpecRefresh;
      if (!body?.access_token) return "unavailable";
      tokenStore.setAccess(body.access_token);
      return "ok";
    } catch {
      // 네트워크 오류는 "세션 만료"가 아니다 — 토큰을 지우지 않는다.
      return "unavailable";
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** 갱신 실패로 세션이 끝났을 때의 뒷정리 — 토큰을 버리고 화면에 알린다 */
function endSession() {
  tokenStore.clear();
  sessionExpiredHandler?.();
}

type RequestOptions = {
  /** 인증 배관 자체(로그인·가입·갱신)는 헤더도 재시도도 붙이지 않는다 */
  skipAuth?: boolean;
};

/**
 * 인증·갱신·오류 변환까지 마친 `Response`를 그대로 돌려준다.
 *
 * 대부분의 응답은 JSON이라 `request()`가 감싸지만, EP-036(완성 문서 파일
 * 다운로드)만은 **JSON이 아니라 파일 바이너리 스트림**이다. 본문을 어떻게 읽을지
 * 만 호출측에 맡기고, 401 재시도·오류 규약은 한 곳에서 지킨다.
 */
async function rawRequest(
  path: string,
  init?: RequestInit,
  opts?: RequestOptions,
): Promise<Response> {
  // 이 요청이 어느 토큰으로 나갔는지 기억해 둔다. 401을 받았을 때 그 사이에
  // 다른 요청이 이미 갱신했다면 또 갱신할 이유가 없다(명세 1.2.3 ④ "갱신은 한 번만").
  let sentWith: string | null = null;

  // multipart 요청(EP-016 사진·EP-007 음성 등)은 Content-Type을 직접 넣으면
  // 안 된다 — boundary는 fetch가 FormData를 보고 만들어 붙인다.
  const isMultipart = init?.body instanceof FormData;

  const call = () => {
    sentWith = accessToken;
    return fetch(`${BASE_URL}/api${path}`, {
      // 쿠키를 쓰지 않으므로 credentials도 쓰지 않는다(명세 r11 1.2) — 그래서
      // 서버의 `Access-Control-Allow-Origin: *`가 그대로 동작한다.
      ...init,
      headers: {
        ...(isMultipart ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
        ...(!opts?.skipAuth && accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
    });
  };

  let res = await call();

  // 401이면 갱신을 한 번 시도하고 원래 요청을 **한 번만** 재시도한다.
  // 갱신 후에도 401이면 토큰 문제가 아니므로(계정 잠금 등) 로그인 화면으로 보낸다.
  if (res.status === 401 && !opts?.skipAuth) {
    if (accessToken && accessToken !== sentWith) {
      // 내가 기다리는 동안 다른 요청이 갱신을 끝냈다 — 갱신 없이 재시도만 한다.
      res = await call();
      if (res.status === 401) endSession();
    } else {
      const outcome = await refreshAccessToken();
      if (outcome === "expired") {
        endSession();
      } else if (outcome === "ok") {
        res = await call();
        if (res.status === 401) endSession();
      }
      // "unavailable"이면 토큰을 남긴 채 원래 401을 그대로 던진다 —
      // 서버가 잠깐 없는 것이지 세션이 끝난 게 아니다(재접속하면 이어서 쓴다).
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

  return res;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  opts?: RequestOptions,
): Promise<T> {
  const res = await rawRequest(path, init, opts);
  // 204 No Content 등 본문이 없는 성공 응답 방어
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** 다운로드 한 건 — 파일 내용과 서버가 정한 파일명 */
export type DownloadedFile = { blob: Blob; filename: string };

/**
 * `Content-Disposition`에서 파일명을 뽑는다.
 *
 * 서버는 한글 파일명 때문에 RFC 5987 형식(`filename*=UTF-8''…`)으로 보낸다.
 * 예전 형식(`filename="…"`)도 함께 본다 — 프록시가 헤더를 바꿔 놓을 수 있다.
 */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* 인코딩이 깨졌으면 아래 평문 형식으로 넘어간다 */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
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
  /** 파일 업로드 — 명세 6.1 "파일 업로드는 multipart/form-data" (EP-016 등) */
  postForm: <T>(path: string, form: FormData, opts?: RequestOptions) =>
    request<T>(path, { method: "POST", body: form }, opts),
  /**
   * 파일 다운로드 — EP-036. 응답이 JSON이 아니라 바이너리다.
   *
   * 확장자는 **고정할 수 없다**: 서식을 채운 결과는 `.hwpx`, 평문 폴백은
   * `.docx`이고 Content-Type도 서버가 확장자로 갈라 준다(`docfill.media_type_for`).
   * 그래서 파일명도 우리가 짓지 않고 `Content-Disposition`에서 받아 쓴다.
   */
  getFile: async (
    path: string,
    opts?: RequestOptions,
  ): Promise<DownloadedFile> => {
    const res = await rawRequest(path, undefined, opts);
    return {
      blob: await res.blob(),
      filename:
        filenameFromDisposition(res.headers.get("Content-Disposition")) ??
        "document",
    };
  },
  /**
   * 만들면서 곧바로 파일을 받는 POST — 보육일지 생성(EP-010)이 쓴다.
   *
   * 그 문서는 화면 안의 검토 단계가 없어 응답이 JSON이 아니라 완성 한글 파일이다.
   * 만들어진 문서의 `document_id`는 바디에 실을 수 없어 `X-Document-Id` 헤더로
   * 온다(서버 CORS `expose_headers`에 등록돼 있어야 읽힌다).
   *
   * 오류는 여전히 JSON 봉투다 — `rawRequest`가 이미 `ApiError`로 바꿔 던지므로
   * 여기서 성공 응답만 다루면 된다.
   */
  postFile: async (
    path: string,
    body?: unknown,
    opts?: RequestOptions,
  ): Promise<DownloadedFile & { documentId: number | null }> => {
    const res = await rawRequest(
      path,
      {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      opts,
    );
    const id = Number(res.headers.get("X-Document-Id"));
    return {
      blob: await res.blob(),
      filename:
        filenameFromDisposition(res.headers.get("Content-Disposition")) ??
        "document",
      documentId: Number.isFinite(id) && id > 0 ? id : null,
    };
  },
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
