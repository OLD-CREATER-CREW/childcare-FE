import { http, HttpResponse, delay } from "msw";
import * as db from "@/mocks/db";
import type { DailyRecordInput, DevelopmentDomain, DocType } from "@/lib/types";

type TemplateMap = Partial<Record<DocType, string>>;

/**
 * MSW 핸들러 — 상태형 DB(mocks/db.ts) 위에서 실제 API처럼 동작합니다.
 * 백엔드가 준비되면 NEXT_PUBLIC_USE_MOCK=false로 끄고 실제 API를 호출합니다.
 */
export const handlers = [
  // EP-001 로그인
  http.post("/api/auth/login", async () => {
    await delay(600);
    return HttpResponse.json({
      token: "mock-token",
      teacher: {
        name: db.TEACHER_NAME,
        role: "담임",
        className: db.CLASS_NAME,
      },
    });
  }),

  // EP-004 아동 목록
  http.get("/api/children", async () => {
    await delay(250);
    return HttpResponse.json(db.getChildren());
  }),

  // EP-008 기록 현황
  http.get("/api/records/summary", async () => {
    await delay(200);
    return HttpResponse.json(db.getSummary());
  }),

  // EP-007-B 하루 기록 단건 조회 (수정 모드 진입)
  http.get("/api/records", async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const childId = url.searchParams.get("child") ?? "";
    const date = url.searchParams.get("date") ?? db.TODAY;
    return HttpResponse.json({ record: db.getRecord(childId, date) });
  }),

  // EP-007 하루 기록 저장
  http.post("/api/records", async ({ request }) => {
    await delay(450);
    const input = (await request.json()) as DailyRecordInput;
    db.saveRecord(input);
    return HttpResponse.json({ ok: true });
  }),

  // EP-010 문서 초안 조회·(재)생성
  http.get("/api/documents/draft", async ({ request }) => {
    const url = new URL(request.url);
    const type = (url.searchParams.get("type") ?? "notice") as DocType;
    const childId = url.searchParams.get("child");
    const regenerate = url.searchParams.get("regen") === "1";
    await delay(regenerate ? 1100 : 400);
    const draft = db.getDraft(type, childId, regenerate);
    if (!draft) {
      return HttpResponse.json(
        { message: "하루 기록이 없어 초안을 만들 수 없습니다" },
        { status: 404 },
      );
    }
    return HttpResponse.json(draft);
  }),

  // EP-012 알림장 검토 대기열
  http.get("/api/documents/notices/queue", async () => {
    await delay(250);
    return HttpResponse.json(db.getNoticeQueue());
  }),

  // EP-011 알림장 초안 일괄 생성 — 기록 있는 아이 전원 파생 (확정은 아이별)
  http.post("/api/documents/notices/generate-all", async () => {
    await delay(900);
    return HttpResponse.json(db.generateAllNotices());
  }),

  // EP-013 작업본 저장 (디바운스 자동 저장)
  http.put("/api/documents/working", async ({ request }) => {
    await delay(150);
    const { type, childId, content } = (await request.json()) as {
      type: DocType;
      childId: string | null;
      content: string;
    };
    return HttpResponse.json({ ok: db.saveWorking(type, childId, content) });
  }),

  // EP-014 확정 — 편집거리 박제
  http.post("/api/documents/confirm", async ({ request }) => {
    await delay(500);
    const { type, childId, content } = (await request.json()) as {
      type: DocType;
      childId: string | null;
      content: string;
    };
    const doc = db.confirmDoc(type, childId, content);
    if (!doc) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(doc);
  }),

  // EP-015 발송 (알림장만 · 확정 전 발송 불가)
  http.post("/api/documents/send", async ({ request }) => {
    await delay(500);
    const { type, childId } = (await request.json()) as {
      type: DocType;
      childId: string | null;
    };
    const status = db.sendDoc(type, childId);
    if (!status) {
      return HttpResponse.json(
        { message: "확정 전에는 발송할 수 없습니다" },
        { status: 409 },
      );
    }
    return HttpResponse.json({ ok: true });
  }),

  // EP-016 사진 업로드 — 즉시 응답, 배경 분류 시작
  http.post("/api/photos/upload", async () => {
    await delay(350);
    const added = db.uploadPhotos(3);
    return HttpResponse.json({ ok: true, added });
  }),

  // EP-017 사진함 조회 — 폴링마다 분류가 한 장씩 진행
  http.get("/api/photos", async () => {
    await delay(250);
    db.tickClassification();
    return HttpResponse.json(db.getPhotoInbox());
  }),

  // EP-018 아이 수동 지정
  http.post("/api/photos/assign", async ({ request }) => {
    await delay(300);
    const { photoId, childId } = (await request.json()) as {
      photoId: number;
      childId: string;
    };
    return HttpResponse.json({ ok: db.assignPhoto(photoId, childId) });
  }),

  // EP-019 사진 발송
  http.post("/api/photos/send", async ({ request }) => {
    await delay(450);
    const { ids } = (await request.json()) as { ids: number[] };
    return HttpResponse.json({ sent: db.sendPhotos(ids) });
  }),

  // EP-005 관찰·발달영역
  http.get("/api/observations", async ({ request }) => {
    await delay(300);
    const childId = new URL(request.url).searchParams.get("child") ?? "c01";
    return HttpResponse.json(db.getObservations(childId));
  }),

  // EP-009 태그 수정 — manual_tag 표시, 자동 태깅이 덮어쓰지 않음
  http.post("/api/observations/tag", async ({ request }) => {
    await delay(250);
    const { id, tag } = (await request.json()) as {
      id: string;
      tag: DevelopmentDomain | null;
    };
    const entry = db.updateObservationTag(id, tag);
    if (!entry) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(entry);
  }),

  // EP-020 관찰 기록 직접 추가 — 교사 직접 입력 (태그 선택 시 수동 태그 박제)
  http.post("/api/observations", async ({ request }) => {
    await delay(350);
    const { childId, tag, memo } = (await request.json()) as {
      childId: string;
      tag: DevelopmentDomain | null;
      memo: string;
    };
    const entry = db.addObservation(childId, tag, memo);
    if (!entry) return new HttpResponse(null, { status: 400 });
    return HttpResponse.json(entry);
  }),

  // EP-024 · EP-006 상담 조회
  http.get("/api/consults", async ({ request }) => {
    await delay(300);
    const childId = new URL(request.url).searchParams.get("child") ?? "c01";
    return HttpResponse.json(db.getConsults(childId));
  }),

  // EP-025 상담 확정
  http.post("/api/consults/confirm", async ({ request }) => {
    await delay(450);
    const { id, summary } = (await request.json()) as {
      id: string;
      summary: string;
    };
    return HttpResponse.json({ ok: db.confirmConsult(id, summary) });
  }),

  // EP-026 평가제 체크리스트 — 조회 시마다 실데이터 재집계
  http.get("/api/checklist", async () => {
    await delay(300);
    return HttpResponse.json(db.getChecklist());
  }),

  // EP-028 지표 대시보드
  http.get("/api/metrics/summary", async () => {
    await delay(350);
    return HttpResponse.json(db.getMetrics());
  }),

  // EP-029 ~ EP-031 설정
  http.get("/api/settings", async () => {
    await delay(150);
    return HttpResponse.json(db.getSettings());
  }),
  http.post("/api/settings/replay", async ({ request }) => {
    await delay(200);
    const { on } = (await request.json()) as { on: boolean };
    db.setReplayMode(on);
    return HttpResponse.json({ ok: true });
  }),
  http.post("/api/settings/seed", async () => {
    await delay(700);
    db.reseed();
    return HttpResponse.json({ ok: true });
  }),

  // EP-032 로컬 양식 동기화 — 렌더러가 노트북 폴더에서 읽은 서식을 반영
  http.post("/api/templates", async ({ request }) => {
    await delay(150);
    const { templates } = (await request.json()) as { templates: TemplateMap };
    db.setTemplates(templates ?? {});
    return HttpResponse.json({
      ok: true,
      applied: Object.keys(templates ?? {}),
    });
  }),
];
