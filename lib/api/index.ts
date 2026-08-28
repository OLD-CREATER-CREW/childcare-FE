import {
  ApiError,
  api,
  refreshAccessToken,
  tokenStore,
} from "@/lib/api/client";
import type { DownloadedFile, ListEnvelope } from "@/lib/api/client";
import {
  childIdToInt,
  decodeSpecRecord,
  docTypeFromSpec,
  docTypeToSpec,
  domainFromSpec,
  domainToSpec,
  encodeRecordToSpec,
  intToChildId,
  intToRecordId,
  intToUserId,
  recordIdToInt,
  userIdToInt,
} from "@/lib/api/spec";
import type {
  SpecAuthTokens,
  SpecDocumentCell,
  SpecRenderFile,
  SpecTemplate,
  SpecTemplateActivate,
  SpecTemplateDeactivate,
  SpecTemplateDocType,
  SpecTemplateListItem,
  SpecStructureMeta,
  SpecChecklist,
  SpecChild,
  SpecDocType,
  SpecDocument,
  SpecDocumentListItem,
  SpecDomain,
  SpecMetrics,
  SpecObservations,
  SpecPhoto,
  SpecChildDetail,
  SpecPasswordChange,
  SpecPhotoList,
  SpecRecord,
  SpecRefresh,
  SpecSettings,
  SpecUser,
  SpecUserAccount,
} from "@/lib/api/spec";
import {
  MONTH_FROM,
  MONTH_TO,
  TODAY,
  WEEK_FROM,
  WEEK_TO,
} from "@/lib/constants";
import { DEV_DOMAINS } from "@/lib/types";
import type {
  AppSettings,
  AuthUser,
  ChecklistData,
  Child,
  ChildProfile,
  ChildProfileInput,
  ChildStatus,
  DailyRecord,
  DailyRecordInput,
  DevelopmentDomain,
  DocStatus,
  DocType,
  DayRecord,
  DocumentCell,
  ProvenanceSpan,
  DocumentDraft,
  FileRenderStatus,
  FormTemplate,
  TemplateDocType,
  TemplateStructure,
  LoginInput,
  MetricsSummary,
  ActivityRecommendations,
  NoticeQueue,
  ObservationData,
  ObservationEntry,
  PasswordChangeInput,
  PasswordChangeResult,
  Photo,
  PhotoInbox,
  RecordSummary,
  SignupInput,
  UserAccount,
  UserAccountInput,
  UserAccountPatch,
} from "@/lib/types";

/**
 * API seam — 화면이 쓰는 UI 타입과 명세(final_API_명세서.md) 와이어 계약 사이의
 * 유일한 번역 지점이다. 함수 시그니처(입·출력 UI 타입)는 그대로 유지하고, 내부에서
 * 명세 엔드포인트를 호출·매핑한다. 목이든 실 백엔드든 이 파일만 통과한다.
 */

// 아바타 색은 명세에 없는 표현 데이터 — child_id로 결정적으로 파생한다(db 팔레트와 동일 순서).
const AVATAR_COLORS = [
  "#2E7D52",
  "#3D6FA8",
  "#B0713A",
  "#7C5CB0",
  "#3A8F8A",
  "#BE4F3F",
];

const colorFor = (childIdInt: number) => {
  // child_id 정수로 팔레트를 결정적으로 고른다(값 범위 무관, 음수 방어 포함).
  const len = AVATAR_COLORS.length;
  return AVATAR_COLORS[((childIdInt % len) + len) % len];
};

// ---------- 매퍼 (명세 와이어 → UI 타입) ----------

/**
 * (r7) 실 서버는 `male`·`female`·`null` 세 값을 준다 — 화면 표기는 한글이라
 * 여기서 옮긴다. **`null`(미입력)을 "남"으로 접지 않는다**: 접으면 목록은 "남",
 * 인적사항 패널은 "미입력"을 보여 주고, 저장만 눌러도 성별이 조용히 확정된다.
 */
const mapGender = (g: SpecChild["gender"]): "남" | "여" | null =>
  g === "female" ? "여" : g === "male" ? "남" : null;

function mapChild(c: SpecChild): Child {
  return {
    id: intToChildId(c.child_id),
    name: c.name,
    gender: mapGender(c.gender),
    birthDate: c.birth ?? "",
    guardian: c.guardian ?? "",
    allergy: c.allergy ?? undefined,
    color: colorFor(c.child_id),
    recorded: c.recorded ?? false,
    attending: c.attending ?? true,
    className: c.class_name,
    // (r7) 목록 기본 조회는 재원만 주므로, 값이 없으면 재원으로 본다.
    status: c.status ?? "enrolled",
  };
}

function mapDoc(spec: SpecDocument): DocumentDraft {
  return {
    documentId: spec.document_id,
    type: docTypeFromSpec(spec.type),
    childId: spec.child_id ? intToChildId(spec.child_id) : null,
    label: spec.label ?? "",
    content: spec.draft,
    working: spec.working ?? spec.final ?? spec.draft,
    status: spec.status,
    editDistance:
      spec.edit_distance == null ? null : Math.round(spec.edit_distance * 100),
    generatedAt: spec.created_at,
    // 놀이이야기만 값이 온다. 없거나 빈 배열이 정상이므로 화면이 그 상태를
    // 예외로 다루지 않도록 여기서 항상 배열로 맞춰 둔다.
    photoSuggestions: (spec.photo_suggestions ?? []).map((s) => ({
      date: s.date,
      activity: s.activity,
      recordIds: s.record_ids ?? [],
      photos: (s.photos ?? []).map((p) => ({
        photoId: p.photo_id,
        fileKey: p.file_key,
        matchedChildId: p.matched_child_id,
        similarity:
          p.similarity == null ? null : Math.round(p.similarity * 100),
      })),
    })),
    templateId: spec.template_id ?? null,
    // 템플릿 주도 문서만 칸이 온다. 평문 폴백 문서는 빈 배열이 정상이다.
    cells: (spec.cells ?? []).map(mapDocumentCell),
    // 출처 표시(FN-022). 서버가 안 주면 null — "추적 안 함"과 같은 뜻이다.
    provenance:
      spec.provenance == null
        ? null
        : (spec.provenance.draft ?? []).map(mapSpan),
    // 근거(FN-004). 검색을 안 하는 타입은 빈 배열이 정상이다.
    citations: (spec.citations ?? []).map((c) => ({
      doc: citationDocLabel(c.source),
      where: [c.section, c.subsection].filter(Boolean).join(" › "),
      page: c.page ?? null,
      text: c.chunk ?? "",
      slot: c.slot ?? null,
    })),
    // 칸별 표시. 없으면 빈 객체 — 화면이 칸마다 조회하므로 null을 만들지 않는다.
    cellProvenance: Object.fromEntries(
      Object.entries(spec.provenance?.cells ?? {}).map(([key, spans]) => [
        key,
        (spans ?? []).map(mapSpan),
      ]),
    ),
    fileKey: spec.file_key ?? null,
    // 값이 없으면 "아직 만들지 않음"으로 본다 — `file_key`가 없는데 상태까지
    // 없으면 화면이 「내려받기」를 띄울 근거가 없다.
    fileRenderStatus: spec.file_render_status ?? "not_requested",
  };
}

