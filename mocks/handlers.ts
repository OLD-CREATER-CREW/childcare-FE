import { http, HttpResponse, delay } from "msw";
import { analyzeHwpx, type HwpxAnalysis } from "@/lib/hwpx";
import * as db from "@/mocks/db";
import {
  childIdToInt,
  decodeSpecRecord,
  docTypeFromSpec,
  domainFromSpec,
  domainToSpec,
  intToChildId,
  intToRecordId,
  intToUserId,
  recordIdToInt,
  userIdToInt,
} from "@/lib/api/spec";
import type {
  SpecChild,
  SpecChildDetail,
  SpecDocType,
  SpecDocument,
  SpecDocumentCell,
  SpecDomain,
  SpecPhoto,
  SpecTemplate,
  SpecTemplateDocType,
  SpecUserAccount,
} from "@/lib/api/spec";
import type {
  Child,
  ChildProfile,
  DailyRecord,
  DocType,
  DocumentCell,
  DocumentDraft,
  FormTemplate,
  Photo,
  TemplateDocType,
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

// EP-016 사진 상한 — 명세는 숫자를 못 박지 않고 `FILE_TOO_LARGE`만 규정한다.
// 목은 실 서버가 어떤 값을 쓰든 화면이 413을 제대로 처리하는지 보려고 10MB를 쓴다.
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// ---------- 직렬화기 (내부 UI 모델 → 명세 와이어) ----------

function specChild(c: Child): SpecChild {
  const profile = db.getChildProfile(c.id);
  return {
    child_id: childIdToInt(c.id),
    name: c.name,
    birth: c.birthDate,
    class_name: profile?.className ?? db.CLASS_NAME,
    // (r7) 실 서버는 male/female/null 세 값을 준다 — 목도 null을 보존해야
    // "미입력 아동" 경로가 목에서도 드러난다.
    gender: c.gender === "여" ? "female" : c.gender === "남" ? "male" : null,
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
    user_id: userIdToInt(u.userId),
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
    // 놀이이야기만 값이 온다. 목에서도 **비어 있는 쪽을 기본**으로 둔다 —
    // 실제 서버도 교사가 사진을 일지에 붙이지 않았으면 빈 배열을 주므로,
    // 화면이 그 상태를 먼저 견디는지 확인되어야 한다.
    photo_suggestions: doc.type === "play_story" ? db.playStoryPhotos() : [],
    template_id: doc.templateId,
    cells: doc.cells.map(specDocumentCell),
    file_key: doc.fileKey,
    file_render_status: doc.fileRenderStatus,
    created_at: doc.generatedAt,
    confirmed_at: confirmed ? doc.generatedAt : null,
    sent_at: doc.status === "sent" ? doc.generatedAt : null,
    label: doc.label,
  };
}

function specDocumentCell(c: DocumentCell): SpecDocumentCell {
  return {
    key: c.key,
    table: c.table,
    row: c.row,
    col: c.col,
    row_span: c.rowSpan,
    col_span: c.colSpan,
    label: c.label,
    text: c.text,
    source: c.source,
    editable: c.editable,
  };
}

const TEMPLATE_DOC_TO_SPEC: Record<TemplateDocType, SpecTemplateDocType> = {
  notice: "notice",
  journal: "journal",
  plan: "weekly_plan",
  plan_monthly: "monthly_plan",
  evaluation: "dev_eval",
};

/** EP-032·034·052 응답. 분석 실패 템플릿은 `{analysis_failed:true}`만 담는다. */
function specTemplate(t: FormTemplate): SpecTemplate {
  return {
    template_id: t.id,
    doc_type: TEMPLATE_DOC_TO_SPEC[t.docType],
    file_key: t.fileKey,
    file_name: t.fileName,
    structure_meta: t.analysisFailed
      ? { analysis_failed: true }
      : {
          version: 2,
          source_format: t.structure?.sourceFormat ?? "docx",
          tables: t.structure?.tables ?? [],
          cells: (t.structure?.cells ?? []).map((c) => ({
            key: c.key,
            table: c.table,
            row: c.row,
            col: c.col,
            row_span: c.rowSpan,
            col_span: c.colSpan,
            label: c.label,
            empty: c.empty,
            existing_text: c.existingText,
            budget_chars: c.budgetChars,
          })),
        },
    active: t.active,
    style_enabled: t.styleEnabled,
    created_at: t.createdAt,
  };
}

const DOC_TO_SPEC: Record<DocType, SpecDocType> = {
  notice: "notice",
  journal: "journal",
  plan: "weekly_plan",
  plan_monthly: "monthly_plan",
  evaluation: "dev_eval",
  play_story: "play_story",
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

/** 목 기관명 — 회원가입으로 새 기관을 만들면 그 이름으로 바뀐다 */
let mockCenterName = db.CLASS_NAME;

/** 지금 로그인한 사람을 명세 EP-001/003 응답 형태로 */
function sessionUserPayload() {
  const u = db.getSessionUser();
  return {
    user_id: userIdToInt(u.userId),
    name: u.name,
    role: u.role,
    center_id: 3,
    center_name: mockCenterName,
  };
}

/**
 * 개발용 401 강제 스위치 — 목은 토큰을 검증하지 않아 업무 API에서 401이 날 수
 * 없고, 그러면 **401 자동 갱신 래퍼(명세 1.2.3 ④)를 한 번도 밟아 볼 수 없다.**
 * 15분을 기다리는 대신 콘솔에서 아래처럼 켜서 갱신 경로를 손으로 확인한다.
 *
 *   localStorage.setItem("childcare.mock.force401", "1")   // 다음 업무 요청 1건이 401
 *   localStorage.setItem("childcare.mock.force401", "all") // 갱신해도 계속 401(만료 세션)
 */
const FORCE_401_KEY = "childcare.mock.force401";

function consumeForced401(): boolean {
  if (typeof window === "undefined") return false;
  const flag = localStorage.getItem(FORCE_401_KEY);
  if (!flag) return false;
  // "1"은 한 번만 — 갱신 후 재시도가 성공하는 정상 경로를 재현한다.
  if (flag !== "all") localStorage.removeItem(FORCE_401_KEY);
  return true;
}

const unauthorized = () =>
  err(401, "UNAUTHORIZED", "로그인이 필요합니다. 다시 로그인해 주세요.");

// ---------- 핸들러 ----------

/** 문체 예시 목 저장소(EP-052/053). 새로고침하면 사라진다. */
const styleSamples: Record<string, string[]> = {};

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
    // 목은 비밀번호를 검증하지 않는다. 다만 **아이디에 `director`가 들어가면
    // 원장으로 로그인**시켜, 목 모드에서도 원장 전용 화면(SCR-017)과 역할 분기를
    // 실제로 눌러 볼 수 있게 한다 — 없으면 그 경로를 검증할 방법이 아예 없다.
    const asDirector = body.username.includes("director");
    db.setSessionUser(asDirector ? "u11" : "u12");
    return HttpResponse.json({
      access_token: MOCK_ACCESS_TOKEN,
      refresh_token: MOCK_REFRESH_TOKEN,
      token_type: "Bearer",
      expires_in: 900,
      user: sessionUserPayload(),
    });
  }),

  http.post("/api/auth/signup", async ({ request }) => {
    await delay(600);
    const body = (await request.json().catch(() => ({}))) as {
      center_name?: string;
    };
    // 가입은 언제나 그 기관의 첫 원장을 만든다(명세 EP-051)
    if (body.center_name) mockCenterName = body.center_name;
    db.setSessionUser("u11");
    return HttpResponse.json(
      {
        access_token: MOCK_ACCESS_TOKEN,
        refresh_token: MOCK_REFRESH_TOKEN,
        token_type: "Bearer",
        expires_in: 900,
        user: sessionUserPayload(),
      },
      { status: 201 },
    );
  }),

  // 갱신 응답에 refresh_token이 없는 것이 정상이다 — 회전시키지 않는다(EP-050)
  http.post("/api/auth/refresh", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      refresh_token?: string;
    };
    if (body.refresh_token !== MOCK_REFRESH_TOKEN) return unauthorized();
    // force401="all"이면 갱신도 막아 "되살릴 수 없는 세션"을 재현한다.
    if (
      typeof window !== "undefined" &&
      localStorage.getItem(FORCE_401_KEY) === "all"
    )
      return unauthorized();
    return HttpResponse.json({
      access_token: MOCK_ACCESS_TOKEN,
      token_type: "Bearer",
      expires_in: 900,
      user: sessionUserPayload(),
    });
  }),

  http.get("/api/auth/me", async () => HttpResponse.json(sessionUserPayload())),

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
    // 갱신 래퍼를 밟아 볼 수 있는 유일한 지점 — 위 FORCE_401_KEY 설명 참고.
    if (consumeForced401()) return unauthorized();
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
    const user = db.getUser(intToUserId(Number(params.userId)));
    if (!user) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    return HttpResponse.json(specUserAccount(user));
  }),

  http.patch("/api/users/:userId", async ({ params, request }) => {
    await delay(300);
    const userId = intToUserId(Number(params.userId));
    const user = db.getUser(userId);
    if (!user) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const patch = (await request.json().catch(() => ({}))) as {
      name?: string;
      role?: UserRole;
      active?: boolean;
    };
    // 1.2.2 잠금 방지 — 자기 잠금은 막고, 자기 강등은 막지 않는다(인수인계)
    if (patch.active === false && userId === db.getSessionUser().userId)
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
    const userId = intToUserId(Number(params.userId));
    const user = db.getUser(userId);
    if (!user) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    if (userId === db.getSessionUser().userId)
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
    const user = db.getUser(intToUserId(Number(params.userId)));
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
    // 서식이 등록돼 있어야 칸 단위 생성이 된다 — 견본은 한 번만 붙는다.
    await db.ensureSampleTemplates();
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

    // 단일 생성 — 보육일지는 `date`가 문서를 가른다(EP-010).
    const childId = body.child_id ? intToChildId(body.child_id) : null;

    /*
      보육일지만 응답이 JSON이 아니라 **완성 한글 파일**이다. 이 문서에는 화면
      안의 검토 단계가 없어 생성·확정·렌더링·내려받기가 한 번에 끝난다.
      `document_id`는 바디에 실을 수 없어 `X-Document-Id` 헤더로 내려 준다.

      서식이 없으면 **초안을 만들기 전에** 막는다 — 실서버도 그렇게 한다(어차피
      내줄 파일이 없는 요청에 모델을 부르지 않는다).
    */
    if (uiType === "journal") {
      if (!db.activeTemplateFor("journal")?.structure)
        return err(
          409,
          "NO_ACTIVE_TEMPLATE",
          "이 문서 종류에 등록된 양식이 없습니다. 양식을 올리고 활성화한 뒤 다시 시도해 주세요.",
        );

      const journal = db.getDraft("journal", null, true, body.date);
      if (!journal)
        return err(404, "RECORD_NOT_FOUND", "먼저 하루 기록을 남겨 주세요.");

      const journalId = db.assignDocId("journal", null, body.date);
      // 검토 단계가 없으므로 만들어지는 순간 확정본이다 — 그래야 파일명에
      // `초안` 표시가 붙지 않고, 렌더링(확정 후에만 된다)도 통과한다.
      db.confirmDoc("journal", null, journal.working, body.date);
      const rendered = db.renderDocumentFile("journal", null, body.date);
      if (!rendered.ok)
        return err(
          422,
          "RENDER_FAILED",
          "완성 문서를 만들지 못했습니다. 양식의 표 구조를 확인해 주세요.",
        );

      const bytes = await db.documentFileBytes("journal", null, body.date);
      const ext = rendered.fileKey.endsWith(".hwpx") ? "hwpx" : "docx";
      const filename = `journal_${body.date ?? db.TODAY}.${ext}`;
      return new HttpResponse(bytes ?? journal.working, {
        status: 201,
        headers: {
          "Content-Type": MEDIA_TYPE[ext],
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "X-Document-Id": String(journalId),
        },
      });
    }

    const draft = db.getDraft(uiType, childId, true, body.date);
    if (!draft)
      return err(404, "RECORD_NOT_FOUND", "먼저 하루 기록을 남겨 주세요.");
    const id = db.assignDocId(uiType, draft.childId, body.date);
    return HttpResponse.json(specDocument(id, draft), { status: 201 });
  }),

  http.get("/api/documents", async ({ request }) => {
    await delay(220);
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const statusParam = url.searchParams.get("status");
    const childParam = url.searchParams.get("child_id");
    const dateParam = url.searchParams.get("date");
    const list = db.listDocuments({
      type: typeParam ? docTypeFromSpec(typeParam as SpecDocType) : undefined,
      childId: childParam ? intToChildId(Number(childParam)) : undefined,
      status: (statusParam as DocumentDraft["status"]) || undefined,
      date: dateParam || undefined,
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
    const doc = db.getDocByTarget(target.type, target.childId, target.date);
    if (!doc) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    return HttpResponse.json(specDocument(id, doc));
  }),

  http.put("/api/documents/:documentId/draft", async ({ params, request }) => {
    await delay(150);
    const id = Number(params.documentId);
    const target = db.resolveDocId(id);
    // 칸 단위 편집(`cells`)과 평문 통편집(`working`)을 둘 다 받는다 —
    // 활성 템플릿이 없는 문서는 예전처럼 한 덩어리다(실서버 DraftUpdateIn과 동일).
    const body = (await request.json()) as {
      working?: string;
      cells?: Record<string, string>;
    };
    if (!target)
      return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");

    if (body.cells) {
      const doc = db.mergeDocumentCells(
        target.type,
        target.childId,
        body.cells,
        target.date,
      );
      if (!doc) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
      if (doc.status !== "draft")
        return err(409, "NOT_EDITABLE", "확정한 문서는 수정할 수 없습니다.");
      return HttpResponse.json({
        document_id: id,
        status: doc.status,
        working: doc.working,
        cells: doc.cells.map(specDocumentCell),
      });
    }

    const ok = db.saveWorking(
      target.type,
      target.childId,
      body.working ?? "",
      target.date,
    );
    if (!ok)
      return err(409, "NOT_EDITABLE", "확정한 문서는 수정할 수 없습니다.");
    return HttpResponse.json({
      document_id: id,
      status: "draft",
      working: body.working ?? "",
      cells: [],
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
      const current = db.getDocByTarget(
        target.type,
        target.childId,
        target.date,
      );
      const content = body.final ?? current?.working ?? current?.content ?? "";
      const doc = db.confirmDoc(
        target.type,
        target.childId,
        content,
        target.date,
      );
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
    const status = db.sendDoc(target.type, target.childId, target.date);
    if (!status) return err(409, "NOT_CONFIRMED", "먼저 검토·확정하세요.");
    return HttpResponse.json({
      document_id: id,
      status: "sent",
      sent_at: NOW(),
    });
  }),

  // ===== 사진 (EP-016~019) =====
  // 명세대로 multipart의 `files`를 받는다 — 실 서버와 계약이 어긋나면
  // 목에서만 되는 업로드가 되어 버린다.
  http.post("/api/photos", async ({ request }) => {
    await delay(350);
    const form = await request.formData().catch(() => null);
    const files = (form?.getAll("files") ?? []).filter(
      (f): f is File => f instanceof File,
    );
    if (files.length === 0)
      return err(400, "VALIDATION_ERROR", "올릴 사진을 선택해 주세요.");
    if (files.some((f) => !f.type.startsWith("image/")))
      return err(
        415,
        "UNSUPPORTED_FILE",
        "지원하지 않는 파일 형식입니다. 사진 파일만 올릴 수 있어요.",
      );
    if (files.some((f) => f.size > MAX_PHOTO_BYTES))
      return err(
        413,
        "FILE_TOO_LARGE",
        "파일이 너무 큽니다. 용량을 확인해 주세요.",
      );
    const added = db.uploadPhotos(files.length);
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

  // ===== 문체 예시 (EP-052/053) =====
  //
  // 목은 메모리에만 담는다. 마스킹도 흉내만 낸다 — 여기서 확인하려는 것은
  // 화면 흐름(등록 → 개수 표시 → 고치기)이지 비식별화 규칙이 아니다.
  http.get("/api/style-samples", async ({ request }) => {
    await delay(120);
    const type = new URL(request.url).searchParams.get("type") ?? "notice";
    return HttpResponse.json({ type, samples: styleSamples[type] ?? [] });
  }),

  http.put("/api/style-samples", async ({ request }) => {
    await delay(220);
    const body = (await request.json()) as { type: string; samples: string[] };
    const cleaned = (body.samples ?? [])
      .map((t) => (t ?? "").trim())
      .filter(Boolean)
      .slice(0, 5);
    if (cleaned.length === 0) delete styleSamples[body.type];
    else styleSamples[body.type] = cleaned;
    return HttpResponse.json({ type: body.type, samples: cleaned });
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

  // ===== 양식 템플릿 (EP-032~035·037·052) — SCR-015 =====

  /**
   * EP-032 업로드·구조 분석. `multipart/form-data`(doc_type, file).
   *
   * 예전에는 이 경로가 로컬 양식 텍스트 JSON을 받는 데스크톱 전용 확장이었다.
   * r6에서 계약이 파일 업로드로 바뀌었으므로 목도 같이 옮긴다 — 목만 옛 계약을
   * 받아 주면 목에서만 통과하는 화면이 만들어진다(사진 업로드에서 겪은 일이다).
   */
  http.post("/api/templates", async ({ request }) => {
    await delay(900);
    const form = await request.formData().catch(() => null);
    if (!form)
      return err(400, "VALIDATION_ERROR", "요청 형식이 올바르지 않습니다.");

    const specType = String(form.get("doc_type") ?? "");
    const file = form.get("file");
    if (!(file instanceof File))
      return err(400, "VALIDATION_ERROR", "서식 파일을 선택해 주세요.");
    if (!SPEC_TO_TEMPLATE_DOC[specType as SpecTemplateDocType])
      return err(400, "VALIDATION_ERROR", "지원하지 않는 문서 타입입니다.");
    const docType = SPEC_TO_TEMPLATE_DOC[specType as SpecTemplateDocType];

    switch (db.judgeTemplateUpload(file.name)) {
      case "UNSUPPORTED_TEMPLATE_FILE":
        return err(
          415,
          "UNSUPPORTED_TEMPLATE_FILE",
          "지원 형식은 .docx 또는 .hwpx입니다.",
        );
      case "HWP_NEEDS_CONVERSION":
        // 화면이 **변환 방법**을 안내해야 하는 자리다. 서버 message에 그 안내가
        // 그대로 담겨 오므로 화면은 이 문장을 고쳐 쓰지 않는다.
        return err(
          415,
          "HWP_NEEDS_CONVERSION",
          "구 한글 파일(.hwp)은 서식을 채울 수 없습니다. 한글에서 열어 " +
            "[파일 → 다른 이름으로 저장]에서 파일 형식을 'HWPX 문서'로 골라 저장한 뒤 다시 올려 주세요.",
        );
      case "TEMPLATE_ANALYSIS_FAILED": {
        // 분석 실패도 행은 남는다(실서버와 동일) — 기존 활성 템플릿은 그대로다.
        // 원본 바이트는 남겨 둔다 — 실패해도 무엇을 올렸는지는 열어 볼 수 있어야 한다.
        const bytes = await file.arrayBuffer();
        db.addFormTemplate(docType, file.name, true, null, bytes);
        return err(
          422,
          "TEMPLATE_ANALYSIS_FAILED",
          "이 서식은 자동 채움을 지원하지 못합니다.",
        );
      }
    }

    /*
      .hwpx는 **실제로 열어 읽는다.** 표·병합·라벨을 그대로 뽑아야 완성 문서를
      원본 서식에 채울 수 있다(`lib/hwpx`). 열지 못하면 실서버와 같은 갈래로
      422를 돌려준다 — 행은 남고 기존 활성 서식은 그대로다.

      .docx는 아직 목이 열지 못하므로 예전처럼 라벨 목록으로 흉내 낸다.
    */
    const bytes = await file.arrayBuffer();
    let parsed: { analysis: HwpxAnalysis; bytes: ArrayBuffer } | null = null;
    if (file.name.toLowerCase().endsWith(".hwpx")) {
      try {
        const analysis = await analyzeHwpx(bytes);
        if (!analysis.cells.length) throw new Error("표가 없습니다");
        parsed = { analysis, bytes };
      } catch {
        db.addFormTemplate(docType, file.name, true, null, bytes);
        return err(
          422,
          "TEMPLATE_ANALYSIS_FAILED",
          "이 서식은 자동 채움을 지원하지 못합니다.",
        );
      }
    }

    const template = db.addFormTemplate(
      docType,
      file.name,
      false,
      parsed,
      bytes,
    );
    return HttpResponse.json(specTemplate(template), { status: 201 });
  }),

  http.get("/api/templates", async ({ request }) => {
    await db.ensureSampleTemplates();
    await delay(180);
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const activeOnly = url.searchParams.get("active_only") === "true";
    const docType = typeParam
      ? SPEC_TO_TEMPLATE_DOC[typeParam as SpecTemplateDocType]
      : undefined;
    const items = db.listFormTemplates(docType, activeOnly).map((t) => ({
      template_id: t.id,
      doc_type: TEMPLATE_DOC_TO_SPEC[t.docType],
      active: t.active,
      file_name: t.fileName,
      style_enabled: t.styleEnabled,
      created_at: t.createdAt,
    }));
    return HttpResponse.json({ items, total: items.length });
  }),

  http.get("/api/templates/:templateId", async ({ params }) => {
    await db.ensureSampleTemplates();
    await delay(180);
    const t = db.getFormTemplate(Number(params.templateId));
    if (!t) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    return HttpResponse.json(specTemplate(t));
  }),

  http.post("/api/templates/:templateId/activate", async ({ params }) => {
    await delay(260);
    const id = Number(params.templateId);
    const existing = db.getFormTemplate(id);
    if (!existing)
      return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const t = db.activateFormTemplate(id);
    if (!t)
      return err(
        409,
        "TEMPLATE_NOT_ANALYZABLE",
        "구조 분석에 실패한 서식은 활성화할 수 없습니다.",
      );
    return HttpResponse.json({
      template_id: t.id,
      doc_type: TEMPLATE_DOC_TO_SPEC[t.docType],
      active: t.active,
    });
  }),

  http.delete("/api/templates/:templateId", async ({ params }) => {
    await delay(220);
    const t = db.deactivateFormTemplate(Number(params.templateId));
    if (!t) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    return HttpResponse.json({ template_id: t.id, active: t.active });
  }),

  http.patch(
    "/api/templates/:templateId/style",
    async ({ params, request }) => {
      await delay(200);
      const id = Number(params.templateId);
      const existing = db.getFormTemplate(id);
      if (!existing)
        return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
      const body = (await request.json()) as { style_enabled?: boolean };
      if (typeof body.style_enabled !== "boolean")
        return err(400, "VALIDATION_ERROR", "요청 형식이 올바르지 않습니다.");
      const t = db.setFormTemplateStyle(id, body.style_enabled);
      if (!t)
        return err(
          409,
          "TEMPLATE_NOT_ANALYZABLE",
          "구조 분석에 실패한 서식은 설정할 수 없습니다.",
        );
      return HttpResponse.json(specTemplate(t));
    },
  ),

  /**
   * 서식 원본 파일 내려받기 — 명세에 아직 없는 확장(SCR-015 후속, `lib/api/index.ts`
   * 주석 참고). 완성 문서(EP-036)와 달리 **채워진 결과가 아니라 사람이 올린
   * 원본**을 그대로 돌려준다 — 등록 이력에서 "무엇을 올렸는지" 한글/워드로 직접
   * 열어 확인할 수 있어야 한다.
   */
  http.get("/api/templates/:templateId/file", async ({ params }) => {
    await delay(220);
    const id = Number(params.templateId);
    const t = db.getFormTemplate(id);
    if (!t) return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const raw = db.getTemplateRawFile(id);
    if (!raw)
      return err(
        404,
        "FILE_NOT_AVAILABLE",
        "원본 파일을 내려받을 수 없습니다.",
      );
    const ext = t.fileName.toLowerCase().endsWith(".hwpx") ? "hwpx" : "docx";
    return new HttpResponse(raw, {
      headers: {
        "Content-Type": MEDIA_TYPE[ext],
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(t.fileName)}`,
      },
    });
  }),

  // ===== 완성 문서 파일 (EP-036·038) =====

  http.post("/api/documents/:documentId/file", async ({ params }) => {
    // 실서버는 서식을 실제로 채우느라 몇 초 걸린다 — 진행 표시를 확인할 만큼 준다.
    await delay(1400);
    const id = Number(params.documentId);
    const target = db.resolveDocId(id);
    if (!target)
      return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const res = db.renderDocumentFile(target.type, target.childId, target.date);
    if (!res.ok) {
      if (res.code === "NOT_CONFIRMED")
        return err(409, "NOT_CONFIRMED", "먼저 검토·확정하세요.");
      return err(
        409,
        "NO_ACTIVE_TEMPLATE",
        "이 문서 종류에 등록된 양식이 없습니다. 양식을 올리고 활성화한 뒤 다시 시도해 주세요.",
      );
    }
    return HttpResponse.json({
      document_id: id,
      file_key: res.fileKey,
      file_render_status: res.status,
    });
  }),

  /**
   * EP-036 다운로드 — JSON이 아니라 **파일 바이너리 스트림**이다.
   *
   * 서식이 .hwpx면 목도 **진짜 한글 파일**을 내려준다 — 원본 서식을 열어 칸을
   * 채워 다시 묶는다(`db.documentFileBytes`). 한글에서 열어 칸 넘침·요일 배치를
   * 검토하는 것이 이 기능의 목적이라, 평문을 .hwpx 이름으로 주면 검증이 안 된다.
   * 서식을 열 수 없는 경우(.docx)에는 예전처럼 평문을 내려준다.
   *
   * 확장자·Content-Type·Content-Disposition은 **서버가 정한다** — 화면이 .docx로
   * 고정하면 서식을 채운 .hwpx가 잘못된 이름으로 저장된다.
   */
  http.get("/api/documents/:documentId/file", async ({ params }) => {
    await db.ensureSampleTemplates();
    await delay(320);
    const id = Number(params.documentId);
    const target = db.resolveDocId(id);
    if (!target)
      return err(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
    const doc = db.getDocByTarget(target.type, target.childId, target.date);
    if (!doc?.fileKey)
      return err(
        404,
        "FILE_NOT_AVAILABLE",
        "아직 만들어진 문서 파일이 없습니다. 먼저 문서 만들기를 눌러 주세요.",
      );
    const ext = doc.fileKey.endsWith(".hwpx") ? "hwpx" : "docx";
    // 확정 전 파일은 파일명에 「초안」을 박는다 — 초안을 확정본으로 믿고 제출하는
    // 사고를 막는 표식이고, 화면도 같은 표식(`_preview`)을 보고 안내한다.
    const draftMark = doc.fileKey.includes("_preview") ? "_초안" : "";
    const filename = `${doc.label || "문서"}${draftMark}.${ext}`;
    const filled = await db.documentFileBytes(
      target.type,
      target.childId,
      target.date,
    );
    return new HttpResponse(filled ?? doc.working, {
      headers: {
        "Content-Type": MEDIA_TYPE[ext],
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  }),
];

const SPEC_TO_TEMPLATE_DOC: Record<SpecTemplateDocType, TemplateDocType> = {
  notice: "notice",
  journal: "journal",
  weekly_plan: "plan",
  monthly_plan: "plan_monthly",
  dev_eval: "evaluation",
};

/** 실서버 `docfill.media_type_for`와 같은 갈래 — 확장자가 타입을 정한다 */
const MEDIA_TYPE: Record<"docx" | "hwpx", string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  hwpx: "application/hwp+zip",
};
