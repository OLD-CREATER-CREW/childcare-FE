import { http, HttpResponse, delay } from "msw";
import * as db from "@/mocks/db";
import {
  childIdToInt,
  consultIdToInt,
  decodeSpecRecord,
  docTypeFromSpec,
  domainFromSpec,
  domainToSpec,
  intToChildId,
  intToConsultId,
  intToRecordId,
  recordIdToInt,
  summaryFromSpec,
  summaryToSpec,
} from "@/lib/api/spec";
import type {
  SpecChild,
  SpecChildDetail,
  SpecConsult,
  SpecDocType,
  SpecDocument,
  SpecDomain,
  SpecPhoto,
  SpecUserAccount,
} from "@/lib/api/spec";
import type {
  Child,
  ChildProfile,
  ConsultSession,
  DailyRecord,
  DocType,
  DocumentDraft,
  Photo,
  UserAccount,
  UserRole,
} from "@/lib/types";

/**
 * MSW 핸들러 — 상태형 DB(mocks/db.ts) 위에서 **명세(final_API_명세서.md) 계약**을
 * 그대로 흉내 낸다. 경로·메서드·바디·응답 봉투·정수 ID·영문 enum·오류 형식이 모두 명세.
 * 백엔드가 배포되면 NEXT_PUBLIC_USE_MOCK=false + NEXT_PUBLIC_API_BASE_URL만 바꾸면
 * 같은 seam(lib/api)이 실 API로 그대로 전환된다.
 */

const NOW = () => new Date().toISOString();

/** 명세 1.4 오류 응답 규약 */
const err = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });

// ---------- 직렬화기 (내부 UI 모델 → 명세 와이어) ----------

function specChild(c: Child): SpecChild {
  const profile = db.getChildProfile(c.id);
  return {
    child_id: childIdToInt(c.id),
    name: c.name,
    birth: c.birthDate,
    class_name: profile?.className ?? db.CLASS_NAME,
    // (r7) 실 서버는 male/female로 준다 — 목도 같은 값을 쓴다
    gender: c.gender === "여" ? "female" : "male",
    status: profile?.status ?? "enrolled",
    guardian: c.guardian,
    allergy: c.allergy ?? null,
    recorded: c.recorded,
    attending: c.attending,
  };
}

/** EP-039·040·041·042 — 인적사항 전체 */
function specChildDetail(p: ChildProfile): SpecChildDetail {
  return {
    child_id: childIdToInt(p.id),
    name: p.name,
    birth: p.birthDate || null,
    class_name: p.className || null,
    gender: p.gender === "여" ? "female" : p.gender === "남" ? "male" : null,
    status: p.status,
    enrolled_at: p.enrolledAt || null,
    withdrawn_at: p.withdrawnAt,
    memo: p.memo || null,
    created_at: NOW(),
    updated_at: NOW(),
  };
}

/** EP-043~048 — 계정. 비밀번호는 어떤 응답에도 실리지 않는다 */
function specUserAccount(u: UserAccount): SpecUserAccount {
  return {
    user_id: u.userId,
    username: u.username,
    name: u.name,
    role: u.role,
    active: u.active,
    center_id: 3,
    created_at: NOW(),
    updated_at: NOW(),
  };
}

function specDocument(id: number, doc: DocumentDraft): SpecDocument {
  const confirmed = doc.status !== "draft";
  return {
    document_id: id,
    type: DOC_TO_SPEC[doc.type],
    status: doc.status,
    child_id: doc.childId ? childIdToInt(doc.childId) : null,
    draft: doc.content,
    working: doc.working,
    final: confirmed ? doc.working : null,
    edit_distance: doc.editDistance == null ? null : doc.editDistance / 100,
    source_record_ids: [],
    citations: [],
    created_at: doc.generatedAt,
    confirmed_at: confirmed ? doc.generatedAt : null,
    sent_at: doc.status === "sent" ? doc.generatedAt : null,
    label: doc.label,
  };
}

const DOC_TO_SPEC: Record<DocType, SpecDocType> = {
  notice: "notice",
  journal: "journal",
  plan: "weekly_plan",
  evaluation: "dev_eval",
};