/**
 * 근거 파일 경로 → 사람이 읽는 문서 이름.
 *
 * 서버는 `reference/nuri_guide(3~5)/nuri_guide_v5.md` 같은 경로를 준다. 교사에게
 * 파일 경로를 보여 줄 수는 없고, 그렇다고 서버가 이름을 정해 주지도 않는다
 * (청크 적재 스크립트가 파일을 그대로 기록한다). 경로 조각으로 가른다 —
 * 근거 문서는 세 종뿐이고 늘어나면 여기 한 줄을 더한다.
 */
function citationDocLabel(source: string): string {
  const path = (source || "").toLowerCase();
  if (path.includes("nuri")) return "누리과정 (3~5세)";
  if (path.includes("standard")) return "표준보육과정 (0~2세)";
  if (path.includes("eval")) return "어린이집 평가 매뉴얼";
  // 모르는 문서도 감추지 않는다 — 파일 이름만이라도 보여 준다.
  return source.split("/").pop() || "근거 문서";
}

/** 출처 span 하나 — 본문용과 칸용이 같은 모양이라 한 곳에서 옮긴다. */
function mapSpan(s: {
  start: number;
  length: number;
  text: string;
  record_ids?: number[];
}): ProvenanceSpan {
  return {
    start: s.start,
    length: s.length,
    text: s.text,
    recordIds: s.record_ids ?? [],
  };
}

function mapDocumentCell(c: SpecDocumentCell): DocumentCell {
  return {
    key: c.key,
    table: c.table,
    row: c.row,
    col: c.col,
    rowSpan: c.row_span,
    colSpan: c.col_span,
    label: c.label,
    text: c.text,
    source: c.source,
    editable: c.editable,
  };
}

function mapPhoto(p: SpecPhoto): Photo {
  return {
    id: p.photo_id,
    icon: p.icon ?? "🧒",
    status: p.status === "sent" ? "classified" : p.status,
    childId: p.matched_child_id ? intToChildId(p.matched_child_id) : null,
    similarity: p.similarity == null ? null : Math.round(p.similarity * 100),
    takenAt: p.taken_at ?? "",
    sent: p.status === "sent",
  };
}

// ---------- 인증 (EP-001·002·003·050·051) ----------
//
// 명세 r11 1.2: 액세스 JWT(15분) + 리프레시 토큰(12시간). 토큰은 응답 본문으로
// 오며, 액세스는 메모리·리프레시는 localStorage에 둔다(client.ts tokenStore).
// 업무 API의 401 자동 갱신도 client.ts가 처리하므로 화면은 신경 쓰지 않는다.

// 화면·store는 transport(client.ts)를 직접 알지 않는다. 토큰을 어디에 어떻게
// 두는지가 바뀌어도 이 seam만 고치면 되도록, 필요한 것만 여기서 다시 내보낸다.
export { ApiError } from "@/lib/api/client";

/** 저장한 토큰을 모두 버린다 — 로그아웃·세션 만료의 뒷정리 */
export const clearSession = () => tokenStore.clear();

/** 갱신까지 실패해 되살릴 수 없을 때 호출될 핸들러를 등록한다 */
export const onSessionExpired = (handler: (() => void) | null) =>
  tokenStore.onSessionExpired(handler);

function mapUser(u: SpecUser): AuthUser {
  return {
    userId: intToUserId(u.user_id),
    name: u.name,
    role: u.role,
    centerId: u.center_id,
    centerName: u.center_name,
  };
}

/** UI 입력 → EP-001 요청 본문. 우연한 필드명 일치에 기대지 않는다 */
const loginBody = (input: LoginInput) => ({
  username: input.username,
  password: input.password,
});

/** 로그인·가입 응답의 토큰 두 개를 보관한다(명세 1.2.3 ⑤⑥) */
function storeSession(res: SpecAuthTokens): AuthUser {
  tokenStore.setAccess(res.access_token);
  tokenStore.setRefresh(res.refresh_token);
  return mapUser(res.user);
}

/** EP-001 POST /api/auth/login — 인증 배관이라 Bearer·자동 갱신을 붙이지 않는다 */
export const login = async (input: LoginInput): Promise<AuthUser> => {
  const res = await api.post<SpecAuthTokens>("/auth/login", loginBody(input), {
    skipAuth: true,
  });
  return storeSession(res);
};

/** EP-051 POST /api/auth/signup — 기관 + 첫 원장 계정. 성공 시 곧바로 로그인 상태 */
export const signup = async (input: SignupInput): Promise<AuthUser> => {
  const res = await api.post<SpecAuthTokens>(
    "/auth/signup",
    {
      center_name: input.centerName,
      username: input.username,
      password: input.password,
      name: input.name,
    },
    { skipAuth: true },
  );
  return storeSession(res);
};

/**
 * EP-050 — 앱 기동 시 저장된 리프레시 토큰으로 세션을 복구한다(명세 1.2.3 ③).
 *
 * 갱신 자체는 `refreshAccessToken()`에 위임한다. 여기서 EP-050을 따로 부르면
 * 갱신 경로가 두 벌이 되어 dev StrictMode의 이중 실행이 그대로 요청 2회가 되고,
 * "갱신은 한 번만"(1.2.3 ④)이 기동 경로에서만 깨진다.
 *
 * 사용자 정보는 EP-003으로 따로 받는다 — 공유 프라미스는 토큰만 돌려주기 때문이다.
 */
export const restoreSession = async (): Promise<AuthUser | null> => {
  if (!tokenStore.refresh) return null;
  const outcome = await refreshAccessToken();
  // 401은 되살릴 수 없는 상태다 — 저장한 토큰을 지운다(명세 EP-050).
  if (outcome === "expired") {
    tokenStore.clear();
    return null;
  }
  // 서버가 잠깐 없는 것뿐이면 토큰을 남겨 두고 다음 기동에서 다시 시도한다.
  if (outcome === "unavailable") return null;
  try {
    return await fetchMe();
  } catch {
    return null;
  }
};

/** EP-003 GET /api/auth/me */
export const fetchMe = async (): Promise<AuthUser> =>
  mapUser(await api.get<SpecUser>("/auth/me"));

/** EP-002 POST /api/auth/logout — 서버는 리프레시 토큰만 폐기하므로 클라이언트가 둘 다 지운다 */
export const logout = async (): Promise<{ ok: boolean }> => {
  try {
    // 토큰이 없어도 호출한다 — 서버가 폐기할 게 없으면 그만이고, 호출을 건너뛰면
    // 서버 `sessions` 행이 12시간 남아 "정리됐다"고 오해하게 된다.
    await api.post("/auth/logout", { refresh_token: tokenStore.refresh });
  } catch {
    /* 로그아웃은 서버가 실패해도 화면에서는 끝나야 한다 */
  } finally {
    // 서버 응답과 무관하게 지운다 — 지우지 않으면 최대 15분간 유효한 액세스
    // 토큰이 남는다(명세 EP-002 경고).
    tokenStore.clear();
  }
  return { ok: true };
};

/** EP-049 POST /api/auth/password — 본인 비밀번호 변경 */
export const changeMyPassword = async (
  input: PasswordChangeInput,
): Promise<PasswordChangeResult> => {
  const res = await api.post<SpecPasswordChange>("/auth/password", {
    current_password: input.currentPassword,
    new_password: input.newPassword,
    // 지금 쓰는 기기만 살린다. 이걸 보내지 않으면 자기 세션까지 끊긴다.
    keep_refresh_token: tokenStore.refresh,
  });
  // 비밀번호가 바뀌면 token_version이 올라가 기존 액세스 토큰이 전부 무효가 된다.
  // 응답의 새 토큰으로 교체하지 않으면 **다음 요청부터 401**이다(명세 1.2.3 ⑧).
  tokenStore.setAccess(res.access_token);
  if (res.refresh_token) tokenStore.setRefresh(res.refresh_token);
  return { revokedSessions: res.revoked_sessions };
};

