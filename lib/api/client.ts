/**
 * 네이티브 fetch 래퍼 — 의존성 0.
 * 명세서(final_API_명세서.md) 1절 규약을 그대로 따른다:
 *  - 모든 경로는 `/api`로 시작한다.
 *  - 인증은 HttpOnly 세션 쿠키 → 모든 요청에 `credentials: "include"`.
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    // 세션 쿠키 인증(명세 1.2) — 실 백엔드가 다른 오리진이어도 쿠키를 함께 보낸다.
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

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
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};