function specPhoto(p: Photo): SpecPhoto {
  return {
    photo_id: p.id,
    file_key: `center3/photos/${p.id}.jpg`,
    status: p.sent ? "sent" : p.status,
    matched_child_id: p.childId ? childIdToInt(p.childId) : null,
    similarity: p.similarity == null ? null : p.similarity / 100,
    selected: false,
    sent_at: p.sent ? `${db.TODAY}T17:10:00+09:00` : null,
    icon: p.icon,
    taken_at: p.takenAt,
  };
}

function specConsult(s: ConsultSession): SpecConsult {
  return {
    consult_id: consultIdToInt(s.id),
    child_id: childIdToInt(s.childId),
    created_at: `${s.date}T15:00:00+09:00`,
    status: s.status === "confirmed" ? "confirmed" : "draft",
    summary_draft: s.summaryDraft || null,
    summary_final: s.summaryFinal ? summaryToSpec(s.summaryFinal) : null,
    topic: s.topic,
    transcript: s.transcript,
  };
}

function specRecord(rec: DailyRecord) {
  return {
    record_id: childIdToInt(rec.childId),
    child_id: childIdToInt(rec.childId),
    date: rec.date,
    activity: rec.activities.join(", "),
    meal: `점심: ${rec.lunch} / 간식: ${rec.snack}`,
    nap: `${rec.napFrom}~${rec.napTo} (${rec.napQuality})`,
    note: rec.memo,
    keywords: [],
    dev_domain_tags: [],
    tags_edited: false,
    audio_key: null,
    created: false,
  };
}

// ---------- 인증 목 상수 ----------

const MOCK_ACCESS_TOKEN = "mock.access.token";
const MOCK_REFRESH_TOKEN = "mock.refresh.token";
const MOCK_USER = {
  user_id: 12,
  name: db.TEACHER_NAME,
  role: "teacher" as const,
  center_id: 3,
  center_name: db.CLASS_NAME,
};

// ---------- 핸들러 ----------