// ---------- 아동 목록 (EP-004) ----------

/** 업무 화면이 쓰는 기본 명단 — 재원 아동만(명세 EP-004 기본값과 같다) */
export const fetchChildren = (): Promise<Child[]> =>
  fetchChildRoster("enrolled");

// ---------- 아동 인적사항 (FN-021 / EP-039~042) ----------

const GENDER_TO_SPEC = { 남: "male", 여: "female" } as const;

function mapChildProfile(c: SpecChildDetail): ChildProfile {
  return {
    id: intToChildId(c.child_id),
    name: c.name,
    birthDate: c.birth ?? "",
    className: c.class_name ?? "",
    gender: mapGender(c.gender),
    status: c.status,
    enrolledAt: c.enrolled_at ?? "",
    withdrawnAt: c.withdrawn_at,
    memo: c.memo ?? "",
  };
}

/** 빈 문자열은 "값 없음"이다 — 공백만 남은 입력도 같이 접는다 */
const blankToNull = (v: string) => v.trim() || null;

type ChildWireBody = Partial<Omit<SpecChildDetail, "child_id">>;

/**
 * UI 입력 → 명세 본문. 모드에 따라 **빈 값의 뜻이 정반대**라 반드시 갈라야 한다.
 *
 * - `patch`(EP-041): 키를 넣지 않은 것과 null을 보낸 것이 다르다. 넣지 않으면
 *   기존 값 유지, null이면 값을 비운다. 그래서 빈 문자열을 null로 바꿔 보낸다.
 * - `create`(EP-039): 선택 항목은 **생략**이 기본값 경로다. `enrolled_at`은
 *   생략했을 때만 서버가 오늘(KST)로 채우고, `gender`는 `male`/`female`만
 *   허용하므로 null을 보내면 입소일이 비거나 `400 VALIDATION_ERROR`가 난다.
 */
function childProfileBody(
  input: Partial<ChildProfileInput>,
  mode: "create" | "patch",
): ChildWireBody {
  const body: ChildWireBody = {};
  // 생성에서는 "비우기"라는 개념이 없다 — null이 될 값은 키째 빼서 생략한다.
  const set = <K extends keyof ChildWireBody>(
    key: K,
    value: ChildWireBody[K],
  ) => {
    if (value === null && mode === "create") return;
    body[key] = value;
  };

  if (input.name !== undefined) body.name = input.name.trim();
  if (input.birthDate !== undefined) set("birth", blankToNull(input.birthDate));
  if (input.className !== undefined)
    set("class_name", blankToNull(input.className));
  if (input.gender !== undefined)
    set("gender", input.gender ? GENDER_TO_SPEC[input.gender] : null);
  if (input.enrolledAt !== undefined)
    set("enrolled_at", blankToNull(input.enrolledAt));
  if (input.memo !== undefined) set("memo", blankToNull(input.memo));
  // `status`는 여기로 오지 않는다 — 입력 타입에서 뺐다(ChildProfileInput 주석 참조).
  return body;
}

/** EP-004를 status 쿼리와 함께 부른다 — 기본은 재원만, `all`이면 퇴소 아동도 */
export const fetchChildRoster = async (
  status: ChildStatus | "all" = "enrolled",
): Promise<Child[]> => {
  const list = await api.get<ListEnvelope<SpecChild>>(
    `/children?status=${status}`,
  );
  return list.items.map(mapChild);
};

/** EP-040 GET /api/children/{id} — 퇴소 아동도 조회된다 */
export const fetchChildProfile = async (
  childId: string,
): Promise<ChildProfile> =>
  mapChildProfile(
    await api.get<SpecChildDetail>(`/children/${childIdToInt(childId)}`),
  );

/** EP-039 POST /api/children — 원장 전용 */
export const createChild = async (
  input: ChildProfileInput,
): Promise<ChildProfile> =>
  mapChildProfile(
    await api.post<SpecChildDetail>(
      "/children",
      childProfileBody(input, "create"),
    ),
  );

/** EP-041 PATCH /api/children/{id} — 교사도 쓸 수 있다(반 배정·특이사항은 일상 업무) */
export const updateChild = async (
  childId: string,
  input: Partial<ChildProfileInput>,
): Promise<ChildProfile> =>
  mapChildProfile(
    await api.patch<SpecChildDetail>(
      `/children/${childIdToInt(childId)}`,
      childProfileBody(input, "patch"),
    ),
  );

/** EP-042 DELETE /api/children/{id} — 원장 전용. 행을 지우지 않고 status만 바꾼다 */
export const withdrawChild = async (childId: string): Promise<ChildProfile> =>
  mapChildProfile(
    await api.del<SpecChildDetail>(`/children/${childIdToInt(childId)}`),
  );

/**
 * 퇴소 취소 — EP-041로 status를 되돌리면 withdrawn_at도 함께 지워진다(오조작 복구).
 *
 * `status`를 바꾸는 경로는 여기 하나뿐이다. `ChildProfileInput`에서 status를 빼
 * 화면이 임의로 상태를 실어 보낼 수 없게 했다 — EP-041은 교사도 부를 수 있어
 * 서버가 이 필드를 막아 주지 않으므로(EP-042 퇴소는 원장 전용인 것과 대조),
 * 클라이언트에서 경로를 좁히는 것이 지금 할 수 있는 최선이다.
 */
export const reenrollChild = async (childId: string): Promise<ChildProfile> =>
  mapChildProfile(
    await api.patch<SpecChildDetail>(`/children/${childIdToInt(childId)}`, {
      status: "enrolled",
    }),
  );

// ---------- 계정 (FN-022 / EP-043~048) ----------

function mapUserAccount(u: SpecUserAccount): UserAccount {
  return {
    userId: intToUserId(u.user_id),
    username: u.username,
    name: u.name,
    role: u.role,
    active: u.active,
  };
}

/** UI 입력 → EP-043 요청 본문. `center_id`는 보내지 않는다(원장 본인 기관 고정) */
const userAccountBody = (input: UserAccountInput) => ({
  username: input.username,
  password: input.password,
  name: input.name,
  role: input.role,
});

/** UI 부분 수정 → EP-046 요청 본문. 보낸 키만 반영된다 */
function userAccountPatchBody(patch: UserAccountPatch) {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.role !== undefined) body.role = patch.role;
  if (patch.active !== undefined) body.active = patch.active;
  return body;
}

/** EP-044 GET /api/users — 원장 전용. 기본은 잠긴 계정도 함께 준다 */
export const fetchUsers = async (
  activeOnly = false,
): Promise<UserAccount[]> => {
  const list = await api.get<ListEnvelope<SpecUserAccount>>(
    activeOnly ? "/users?active=true" : "/users",
  );
  return list.items.map(mapUserAccount);
};

/** EP-045 GET /api/users/{id} — 원장, 또는 자기 계정에 한해 교사도 */
export const fetchUser = async (userId: string): Promise<UserAccount> =>
  mapUserAccount(
    await api.get<SpecUserAccount>(`/users/${userIdToInt(userId)}`),
  );

