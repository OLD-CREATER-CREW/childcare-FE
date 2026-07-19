import { http, HttpResponse, delay } from "msw";
import * as db from "@/lib/data/mock";
import type { DocType } from "@/lib/types";

/**
 * MSW 핸들러 — EP-001~031 목 구현.
 * 백엔드가 준비되면 NEXT_PUBLIC_USE_MOCK=false로 끄고 실제 API를 호출합니다.
 */
export const handlers = [
  // EP-001 로그인
  http.post("/api/auth/login", async () => {
    await delay(500);
    return HttpResponse.json(db.loginResponse);
  }),

  // EP-004 아동 목록
  http.get("/api/children", async () => {
    await delay(300);
    return HttpResponse.json(db.children);
  }),

  // EP-008 기록 현황
  http.get("/api/records/summary", async () => {
    await delay(300);
    return HttpResponse.json(db.recordSummary);
  }),

  // EP-007 하루 기록 저장
  http.post("/api/records", async () => {
    await delay(400);
    return HttpResponse.json({ ok: true });
  }),

  // EP-010 문서 초안
  http.get("/api/documents/draft", async ({ request }) => {
    await delay(350);
    const type = (new URL(request.url).searchParams.get("type") ??
      "notice") as DocType;
    const draft = db.documentDrafts[type];
    if (!draft) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(draft);
  }),

  // EP-012 알림장 검토 대기열
  http.get("/api/documents/notices/queue", async () => {
    await delay(300);
    return HttpResponse.json(db.noticeQueue);
  }),

  // EP-013 작업본 저장
  http.put("/api/documents/working", async () => {
    await delay(200);
    return HttpResponse.json({ ok: true });
  }),

  // EP-014 확정
  http.post("/api/documents/confirm", async () => {
    await delay(400);
    return HttpResponse.json({ ok: true });
  }),

  // EP-015 발송 (알림장만)
  http.post("/api/documents/send", async () => {
    await delay(400);
    return HttpResponse.json({ ok: true });
  }),

  // EP-016 사진 업로드
  http.post("/api/photos/upload", async () => {
    await delay(300);
    return HttpResponse.json({ ok: true });
  }),

  // EP-017 사진함 조회
  http.get("/api/photos", async () => {
    await delay(300);
    return HttpResponse.json(db.photoInbox);
  }),

  // EP-019 사진 발송
  http.post("/api/photos/send", async ({ request }) => {
    await delay(400);
    const { ids } = (await request.json()) as { ids: number[] };
    return HttpResponse.json({ sent: ids.length });
  }),

  // EP-005 관찰·발달영역
  http.get("/api/observations", async () => {
    await delay(300);
    return HttpResponse.json(db.observationData);
  }),

  // EP-024 · EP-006 상담
  http.get("/api/consults/current", async () => {
    await delay(300);
    return HttpResponse.json(db.consultData);
  }),
  http.post("/api/consults/confirm", async () => {
    await delay(400);
    return HttpResponse.json({ ok: true });
  }),

  // EP-026 평가제 체크리스트
  http.get("/api/checklist", async () => {
    await delay(300);
    return HttpResponse.json(db.checklistData);
  }),

  // EP-028 지표 대시보드
  http.get("/api/metrics/summary", async () => {
    await delay(350);
    return HttpResponse.json(db.metricsSummary);
  }),

  // EP-029 ~ EP-031 설정
  http.get("/api/settings", async () => {
    await delay(200);
    return HttpResponse.json(db.appSettings);
  }),
  http.post("/api/settings/replay", async () => {
    await delay(200);
    return HttpResponse.json({ ok: true });
  }),
  http.post("/api/settings/seed", async () => {
    await delay(600);
    return HttpResponse.json({ ok: true });
  }),
];