export const handlers = [
  // ===== 인증 (EP-001~003, EP-050·051) =====
  //
  // 명세 r11: 토큰은 응답 본문으로 준다. 목은 서명·만료를 흉내 내지 않고
  // 고정 문자열을 주되, 클라이언트가 지켜야 할 계약(본문에 토큰 두 개, 갱신은
  // access만, 로그아웃은 refresh_token을 본문으로)은 그대로 맞춘다.
  http.post("/api/auth/login", async ({ request }) => {
    await delay(500);
    const body = (await request.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };
    if (!body.username || !body.password) {
      return HttpResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "아이디와 비밀번호를 입력해 주세요.",
          },
        },
        { status: 400 },
      );
    }
    return HttpResponse.json({
      access_token: MOCK_ACCESS_TOKEN,
      refresh_token: MOCK_REFRESH_TOKEN,
      token_type: "Bearer",
      expires_in: 900,
      user: MOCK_USER,
    });
  }),

  http.post("/api/auth/signup", async ({ request }) => {
    await delay(600);
    const body = (await request.json().catch(() => ({}))) as {
      center_name?: string;
    };
    return HttpResponse.json(
      {
        access_token: MOCK_ACCESS_TOKEN,
        refresh_token: MOCK_REFRESH_TOKEN,
        token_type: "Bearer",
        expires_in: 900,
        user: {
          ...MOCK_USER,
          role: "director",
          center_name: body.center_name ?? MOCK_USER.center_name,
        },
      },
      { status: 201 },
    );
  }),

  // 갱신 응답에 refresh_token이 없는 것이 정상이다 — 회전시키지 않는다(EP-050)
  http.post("/api/auth/refresh", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      refresh_token?: string;
    };
    if (body.refresh_token !== MOCK_REFRESH_TOKEN) {
      return HttpResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "로그인이 필요합니다. 다시 로그인해 주세요.",
          },
        },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      access_token: MOCK_ACCESS_TOKEN,
      token_type: "Bearer",
      expires_in: 900,
      user: MOCK_USER,
    });
  }),

  http.get("/api/auth/me", async () => HttpResponse.json(MOCK_USER)),

  http.post("/api/auth/logout", async () => HttpResponse.json({ ok: true })),

  // EP-049 본인 비밀번호 변경 — 현재 비밀번호를 확인하고, 지금 쓰는 창은 남긴다
  http.post("/api/auth/password", async ({ request }) => {
    await delay(400);
    const body = (await request.json().catch(() => ({}))) as {
      current_password?: string;
      new_password?: string;
      keep_refresh_token?: string | null;
    };
    if (!body.current_password)
      return err(
        400,
        "PASSWORD_MISMATCH",
        "현재 비밀번호가 올바르지 않습니다.",
      );
    if ((body.new_password ?? "").length < 8)
      return err(400, "VALIDATION_ERROR", "입력값을 확인해 주세요.");
    if (body.new_password === body.current_password)
      return err(
        400,
        "VALIDATION_ERROR",
        "새 비밀번호가 현재 비밀번호와 같습니다.",
      );
    return HttpResponse.json({
      ok: true,
      revoked_sessions: 2,
      // 비밀번호가 바뀌면 기존 액세스 토큰이 전부 무효가 되므로 새 것을 함께 준다
      access_token: MOCK_ACCESS_TOKEN,
      token_type: "Bearer",
      expires_in: 900,
      // keep_refresh_token이 유효했으면 null — 갖고 있던 것을 계속 쓴다
      refresh_token: body.keep_refresh_token ? null : MOCK_REFRESH_TOKEN,
    });
  }),

  // ===== 아동 목록 (EP-004) =====
  http.get("/api/children", async ({ request }) => {
    await delay(200);
    const status =
      (new URL(request.url).searchParams.get("status") as
        "enrolled" | "withdrawn" | "all" | null) ?? "enrolled";
    const items = db.getRoster(status).map(specChild);
    return HttpResponse.json({ items, total: items.length });
  }),

  // ===== 아동 인적사항 (FN-021 / EP-039~042) =====
  //
  // 원장 전용 판정(EP-039·042의 403)은 목에서 흉내 내지 않는다 — 목은 토큰을
  // 검증하지 않아 역할을 알 수 없다. 화면의 역할 분기는 세션의 role로 이미 걸린다.
  http.post("/api/children", async ({ request }) => {
    await delay(320);
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      birth?: string | null;
      class_name?: string | null;
      gender?: "male" | "female" | null;
      enrolled_at?: string | null;
      memo?: string | null;
    };
    const name = (body.name ?? "").trim();
    if (!name)
      return err(400, "VALIDATION_ERROR", "아동 이름을 입력해 주세요.");
    if (db.hasEnrolledName(name))
      return err(
        409,
        "DUPLICATE_CHILD",
        "같은 이름의 재원 아동이 이미 있습니다. 이름 뒤에 구분 표시를 붙여 주세요.",
      );
    const profile = db.createChildProfile({
      name,
      birthDate: body.birth ?? "",
      className: body.class_name ?? "",
      gender:
        body.gender === "female" ? "여" : body.gender === "male" ? "남" : null,
      enrolledAt: body.enrolled_at ?? "",
      memo: body.memo ?? "",
    });
    return HttpResponse.json(specChildDetail(profile), { status: 201 });
  }),

  http.get("/api/children/:childId", async ({ params }) => {
    await delay(180);
    const profile = db.getChildProfile(intToChildId(Number(params.childId)));
    if (!profile)
      return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    return HttpResponse.json(specChildDetail(profile));
  }),

  http.patch("/api/children/:childId", async ({ params, request }) => {
    await delay(300);
    const childId = intToChildId(Number(params.childId));
    const prev = db.getChildProfile(childId);
    if (!prev) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    // 키가 없으면 그대로 두고, null이 오면 비운다(명세 EP-041)
    const patch: Partial<ChildProfile> = {};
    if ("name" in body) {
      const name = String(body.name ?? "").trim();
      if (!name)
        return err(400, "VALIDATION_ERROR", "아동 이름을 입력해 주세요.");
      if (db.hasEnrolledName(name, childId))
        return err(
          409,
          "DUPLICATE_CHILD",
          "같은 이름의 재원 아동이 이미 있습니다. 이름 뒤에 구분 표시를 붙여 주세요.",
        );
      patch.name = name;
    }
    if ("birth" in body) patch.birthDate = (body.birth as string) ?? "";
    if ("class_name" in body)
      patch.className = (body.class_name as string) ?? "";
    if ("gender" in body)
      patch.gender =
        body.gender === "female" ? "여" : body.gender === "male" ? "남" : null;
    if ("enrolled_at" in body)
      patch.enrolledAt = (body.enrolled_at as string) ?? "";
    if ("memo" in body) patch.memo = (body.memo as string) ?? "";
    if ("status" in body) {
      if (body.status !== "enrolled" && body.status !== "withdrawn")
        return err(400, "VALIDATION_ERROR", "입력값을 확인해 주세요.");
      patch.status = body.status;
    }
    const next = db.updateChildProfile(childId, patch);
    return HttpResponse.json(specChildDetail(next as ChildProfile));
  }),

  http.delete("/api/children/:childId", async ({ params }) => {
    await delay(300);
    const childId = intToChildId(Number(params.childId));
    const prev = db.getChildProfile(childId);
    if (!prev) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    if (prev.status === "withdrawn")
      return err(409, "ALREADY_WITHDRAWN", "이미 퇴소 처리된 아동입니다.");
    return HttpResponse.json(
      specChildDetail(db.withdrawChildProfile(childId) as ChildProfile),
    );
  }),

  // ===== 계정 (FN-022 / EP-043~048) =====
  http.get("/api/users", async ({ request }) => {
    await delay(220);
    const activeOnly =
      new URL(request.url).searchParams.get("active") === "true";
    const items = db.getUsers(activeOnly).map(specUserAccount);
    return HttpResponse.json({ items, total: items.length });
  }),

  http.post("/api/users", async ({ request }) => {
    await delay(360);
    const body = (await request.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
      name?: string;
      role?: UserRole;
    };
    if (
      !/^[a-z0-9._-]{3,30}$/.test(body.username ?? "") ||
      (body.password ?? "").length < 8 ||
      !body.name?.trim() ||
      (body.role !== "teacher" && body.role !== "director")
    )
      return err(400, "VALIDATION_ERROR", "입력값을 확인해 주세요.");
    if (db.hasUsername(body.username as string))
      return err(409, "DUPLICATE_USERNAME", "이미 사용 중인 아이디입니다.");
    const user = db.createUserAccount({
      username: body.username as string,
      password: body.password as string,
      name: body.name.trim(),
      role: body.role,
    });
    return HttpResponse.json(specUserAccount(user), { status: 201 });
  }),

  http.get("/api/users/:userId", async ({ params }) => {
    const user = db.getUser(Number(params.userId));
    if (!user) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    return HttpResponse.json(specUserAccount(user));
  }),

  http.patch("/api/users/:userId", async ({ params, request }) => {
    await delay(300);
    const userId = Number(params.userId);
    const user = db.getUser(userId);
    if (!user) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const patch = (await request.json().catch(() => ({}))) as {
      name?: string;
      role?: UserRole;
      active?: boolean;
    };
    // 1.2.2 잠금 방지 — 자기 잠금은 막고, 자기 강등은 막지 않는다(인수인계)
    if (patch.active === false && userId === MOCK_USER.user_id)
      return err(
        409,
        "SELF_LOCKOUT",
        "자기 계정은 잠글 수 없습니다. 다른 원장에게 요청해 주세요.",
      );
    if (db.wouldRemoveLastDirector(userId, patch))
      return err(
        409,
        "LAST_DIRECTOR",
        "기관에 원장이 최소 한 명은 있어야 합니다. 다른 원장을 먼저 지정해 주세요.",
      );
    return HttpResponse.json(
      specUserAccount(db.updateUserAccount(userId, patch) as UserAccount),
    );
  }),

  http.delete("/api/users/:userId", async ({ params }) => {
    await delay(300);
    const userId = Number(params.userId);
    const user = db.getUser(userId);
    if (!user) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    if (userId === MOCK_USER.user_id)
      return err(
        409,
        "SELF_LOCKOUT",
        "자기 계정은 잠글 수 없습니다. 다른 원장에게 요청해 주세요.",
      );
    if (!user.active)
      return err(409, "ALREADY_INACTIVE", "이미 잠긴 계정입니다.");
    if (db.wouldRemoveLastDirector(userId, { active: false }))
      return err(
        409,
        "LAST_DIRECTOR",
        "기관에 원장이 최소 한 명은 있어야 합니다. 다른 원장을 먼저 지정해 주세요.",
      );
    return HttpResponse.json(
      specUserAccount(
        db.updateUserAccount(userId, { active: false }) as UserAccount,
      ),
    );
  }),

  http.post("/api/users/:userId/password", async ({ params, request }) => {
    await delay(360);
    const user = db.getUser(Number(params.userId));
    if (!user) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const body = (await request.json().catch(() => ({}))) as {
      new_password?: string;
    };
    if ((body.new_password ?? "").length < 8)
      return err(400, "VALIDATION_ERROR", "입력값을 확인해 주세요.");
    return HttpResponse.json(specUserAccount(user));
  }),

  // ===== 관찰 (EP-005 조회 / 관찰 직접 추가는 REST 확장 POST) =====
  http.get("/api/children/:childId/observations", async ({ params }) => {
    await delay(280);
    const childId = intToChildId(Number(params.childId));
    if (!db.getChild(childId))
      return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const obs = db.getObservations(childId);
    const matrix = Object.fromEntries(
      obs.domains.map((d) => [domainToSpec(d.name), d.count]),
    );
    const timeline = obs.timeline.map((o) => ({
      record_id: recordIdToInt(o.id),
      date: o.date,
      note: o.memo,
      dev_domain_tags: o.tag ? [domainToSpec(o.tag)] : [],
      tags_edited: o.manualTag,
    }));
    return HttpResponse.json({
      child_id: Number(params.childId),
      matrix,
      timeline,
      total: timeline.length,
    });
  }),

  // 관찰 직접 추가 — 공식 EP 목록엔 없는 REST 확장(실 백엔드는 POST /records 또는
  // 전용 엔드포인트로 매핑). EP-005와 짝을 이루는 자연스러운 경로로 둔다.
  http.post(
    "/api/children/:childId/observations",
    async ({ params, request }) => {
      await delay(320);
      const childId = intToChildId(Number(params.childId));
      const body = (await request.json()) as {
        note: string;
        dev_domain_tag?: SpecDomain | null;
      };
      const tag = domainFromSpec(body.dev_domain_tag ?? null);
      const entry = db.addObservation(childId, tag, body.note ?? "");
      if (!entry)
        return err(400, "VALIDATION_ERROR", "입력값을 확인해 주세요.");
      return HttpResponse.json(
        {
          record_id: recordIdToInt(entry.id),
          date: entry.date,
          note: entry.memo,
          dev_domain_tags: entry.tag ? [domainToSpec(entry.tag)] : [],
          tags_edited: entry.manualTag,
        },
        { status: 201 },
      );
    },
  ),

  // ===== 상담 (EP-006 조회 / EP-025 확정) =====
  http.get("/api/children/:childId/consults", async ({ params }) => {
    await delay(300);
    const childId = intToChildId(Number(params.childId));
    if (!db.getChild(childId))
      return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const { history } = db.getConsults(childId);
    const items = history.map(specConsult);
    return HttpResponse.json({
      child_id: Number(params.childId),
      items,
      total: items.length,
    });
  }),

  http.post("/api/consults/:consultId/confirm", async ({ params, request }) => {
    await delay(420);
    const uiId = intToConsultId(Number(params.consultId));
    const body = (await request.json()) as {
      summary_final: { core: string; requests: string; follow_up: string };
    };
    const ok = db.confirmConsult(uiId, summaryFromSpec(body.summary_final));
    if (!ok) return err(409, "NO_SUMMARY", "먼저 요약 초안을 만들어 주세요.");
    const session = db.state.consults.find((c) => c.id === uiId)!;
    return HttpResponse.json(specConsult(session));
  }),

  // ===== 하루 기록 (EP-007 저장 / EP-008 조회 / EP-009 태그) =====
  http.get("/api/records", async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const childParam = url.searchParams.get("child_id");
    const date = url.searchParams.get("date") ?? db.TODAY;
    const items: ReturnType<typeof specRecord>[] = [];
    if (childParam) {
      const rec = db.getRecord(intToChildId(Number(childParam)), date);
      if (rec) items.push(specRecord(rec));
    } else {
      db.getChildren().forEach((c) => {
        const rec = db.getRecord(c.id, date);
        if (rec) items.push(specRecord(rec));
      });
    }
    return HttpResponse.json({ items, total: items.length });
  }),

  http.post("/api/records", async ({ request }) => {
    await delay(450);
    const body = (await request.json()) as {
      child_id: number;
      date: string;
      activity?: string;
      meal?: string;
      nap?: string;
      note?: string;
    };
    if (!body.child_id || !body.date)
      return err(
        400,
        "MISSING_CHILD_OR_DATE",
        "아이와 날짜를 먼저 선택하세요.",
      );
    const decoded = decodeSpecRecord(body);
    const rec = db.saveRecord({
      childId: intToChildId(body.child_id),
      date: body.date,
      ...decoded,
    });
    return HttpResponse.json(specRecord(rec), { status: 201 });
  }),

  http.put("/api/records/:recordId/tags", async ({ params, request }) => {
    await delay(250);
    const uiId = intToRecordId(Number(params.recordId));
    const body = (await request.json()) as { dev_domain_tags: SpecDomain[] };
    const tag = domainFromSpec(body.dev_domain_tags?.[0] ?? null);
    const entry = db.updateObservationTag(uiId, tag);
    if (!entry) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    return HttpResponse.json({
      record_id: Number(params.recordId),
      dev_domain_tags: entry.tag ? [domainToSpec(entry.tag)] : [],
      tags_edited: entry.manualTag,
    });
  }),

  // ===== 문서 (EP-010~015) =====
  http.post("/api/documents/generate", async ({ request }) => {
    await delay(600);
    const body = (await request.json()) as {
      type: SpecDocType;
      child_id?: number;
      child_ids?: number[];
      scope?: string;
      date?: string;
    };
    const uiType = docTypeFromSpec(body.type);

    // 일괄 생성(반 전체 알림장)
    if (body.scope === "class" || body.child_ids) {
      const generated: {
        child_id: number;
        document_id: number;
        status: string;
      }[] = [];
      const failed: { child_id: number; code: string; message: string }[] = [];
      db.getChildren().forEach((c) => {
        if (!db.getRecord(c.id, db.TODAY)) {
          failed.push({
            child_id: childIdToInt(c.id),
            code: "RECORD_NOT_FOUND",
            message: "먼저 하루 기록을 남겨 주세요.",
          });
          return;
        }
        const draft = db.getDraft("notice", c.id);
        if (draft)
          generated.push({
            child_id: childIdToInt(c.id),
            document_id: db.assignDocId("notice", c.id),
            status: draft.status,
          });
      });
      return HttpResponse.json({ generated, failed }, { status: 201 });
    }

    // 단일 생성
    const childId = body.child_id ? intToChildId(body.child_id) : null;
    const draft = db.getDraft(uiType, childId, true);
    if (!draft)
      return err(404, "RECORD_NOT_FOUND", "먼저 하루 기록을 남겨 주세요.");
    const id = db.assignDocId(uiType, draft.childId);
    return HttpResponse.json(specDocument(id, draft), { status: 201 });
  }),

  http.get("/api/documents", async ({ request }) => {
    await delay(220);
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const statusParam = url.searchParams.get("status");
    const childParam = url.searchParams.get("child_id");
    const list = db.listDocuments({
      type: typeParam ? docTypeFromSpec(typeParam as SpecDocType) : undefined,
      childId: childParam ? intToChildId(Number(childParam)) : undefined,
      status: (statusParam as DocumentDraft["status"]) || undefined,
    });
    const items = list.map(({ id, doc }) => ({
      document_id: id,
      type: DOC_TO_SPEC[doc.type],
      status: doc.status,
      child_id: doc.childId ? childIdToInt(doc.childId) : null,
      created_at: doc.generatedAt,
    }));
    return HttpResponse.json({ items, total: items.length });
  }),

  http.get("/api/documents/:documentId", async ({ params }) => {
    await delay(180);
    const id = Number(params.documentId);
    const target = db.resolveDocId(id);
    if (!target)
      return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const doc = db.getDocByTarget(target.type, target.childId);
    if (!doc) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    return HttpResponse.json(specDocument(id, doc));
  }),

  http.put("/api/documents/:documentId/draft", async ({ params, request }) => {
    await delay(150);
    const id = Number(params.documentId);
    const target = db.resolveDocId(id);
    const body = (await request.json()) as { working: string };
    if (!target)
      return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const ok = db.saveWorking(target.type, target.childId, body.working);
    if (!ok)
      return err(409, "NOT_EDITABLE", "확정한 문서는 수정할 수 없습니다.");
    return HttpResponse.json({
      document_id: id,
      status: "draft",
      working: body.working,
    });
  }),

  http.post(
    "/api/documents/:documentId/confirm",
    async ({ params, request }) => {
      await delay(480);
      const id = Number(params.documentId);
      const target = db.resolveDocId(id);
      if (!target)
        return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
      const body = (await request.json().catch(() => ({}))) as {
        final?: string;
      };
      const current = db.getDocByTarget(target.type, target.childId);
      const content = body.final ?? current?.working ?? current?.content ?? "";
      const doc = db.confirmDoc(target.type, target.childId, content);
      if (!doc) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
      return HttpResponse.json(specDocument(id, doc));
    },
  ),

  http.post("/api/documents/:documentId/send", async ({ params }) => {
    await delay(480);
    const id = Number(params.documentId);
    const target = db.resolveDocId(id);
    if (!target)
      return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const status = db.sendDoc(target.type, target.childId);
    if (!status) return err(409, "NOT_CONFIRMED", "먼저 검토·확정하세요.");
    return HttpResponse.json({
      document_id: id,
      status: "sent",
      sent_at: NOW(),
    });
  }),

  // ===== 사진 (EP-016~019) =====
  http.post("/api/photos", async () => {
    await delay(350);
    const added = db.uploadPhotos(3);
    const items = db.getPhotoInbox().photos.slice(0, added).map(specPhoto);
    return HttpResponse.json({ items, total: added }, { status: 202 });
  }),

  http.get("/api/photos", async () => {
    await delay(240);
    db.tickClassification();
    const inbox = db.getPhotoInbox();
    return HttpResponse.json({
      items: inbox.photos.map(specPhoto),
      total: inbox.total,
      pending: inbox.classifying,
    });
  }),

  http.put("/api/photos/:photoId/assign", async ({ params, request }) => {
    await delay(300);
    const body = (await request.json()) as { child_id: number };
    const ok = db.assignPhoto(
      Number(params.photoId),
      intToChildId(body.child_id),
    );
    if (!ok) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    return HttpResponse.json({
      photo_id: Number(params.photoId),
      matched_child_id: body.child_id,
      status: "classified",
      manual: true,
    });
  }),

  http.post("/api/photos/send", async ({ request }) => {
    await delay(450);
    const body = (await request.json()) as { photo_ids: number[] };
    const sent = db.sendPhotos(body.photo_ids ?? []);
    return HttpResponse.json({
      sent: (body.photo_ids ?? []).slice(0, sent),
      sent_at: NOW(),
    });
  }),

  // ===== 평가제 체크리스트 (EP-026) =====
  http.get("/api/checklist", async () => {
    await delay(300);
    const c = db.getChecklist();
    return HttpResponse.json({
      items: c.items.map((i) => ({
        id: i.id,
        indicator: i.title,
        status: i.ok ? "met" : "missing",
        hint: i.desc,
      })),
      total: c.total,
      met: c.met,
      missing: c.total - c.met,
      missing_observations: c.missingObservations,
    });
  }),

  // ===== 지표 (EP-028) =====
  http.get("/api/metrics/summary", async () => {
    await delay(340);
    return HttpResponse.json(db.getMetricsSpec());
  }),

  // ===== 설정·시드 (EP-029~031) =====
  http.get("/api/settings", async () => {
    await delay(140);
    const s = db.getSettings();
    return HttpResponse.json({
      replay_enabled: s.replayMode,
      generation_model: s.models.generate,
      light_model: s.models.light,
    });
  }),

  http.put("/api/settings/replay", async ({ request }) => {
    await delay(180);
    const body = (await request.json()) as { enabled: boolean };
    db.setReplayMode(body.enabled);
    return HttpResponse.json({ replay_enabled: body.enabled });
  }),

  http.post("/api/seed/load", async () => {
    await delay(700);
    db.reseed();
    return HttpResponse.json({
      loaded: {
        children: 15,
        records: 12,
        photos: 12,
        messages: 0,
        documents: 1,
      },
      reset: true,
    });
  }),

  // 로컬 양식 동기화 — 공식 EP 목록 밖의 데스크톱 전용 확장(파일 시스템 서식 반영)
  http.post("/api/templates", async ({ request }) => {
    await delay(150);
    const { templates } = (await request.json()) as {
      templates: Partial<Record<DocType, string>>;
    };
    db.setTemplates(templates ?? {});
    return HttpResponse.json({
      ok: true,
      applied: Object.keys(templates ?? {}),
    });
  }),
];