/** EP-043 POST /api/users — 원장 전용 */
export const createUser = async (
  input: UserAccountInput,
): Promise<UserAccount> =>
  mapUserAccount(
    await api.post<SpecUserAccount>("/users", userAccountBody(input)),
  );

/** EP-046 PATCH /api/users/{id} — 이름·역할·활성 상태만 */
export const updateUser = async (
  userId: string,
  patch: UserAccountPatch,
): Promise<UserAccount> =>
  mapUserAccount(
    await api.patch<SpecUserAccount>(
      `/users/${userIdToInt(userId)}`,
      userAccountPatchBody(patch),
    ),
  );

/** EP-047 DELETE /api/users/{id} — 잠금(소프트 삭제). 그 사용자의 세션이 전부 끊긴다 */
export const lockUser = async (userId: string): Promise<UserAccount> =>
  mapUserAccount(
    await api.del<SpecUserAccount>(`/users/${userIdToInt(userId)}`),
  );

/** EP-048 POST /api/users/{id}/password — 원장이 재설정. 현재 비밀번호를 묻지 않는다 */
export const resetUserPassword = async (
  userId: string,
  newPassword: string,
): Promise<UserAccount> =>
  mapUserAccount(
    await api.post<SpecUserAccount>(`/users/${userIdToInt(userId)}/password`, {
      new_password: newPassword,
    }),
  );

// ---------- 오늘 홈 현황 (여러 명세 EP 합성) ----------

export const fetchRecordSummary = async (): Promise<RecordSummary> => {
  const [children, recs, pending, photos] = await Promise.all([
    fetchChildren(),
    api.get<ListEnvelope<SpecRecord>>(`/records?date=${TODAY}`),
    api.get<ListEnvelope<SpecDocumentListItem>>(
      "/documents?type=notice&status=draft",
    ),
    api.get<SpecPhotoList>("/photos"),
  ]);
  return {
    done: recs.total,
    total: children.length,
    pendingDocs: pending.total,
    unclassifiedPhotos: photos.items.filter((p) => p.status === "unmatched")
      .length,
  };
};

// ---------- 하루 기록 (EP-008 조회 / EP-007 저장) ----------

export const fetchDailyRecord = async (
  childId: string,
  date: string,
): Promise<{ record: DailyRecord | null }> => {
  const list = await api.get<ListEnvelope<SpecRecord>>(
    `/records?child_id=${childIdToInt(childId)}&date=${date}`,
  );
  const spec = list.items[0];
  if (!spec) return { record: null };
  return {
    record: {
      childId,
      date,
      ...decodeSpecRecord(spec),
      savedAt: `${date}T13:30:00`,
    },
  };
};

/**
 * 그날 반 전체의 하루 기록(EP-008).
 *
 * 보육일지의 원천이 이것이고, 출처 표시(FN-022)가 가리키는 기록 id도 여기서
 * 온다 — 서버가 일지를 만들 때 쓴 기록이 정확히 이 목록이다(window="date").
 */
export const fetchDayRecords = async (date: string): Promise<DayRecord[]> => {
  const list = await api.get<ListEnvelope<SpecRecord>>(`/records?date=${date}`);
  return list.items.map((r) => ({
    recordId: r.record_id,
    childId: intToChildId(r.child_id),
    date: r.date,
    activity: r.activity ?? "",
    note: r.note ?? "",
  }));
};

// 특정 날짜에 하루 기록이 있는 아이들의 UI id 집합 — "기록 완료" 판정용(EP-008).
// 실 서버 ChildOut에는 recorded 플래그가 없으므로, 그날 records를 조회해 채운다.
export const fetchDayRecordChildIds = async (
  date: string,
): Promise<string[]> => {
  const rows = await fetchDayRecords(date);
  return rows.map((r) => r.childId);
};

export const saveDailyRecord = async (
  input: DailyRecordInput,
): Promise<{ ok: boolean }> => {
  await api.post<SpecRecord>("/records", {
    child_id: childIdToInt(input.childId),
    date: input.date,
    ...encodeRecordToSpec(input),
  });
  return { ok: true };
};

// ---------- 문서 (EP-010~015) ----------

/** UI는 문서를 (type,childId)로 다룬다 — 명세의 document_id로 해소한다(EP-012). */
async function resolveDocumentId(
  type: DocType,
  childId: string | null,
  date?: string | null,
): Promise<number | null> {
  const params = new URLSearchParams({ type: docTypeToSpec(type) });
  if (childId) params.set("child_id", String(childIdToInt(childId)));
  // 날짜 단위 문서(보육일지)는 **날짜까지 줘야 그 날의 문서**가 잡힌다(EP-012).
  // 안 주면 목록의 첫 문서가 잡혀, 8월 20일을 골라 놓고 오늘 일지를 고치게 된다.
  if (date) params.set("date", date);
  const list = await api.get<ListEnvelope<SpecDocumentListItem>>(
    `/documents?${params.toString()}`,
  );
  return list.items[0]?.document_id ?? null;
}

/**
 * 이미 있는 초안만 가져온다. 없으면 `null`.
 *
 * 예전에는 이 함수가 "없으면 만든다"까지 했다. 그래서 화면을 열기만 해도 LLM이
 * 돌았다 — 교사가 보육일지 화면을 눌러 본 것만으로 초안이 생기고 토큰이 나갔고,
 * 뒤로 갔다 다시 오면 또 생성됐다. 생성은 사람이 버튼을 눌러야 일어난다
 * (불변 원칙: AI는 초안까지, 시작과 확정은 사람이).
 */
export const fetchDocumentDraft = async (
  type: DocType,
  childId: string | null,
  date?: string | null,
): Promise<DocumentDraft | null> => {
  const id = await resolveDocumentId(type, childId, date);
  if (id == null) return null;
  return mapDoc(await api.get<SpecDocument>(`/documents/${id}`));
};

/** 초안을 새로 만든다(EP-010). 「초안 만들기」·「다시 생성」이 부른다. */
export const generateDocumentDraft = async (
  type: DocType,
  childId: string | null,
  topic?: string,
  className?: string | null,
  /** 날짜 단위 문서(보육일지)에서 교사가 고른 날. 없으면 오늘. */
  date?: string | null,
  /**
   * 놀이이야기가 쓰는 추가 선택(SCR-018). 다른 문서는 넘기지 않는다.
   *
   * 자리 인자를 더 늘리지 않으려고 객체로 받는다 — 이 함수는 이미 다섯 개를
   * 받고 있어서, 여섯 번째부터는 호출부에서 무엇이 무엇인지 읽을 수 없다.
   */
  opts?: { picks?: PlayPick[]; playCount?: number },
): Promise<DocumentDraft> => {
  const body: {
    type: SpecDocType;
    child_id?: number;
    class_name?: string;
    date?: string;
    period_from?: string;
    period_to?: string;
    topic?: string;
    picks?: { activity: string; date?: string }[];
    play_count?: number;
  } = { type: docTypeToSpec(type) };
  if (childId) body.child_id = childIdToInt(childId);
  if (type === "notice" || type === "journal") body.date = date || TODAY;
  if (type === "plan") {
    body.period_from = WEEK_FROM;
    body.period_to = WEEK_TO;
  }
  if (type === "plan_monthly") {
    body.period_from = MONTH_FROM;
    body.period_to = MONTH_TO;
  }
  // 놀이이야기는 **반 단위** 문서다. 아이 하나가 아니라 반 하나의 한 달을
  // 묶으므로 범위를 정하는 것이 child_id가 아니라 class_name이다. 서버는
  // 반이 없으면 400을 준다 — 조용히 기관 전체로 넓히지 않는다.
  if (type === "play_story") {
    const cls = className?.trim();
    if (cls) body.class_name = cls;
    body.period_from = MONTH_FROM;
    body.period_to = MONTH_TO;
  }
  // 교사가 정한 놀이 주제. 빈 문자열은 보내지 않는다 — 서버는 값이 없을 때만
  // 기록에서 주제를 뽑는데, 빈 문자열을 보내면 "주제를 줬다"로 읽힌다.
  const trimmed = topic?.trim();
  if (trimmed) body.topic = trimmed;

  // 고른 놀이·개수. 비어 있으면 키를 아예 넣지 않는다 — 서버는 값이 없을 때
  // 도입 이전과 똑같이 동작하고, 빈 배열을 보내면 "고르긴 골랐다"로 읽힌다.
  const picks = (opts?.picks ?? [])
    .map((p) => ({ activity: p.activity.trim(), date: p.date }))
    .filter((p) => p.activity);
  if (picks.length > 0) body.picks = picks;
  if (opts?.playCount) body.play_count = opts.playCount;

  return mapDoc(await api.post<SpecDocument>("/documents/generate", body));
};

/** 교사가 고른 놀이 하나. `date`가 있으면 그날의 그 놀이로 못 박는다. */
export type PlayPick = { activity: string; date?: string };

/** 기간 안에 실제로 한 놀이(EP-054). 많이 한(며칠 했는가) 순서다. */
export type MonthActivity = {
  activity: string;
  days: number;
  /** `YYYY-MM-DD` — 화면이 달력에 꽂는다 */
  dates: string[];
  recordCount: number;
  childCount: number;
};

export const fetchMonthActivities = async (
  periodFrom: string,
  periodTo: string,
  className?: string | null,
): Promise<MonthActivity[]> => {
  const params = new URLSearchParams({
    period_from: periodFrom,
    period_to: periodTo,
  });
  const cls = className?.trim();
  if (cls) params.set("class_name", cls);

  const r = await api.get<{
    items: {
      activity: string;
      days: number;
      dates: string[];
      record_count: number;
      child_count: number;
    }[];
  }>(`/records/activities?${params.toString()}`);

  return (r.items ?? []).map((i) => ({
    activity: i.activity,
    days: i.days,
    dates: i.dates ?? [],
    recordCount: i.record_count,
    childCount: i.child_count,
  }));
};

/**
 * 칸 하나만 다시 만든다(EP-055).
 *
 * **저장하지 않는다.** 서버는 텍스트만 돌려주고, 반영할지는 화면이 정한다 —
 * 교사가 새 문안을 보고 무를 수 있어야 한다.
 */
export const regenerateDocumentBlock = async (
  documentId: number,
  blockLabel: string,
  opts?: { activity?: string; date?: string },
): Promise<string> => {
  const body: { block_label: string; activity?: string; date?: string } = {
    block_label: blockLabel,
  };
  if (opts?.activity) body.activity = opts.activity;
  if (opts?.date) body.date = opts.date;

  const r = await api.post<{ text: string }>(
    `/documents/${documentId}/block`,
    body,
  );
  return r.text ?? "";
};

/** EP-027 활동 추천. 서버가 실패해도 빈 목록으로 답한다. */
export const fetchActivityRecommendations = async (
  className: string | null,
): Promise<ActivityRecommendations> => {
  const params = className
    ? `?class_name=${encodeURIComponent(className)}`
    : "";
  const res = await api.get<{
    items: { title: string; domain: string; reason: string }[];
    total: number;
    season?: string | null;
    age_label?: string | null;
  }>(`/activities/recommend${params}`);
  return {
    items: res.items ?? [],
    total: res.total ?? 0,
    season: res.season ?? null,
    ageLabel: res.age_label ?? null,
  };
};

export const fetchNoticeQueue = async (): Promise<NoticeQueue> => {
  const [children, recs, notices] = await Promise.all([
    fetchChildren(),
    api.get<ListEnvelope<SpecRecord>>(`/records?date=${TODAY}`),
    api.get<ListEnvelope<SpecDocumentListItem>>("/documents?type=notice"),
  ]);
  const recordedIds = new Set(recs.items.map((r) => r.child_id));
  const statusByChild = new Map<number, DocStatus>(
    notices.items.map((n) => [n.child_id ?? -1, n.status]),
  );
  const withRecord = children.filter((c) =>
    recordedIds.has(childIdToInt(c.id)),
  );
  // 초안이 없는 아이는 status를 null로 둔다. 예전에는 "draft"로 채워서, 아직
  // 아무것도 만들지 않았는데도 목록에 "검토 대기"로 떴다.
  const queue = withRecord.map((c) => ({
    childId: c.id,
    name: c.name,
    color: c.color,
    status: statusByChild.get(childIdToInt(c.id)) ?? null,
  }));
  return {
    generated: queue.filter((q) => q.status !== null).length,
    ready: queue.length,
    total: children.length,
    confirmed: queue.filter(
      (q) => q.status === "confirmed" || q.status === "sent",
    ).length,
    sent: queue.filter((q) => q.status === "sent").length,
    queue,
    excluded: children
      .filter((c) => !recordedIds.has(childIdToInt(c.id)))
      .map((c) => c.name),
  };
};

export const generateAllNotices = async (): Promise<{
  created: number;
  total: number;
}> => {
  const res = await api.post<{
    generated: unknown[];
    failed: unknown[];
  }>("/documents/generate", { type: "notice", scope: "class", date: TODAY });
  return {
    created: res.generated.length,
    total: res.generated.length + res.failed.length,
  };
};

export const saveWorkingCopy = async (
  type: DocType,
  childId: string | null,
  content: string,
  date?: string | null,
): Promise<{ ok: boolean }> => {
  const id = await resolveDocumentId(type, childId, date);
  if (id == null) return { ok: false };
  await api.put(`/documents/${id}/draft`, { working: content });
  return { ok: true };
};

/**
 * EP-014 확정.
 *
 * `content`가 `null`이면 `final`을 **보내지 않는다** — 서버가 저장해 둔 작업본에서
 * 확정본을 만든다. 칸 단위로 편집한 문서가 이 경우다: 서버는 `final or working`
 * 순으로 고르므로, 화면이 들고 있던 평문을 같이 보내면 **칸 편집 이전의 옛 글이
 * 확정본으로 굳는다**(칸 저장은 서버 쪽 `working`만 갱신한다).
 */
export const confirmDocument = async (
  type: DocType,
  childId: string | null,
  content: string | null,
  date?: string | null,
): Promise<DocumentDraft> => {
  const id = await resolveDocumentId(type, childId, date);
  if (id == null)
    throw new ApiError(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
  return mapDoc(
    await api.post<SpecDocument>(
      `/documents/${id}/confirm`,
      content == null ? {} : { final: content },
    ),
  );
};

export const sendDocument = async (
  type: DocType,
  childId: string | null,
  date?: string | null,
): Promise<{ ok: boolean }> => {
  const id = await resolveDocumentId(type, childId, date);
  if (id == null) return { ok: false };
  await api.post(`/documents/${id}/send`);
  return { ok: true };
};

/**
 * 칸 단위 저장 — EP-013 `PUT /api/documents/{id}/draft`.
 *
 * **바뀐 칸만 보낸다.** 서버가 기존 칸에 병합하므로 전부 다시 보낼 이유가 없고,
 * 두 칸을 동시에 고치다 서로의 값을 덮어쓰는 일도 줄어든다.
 * 평문 통편집(`working`)은 `saveWorkingCopy`가 계속 맡는다 — 활성 템플릿이 없는
 * 문서는 예전처럼 한 덩어리다.
 */
export const saveDocumentCells = async (
  type: DocType,
  childId: string | null,
  cells: Record<string, string>,
  date?: string | null,
): Promise<{ ok: boolean }> => {
  const id = await resolveDocumentId(type, childId, date);
  if (id == null) return { ok: false };
  if (Object.keys(cells).length === 0) return { ok: true };
  await api.put(`/documents/${id}/draft`, { cells });
  return { ok: true };
};

// ---------- 완성 문서 파일 (EP-036·038) ----------

/**
 * EP-038 「문서 만들기」 — 확정 문서를 활성 양식에 채워 완성 파일을 만든다.
 *
 * 생성·확정과 분리된 별도 단계다(명세 1.5절). 다시 불러도 안전하다(멱등) —
 * 같은 키로 덮어쓰므로 양식을 바꾼 뒤 다시 만들 수 있다.
 *
 * 오류는 화면이 갈라 처리한다:
 * `409 NOT_CONFIRMED`(먼저 확정) · `409 NO_ACTIVE_TEMPLATE`(SCR-015로 안내 —
 * **오류 응답이지만 비정상은 아니다**) · `422 RENDER_FAILED`(표 구조 확인).
 */
export const renderDocumentFile = async (
  type: DocType,
  childId: string | null,
  date?: string | null,
): Promise<{ fileKey: string | null; status: FileRenderStatus }> => {
  const id = await resolveDocumentId(type, childId, date);
  if (id == null)
    throw new ApiError(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
  const res = await api.post<SpecRenderFile>(`/documents/${id}/file`);
  return { fileKey: res.file_key ?? null, status: res.file_render_status };
};

/**
 * EP-036 내려받기. 응답은 JSON이 아니라 파일 바이너리다.
 *
 * 확장자·Content-Type을 여기서 정하지 않는다 — 서식을 채운 결과는 `.hwpx`,
 * 평문 폴백은 `.docx`라 고정할 수 없고, 서버가 `Content-Disposition`으로
 * 파일명을 준다.
 */
export const downloadDocumentFile = async (
  type: DocType,
  childId: string | null,
  date?: string | null,
): Promise<DownloadedFile> => {
  const id = await resolveDocumentId(type, childId, date);
  if (id == null)
    throw new ApiError(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
  return api.getFile(`/documents/${id}/file`);
};

// ---------- 양식 템플릿 (EP-032~035·037·052) — SCR-015 ----------

function mapStructure(
  meta: SpecStructureMeta | null,
): TemplateStructure | null {
  // v1(구 mock 분석)으로 등록돼 이미 활성화된 템플릿이 DB에 남아 있다. 칸 정보가
  // 아예 없으므로 미리보기를 그릴 수 없다 — 없는 것으로 다룬다.
  if (!meta || meta.version !== 2 || !Array.isArray(meta.cells)) return null;
  return {
    sourceFormat: meta.source_format ?? null,
    tables: (meta.tables ?? []).map((t) => ({
      index: t.index,
      rows: t.rows,
      cols: t.cols,
      nested: t.nested ?? false,
    })),
    cells: meta.cells.map((c) => ({
      key: c.key,
      table: c.table,
      row: c.row,
      col: c.col,
      rowSpan: c.row_span,
      colSpan: c.col_span,
      label: c.label,
      empty: c.empty,
      existingText: c.existing_text ?? "",
      budgetChars: c.budget_chars ?? 0,
    })),
  };
}

function mapTemplate(t: SpecTemplate): FormTemplate {
  const structure = mapStructure(t.structure_meta);
  return {
    id: t.template_id,
    docType: docTypeFromSpec(t.doc_type) as TemplateDocType,
    fileKey: t.file_key,
    // 옛 배포본은 이 필드를 아직 보내지 않는다(백엔드 반영 전) — 빈 문자열로
    // 두면 화면이 `undefined`를 이름인 것처럼 보여 주는 사고 없이 "없음"으로
    // 처리할 수 있다.
    fileName: t.file_name ?? "",
    structure,
    analysisFailed: t.structure_meta?.analysis_failed === true,
    active: t.active,
    styleEnabled: t.style_enabled ?? false,
    createdAt: t.created_at,
    hasStructure: structure !== null,
  };
}

const templateDocTypeToSpec = (t: TemplateDocType): SpecTemplateDocType =>
  docTypeToSpec(t) as SpecTemplateDocType;

/**
 * EP-032 업로드·구조 분석. **항상 `active:false`로 등록된다** — 사람이
 * 미리보기를 확인하고 활성화(EP-037)해야 실제로 쓰인다.
 *
 * 던지는 `ApiError.code`를 화면이 갈라 처리해야 한다. 특히
 * `415 HWP_NEEDS_CONVERSION`은 "지원하지 않는 형식"이 아니라 **변환 방법**을
 * 안내하는 자리다 — 서버 `message`에 그 안내가 그대로 담겨 온다.
 */
export const uploadTemplate = async (
  docType: TemplateDocType,
  file: File,
): Promise<FormTemplate> => {
  const form = new FormData();
  form.append("doc_type", templateDocTypeToSpec(docType));
  form.append("file", file);
  return mapTemplate(await api.postForm<SpecTemplate>("/templates", form));
};

/** EP-033 목록. 교체 이력까지 보려면 `activeOnly`를 켜지 않는다. */
export const fetchTemplates = async (
  docType?: TemplateDocType,
  activeOnly = false,
): Promise<FormTemplate[]> => {
  const params = new URLSearchParams();
  if (docType) params.set("type", templateDocTypeToSpec(docType));
  if (activeOnly) params.set("active_only", "true");
  const qs = params.toString();
  const res = await api.get<ListEnvelope<SpecTemplateListItem>>(
    `/templates${qs ? `?${qs}` : ""}`,
  );
  // 목록에는 `structure_meta`가 오지 않는다 — 칸 미리보기는 상세(EP-034) 몫이다.
  return res.items.map((t) => ({
    id: t.template_id,
    docType: docTypeFromSpec(t.doc_type) as TemplateDocType,
    fileKey: "",
    // 옛 배포본은 이 필드를 아직 보내지 않는다(백엔드 반영 전) — 빈 문자열로
    // 두면 화면이 `undefined`를 이름인 것처럼 보여 주는 사고 없이 "없음"으로
    // 처리할 수 있다.
    fileName: t.file_name ?? "",
    structure: null,
    analysisFailed: false,
    active: t.active,
    styleEnabled: t.style_enabled ?? false,
    createdAt: t.created_at,
    hasStructure: false,
  }));
};

/** EP-034 상세 — SCR-015 미리보기와 문서 화면의 표 구조 캐시가 함께 쓴다. */
export const fetchTemplate = async (id: number): Promise<FormTemplate> =>
  mapTemplate(await api.get<SpecTemplate>(`/templates/${id}`));

/**
 * EP-037 활성화. 같은 문서 타입의 기존 활성 템플릿은 서버가 자동으로 내린다
 * (타입당 활성 1개). 분석 실패 템플릿은 `409 TEMPLATE_NOT_ANALYZABLE`.
 */
export const activateTemplate = async (
  id: number,
): Promise<{ id: number; active: boolean }> => {
  const res = await api.post<SpecTemplateActivate>(`/templates/${id}/activate`);
  return { id: res.template_id, active: res.active };
};

/** EP-035 비활성화. 파일은 지우지 않는다 — 교체 이력을 남긴다. */
export const deactivateTemplate = async (
  id: number,
): Promise<{ id: number; active: boolean }> => {
  const res = await api.del<SpecTemplateDeactivate>(`/templates/${id}`);
  return { id: res.template_id, active: res.active };
};

/**
 * EP-052 문체 예시 토글. **기본 꺼짐이고, 교사가 내용을 확인한 뒤 켠다.**
 *
 * 켜면 서식에 이미 적혀 있던 문안이 생성 프롬프트에 실린다. 교사가 올리는 서식은
 * 빈 양식이 아니라 작년 작성본인 경우가 많고 실제 아동·교사 이름이 들어 있다.
 * 서버가 마스킹하지만 완전하지 않으므로, 화면이 `existingText`를 보여 주고
 * 경고를 읽게 한 뒤에 이 함수를 부른다.
 */
export const setTemplateStyleEnabled = async (
  id: number,
  enabled: boolean,
): Promise<FormTemplate> =>
  mapTemplate(
    await api.patch<SpecTemplate>(`/templates/${id}/style`, {
      style_enabled: enabled,
    }),
  );

/**
 * 서식 원본 파일 내려받기 — 명세에 아직 없는 엔드포인트다(SCR-015 후속).
 *
 * "지금 어떤 서식을 올렸었는지 확인할 수 없다"는 문제를 풀기 위해 추가했다.
 * 완성 문서(EP-036)와 달리 **채워진 결과가 아니라 사람이 올린 원본**을 그대로
 * 돌려준다 — 등록 이력에서 파일명만으로는 부족할 때 한글/워드로 직접 열어
 * 확인할 수 있어야 한다. 실서버에도 `GET /api/templates/{id}/file`을 EP-036과
 * 같은 바이너리 스트림 방식으로 추가해야 한다.
 */
export const downloadTemplateFile = async (
  id: number,
): Promise<DownloadedFile> => api.getFile(`/templates/${id}/file`);

// ---------- 사진 (EP-016~019) ----------

/**
 * EP-016 — 사진 업로드·분류 트리거. 명세상 `multipart/form-data`의 `files`
 * 필드(파일 여러 장)가 필수다. 본문 없이 부르면 서버가 VALIDATION_ERROR로 막는다.
 */
export const uploadPhotos = async (
  files: File[],
): Promise<{
  ok: boolean;
  added: number;
}> => {
  const form = new FormData();
  files.forEach((file) => form.append("files", file, file.name));
  const res = await api.postForm<ListEnvelope<SpecPhoto>>("/photos", form);
  return { ok: true, added: res.total };
};

export const fetchPhotoInbox = async (): Promise<PhotoInbox> => {
  const res = await api.get<SpecPhotoList>("/photos");
  const photos = res.items.map(mapPhoto);
  return {
    photos,
    classified: photos.filter((p) => p.status === "classified").length,
    classifying: photos.filter((p) => p.status === "classifying").length,
    unmatched: photos.filter((p) => p.status === "unmatched").length,
    total: photos.length,
  };
};

export const assignPhoto = async (
  photoId: number,
  childId: string,
): Promise<{ ok: boolean }> => {
  await api.put(`/photos/${photoId}/assign`, {
    child_id: childIdToInt(childId),
  });
  return { ok: true };
};

export const sendPhotos = async (ids: number[]): Promise<{ sent: number }> => {
  const res = await api.post<{ sent: number[]; sent_at: string }>(
    "/photos/send",
    { photo_ids: ids },
  );
  return { sent: res.sent.length };
};

// 서버 다중 발달영역 태그 → UI 도메인 배열(빈/미매핑 제거). 매트릭스와 리스트가
// 어긋나지 않도록 관찰 기록의 태그는 전체를 보존한다.
const domainsFromSpec = (specTags: SpecDomain[] = []): DevelopmentDomain[] =>
  specTags
    .map((t) => domainFromSpec(t))
    .filter((t): t is DevelopmentDomain => t != null);

// ---------- 관찰 (EP-005 조회 / EP-009 태그 / 관찰 직접 추가) ----------

export const fetchObservations = async (
  childId: string,
): Promise<ObservationData> => {
  const spec = await api.get<SpecObservations>(
    `/children/${childIdToInt(childId)}/observations`,
  );
  return {
    domains: DEV_DOMAINS.map((name) => ({
      name,
      count: spec.matrix[domainToSpec(name) as SpecDomain] ?? 0,
    })),
    timeline: spec.timeline.map((o) => ({
      id: intToRecordId(o.record_id),
      childId,
      date: o.date,
      tag: domainFromSpec(o.dev_domain_tags[0]),
      tags: domainsFromSpec(o.dev_domain_tags),
      manualTag: o.tags_edited,
      memo: o.note,
    })),
  };
};

/**
 * 관찰 메모의 발달영역 태그를 바꾼다(EP-009).
 *
 * 태그는 **여러 개**일 수 있다 — 하나의 놀이가 여러 영역에 걸치는 게 오히려
 * 보통이다(블록 길 위를 걸으며 리듬에 맞춰 몸을 움직이면 신체운동이자
 * 예술경험이다). 와이어와 DB는 처음부터 배열이었는데 화면만 하나로 좁혀
 * 있었다.
 */
export const updateObservationTag = async (
  id: string,
  tags: DevelopmentDomain[],
): Promise<ObservationEntry> => {
  const res = await api.put<{
    record_id: number;
    dev_domain_tags: SpecDomain[];
    tags_edited: boolean;
  }>(`/records/${recordIdToInt(id)}/tags`, {
    dev_domain_tags: tags.map(domainToSpec),
  });
  // UI는 이 반환값을 쓰지 않고 관찰 쿼리를 무효화한다(childId/date/memo는 재조회로 채워짐).
  return {
    id,
    childId: "",
    date: TODAY,
    tag: domainFromSpec(res.dev_domain_tags[0]),
    tags: domainsFromSpec(res.dev_domain_tags),
    manualTag: res.tags_edited,
    memo: "",
  };
};

// 관찰은 곧 하루 기록이다(명세: 관찰 누적 = records). 서버에는 관찰 전용 POST가
// 없으므로(POST /children/{id}/observations → 405) 하루 기록을 만든다. 서버가
// note로 발달영역을 자동 태깅하므로, 교사가 태그를 직접 골랐다면 기록 생성 후
// EP-009로 그 태그를 덮어써 수동 태그(tags_edited)로 박제한다.
//
// ⚠️ POST /records는 (child_id, date) 풀 업서트라, 부분 필드만 보내면 기존
// activity·meal·nap이 null로 덮여 그날 하루 기록이 파괴된다. 따라서 먼저 같은
// 날짜의 기존 기록을 조회해 병합한 뒤 전체 레코드를 보낸다(데이터 손실 방지).
export const addObservation = async (
  childId: string,
  tags: DevelopmentDomain[],
  memo: string,
): Promise<ObservationEntry> => {
  const specTags = tags.map(domainToSpec);
  const cid = childIdToInt(childId);
  const existing = (
    await api.get<ListEnvelope<SpecRecord>>(
      `/records?child_id=${cid}&date=${TODAY}`,
    )
  ).items[0];
  const rec = await api.post<SpecRecord>("/records", {
    child_id: cid,
    date: TODAY,
    // 하루 기록 필드는 기존 값을 보존한다(관찰 추가가 덮어쓰지 않도록)
    activity: existing?.activity ?? "",
    meal: existing?.meal ?? "",
    nap: existing?.nap ?? "",
    note: memo,
    dev_domain_tags: specTags.length
      ? specTags
      : (existing?.dev_domain_tags ?? []),
  });
  let savedTags: SpecDomain[] = rec.dev_domain_tags ?? [];
  let edited = rec.tags_edited ?? false;
  if (specTags.length) {
    // 저장 직후 한 번 더 PUT하는 이유: 태그를 **수동으로 박제**하려면
    // tags_edited를 세워야 하고, 그건 태그 전용 엔드포인트만 한다.
    const upd = await api.put<{
      record_id: number;
      dev_domain_tags: SpecDomain[];
      tags_edited: boolean;
    }>(`/records/${rec.record_id}/tags`, { dev_domain_tags: specTags });
    savedTags = upd.dev_domain_tags;
    edited = upd.tags_edited;
  }
  return {
    id: intToRecordId(rec.record_id),
    childId,
    date: rec.date,
    tag: domainFromSpec(savedTags[0]),
    tags: domainsFromSpec(savedTags),
    manualTag: edited,
    memo: rec.note ?? memo,
  };
};

// ---------- 평가제 체크리스트 (EP-026) ----------

export const fetchChecklist = async (): Promise<ChecklistData> => {
  const spec = await api.get<SpecChecklist>("/checklist");
  return {
    items: spec.items.map((i) => ({
      id: i.id ?? i.indicator,
      ok: i.status === "met",
      title: i.indicator,
      desc: i.hint ?? "",
    })),
    met: spec.met,
    total: spec.total,
    missingObservations: spec.missing_observations ?? [],
  };
};

// ---------- 지표 (EP-028) ----------

const fmtMinutes = (m: number | null | undefined): string => {
  if (m == null) return "-";
  const total = Math.round(m * 60);
  return `${Math.floor(total / 60)}분 ${String(total % 60).padStart(2, "0")}초`;
};

const DOC_LABEL_KO: Record<string, string> = {
  notice: "알림장",
  journal: "보육일지",
  weekly_plan: "주간 계획안",
  monthly_plan: "월간 계획안",
  dev_eval: "발달평가서",
  play_story: "놀이이야기",
};

export const fetchMetrics = async (): Promise<MetricsSummary> => {
  const s = await api.get<SpecMetrics>("/metrics/summary");
  const adoptionRate = Math.round((s.adoption_rate ?? 0) * 100);
  const combinedRate = Math.round((s.minor_edit_rate ?? 0) * 100);
  // 확정 문서가 없으면 서버는 분포·단축률·비용을 null로 준다(명세 EP-028 예외 1).
  // 빈 상태에서도 화면이 깨지지 않도록 모든 파생 필드를 null 가드한다.
  const timeReduction = s.time_reduction_rate ?? {};
  const baselines = s.baseline_minutes ?? {};
  return {
    adoptionRate,
    minorEditGainPt: combinedRate - adoptionRate,
    combinedRate,
    editDistribution: Object.values(s.edit_rate_distribution ?? {}),
    timeSavings: Object.keys(timeReduction).map((k) => {
      const base = baselines[k] ?? 0;
      const red = timeReduction[k];
      return {
        docType: DOC_LABEL_KO[k] ?? k,
        baseline: fmtMinutes(base),
        actual: fmtMinutes(base * (1 - red)),
        reductionPct: Math.round(red * 100),
      };
    }),
    perDocTime: fmtMinutes(s.avg_minutes_per_doc),
    taggingMatchRate: Math.round((s.tagging_agreement_rate ?? 0) * 100),
    monthlyCost:
      s.token_cost?.krw != null
        ? `월 ${s.token_cost.krw.toLocaleString()}원`
        : "-",
    dailyConfirmed: s.daily_confirmed ?? [],
    // (r9) 귀속 가능한 문서가 하나도 없으면 서버가 null을 준다.
    byUser: (s.by_user ?? []).map((u) => ({
      userId: intToUserId(u.user_id),
      name: u.name,
      confirmedCount: u.confirmed_count,
      adoptionRate:
        u.adoption_rate == null ? null : Math.round(u.adoption_rate * 100),
      editRateAvgPct:
        u.edit_rate_avg == null ? null : Math.round(u.edit_rate_avg * 100),
      perDocTime: fmtMinutes(u.avg_minutes_per_doc),
    })),
    unattributedCount: s.unattributed_count ?? 0,
  };
};

// ---------- 문체 예시 (EP-052/053) ----------
//
// 기관이 예전에 쓰던 문서 본문. 알림장 초안이 그 원의 말투를 따라가게 하려고
// 프롬프트 고정부에 실린다(백엔드 `services/style_samples.py`).
//
// 서버는 저장하기 전에 아동·교사 이름을 가리므로 **응답이 요청과 다를 수
// 있다.** 화면은 응답을 그대로 다시 그려야 교사가 무엇이 지워졌는지 본다.

export const fetchStyleSamples = async (type: DocType): Promise<string[]> => {
  const r = await api.get<{ type: string; samples: string[] }>(
    `/style-samples?type=${encodeURIComponent(type)}`,
  );
  return r.samples ?? [];
};

export const saveStyleSamples = async (
  type: DocType,
  samples: string[],
): Promise<string[]> => {
  // 빈 칸은 여기서 걷어낸다 — 서버도 걸러 내지만, 보낸 것과 돌려받은 것의
  // 개수가 달라지면 화면이 칸을 다시 그리며 커서가 튄다.
  const r = await api.put<{ type: string; samples: string[] }>("/style-samples", {
    type,
    samples: samples.map((t) => t.trim()).filter(Boolean),
  });
  return r.samples ?? [];
};

// ---------- 설정·시드 (EP-029~031) + 로컬 양식 동기화 ----------

export const fetchSettings = async (): Promise<AppSettings> => {
  const s = await api.get<SpecSettings>("/settings");
  return {
    replayMode: s.replay_enabled,
    models: { generate: s.generation_model, light: s.light_model },
  };
};

export const setReplayMode = async (on: boolean): Promise<{ ok: boolean }> => {
  await api.put("/settings/replay", { enabled: on });
  return { ok: true };
};

export const reloadSeed = async (): Promise<{ ok: boolean }> => {
  await api.post("/seed/load", { scenario: "default" });
  return { ok: true };
};

// 로컬 양식 텍스트 동기화(데스크톱 부팅 시). r6에서 양식 등록은 EP-032
// multipart 파일 업로드(.docx/.hwpx)로 바뀌었고 텍스트 JSON 계약은 사라졌다 —
// 이 경로로 실 서버 `/templates`를 부르면 422다. 실제 양식 등록은 SCR-015의
// 파일 업로드(별도 기능)로 하므로, 여기서는 서버를 부르지 않고 조용히 넘어간다.
export const syncTemplates = async (
  templates: Partial<Record<DocType, string>>,
): Promise<{ ok: boolean; applied: string[] }> => {
  return { ok: true, applied: Object.keys(templates) };
};
