import { ApiError, api } from "@/lib/api/client";
import type { ListEnvelope } from "@/lib/api/client";
import {
  childIdToInt,
  consultIdToInt,
  decodeSpecRecord,
  docTypeFromSpec,
  docTypeToSpec,
  domainFromSpec,
  domainToSpec,
  encodeRecordToSpec,
  intToChildId,
  intToConsultId,
  intToRecordId,
  recordIdToInt,
  summaryFromSpec,
  summaryToSpec,
} from "@/lib/api/spec";
import type {
  SpecChecklist,
  SpecChild,
  SpecConsult,
  SpecDocType,
  SpecDocument,
  SpecDocumentListItem,
  SpecDomain,
  SpecMetrics,
  SpecObservations,
  SpecPhoto,
  SpecPhotoList,
  SpecRecord,
  SpecSettings,
  SpecUser,
} from "@/lib/api/spec";
import { TODAY } from "@/lib/constants";
import { DEV_DOMAINS } from "@/lib/types";
import type {
  AppSettings,
  ChecklistData,
  Child,
  ConsultData,
  ConsultSession,
  DailyRecord,
  DailyRecordInput,
  DevelopmentDomain,
  DocStatus,
  DocType,
  DocumentDraft,
  LoginInput,
  LoginResponse,
  MetricsSummary,
  NoticeQueue,
  ObservationData,
  ObservationEntry,
  Photo,
  PhotoInbox,
  RecordSummary,
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
  const idx = childIdInt - 101;
  return AVATAR_COLORS[
    ((idx % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length
  ];
};

// ---------- 매퍼 (명세 와이어 → UI 타입) ----------

function mapChild(c: SpecChild): Child {
  return {
    id: intToChildId(c.child_id),
    name: c.name,
    birthDate: c.birth,
    gender: c.gender ?? "남",
    guardian: c.guardian ?? "",
    allergy: c.allergy ?? undefined,
    color: colorFor(c.child_id),
    recorded: c.recorded ?? false,
    attending: c.attending ?? true,
  };
}

function mapDoc(spec: SpecDocument): DocumentDraft {
  return {
    type: docTypeFromSpec(spec.type),
    childId: spec.child_id ? intToChildId(spec.child_id) : null,
    label: spec.label ?? "",
    content: spec.draft,
    working: spec.working ?? spec.final ?? spec.draft,
    status: spec.status,
    editDistance:
      spec.edit_distance == null ? null : Math.round(spec.edit_distance * 100),
    generatedAt: spec.created_at,
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

// ---------- 인증 (EP-001) ----------

export const login = async (input: LoginInput): Promise<LoginResponse> => {
  const u = await api.post<SpecUser>("/auth/login", input);
  return {
    token: "session", // 세션 쿠키 인증 — 토큰 헤더는 쓰지 않는다(명세 1.2)
    teacher: {
      name: u.name,
      role: u.role === "teacher" ? "담임" : "원장",
      className: u.center_name,
    },
  };
};

// ---------- 아동 (EP-004) ----------

export const fetchChildren = async (): Promise<Child[]> => {
  const list = await api.get<ListEnvelope<SpecChild>>("/children");
  return list.items.map(mapChild);
};

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
): Promise<number | null> {
  const params = new URLSearchParams({ type: docTypeToSpec(type) });
  if (childId) params.set("child_id", String(childIdToInt(childId)));
  const list = await api.get<ListEnvelope<SpecDocumentListItem>>(
    `/documents?${params.toString()}`,
  );
  return list.items[0]?.document_id ?? null;
}

export const fetchDocumentDraft = async (
  type: DocType,
  childId: string | null,
  regenerate = false,
): Promise<DocumentDraft> => {
  if (!regenerate) {
    const id = await resolveDocumentId(type, childId);
    if (id != null) {
      return mapDoc(await api.get<SpecDocument>(`/documents/${id}`));
    }
  }
  const body: {
    type: SpecDocType;
    child_id?: number;
    date?: string;
    period_from?: string;
    period_to?: string;
  } = { type: docTypeToSpec(type) };
  if (childId) body.child_id = childIdToInt(childId);
  if (type === "notice" || type === "journal") body.date = TODAY;
  if (type === "plan") {
    body.period_from = "2026-07-13";
    body.period_to = "2026-07-17";
  }
  return mapDoc(await api.post<SpecDocument>("/documents/generate", body));
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
  const queue = withRecord.map((c) => ({
    childId: c.id,
    name: c.name,
    color: c.color,
    status: statusByChild.get(childIdToInt(c.id)) ?? ("draft" as DocStatus),
  }));
  return {
    generated: queue.length,
    total: children.length,
    confirmed: queue.filter((q) => q.status !== "draft").length,
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
): Promise<{ ok: boolean }> => {
  const id = await resolveDocumentId(type, childId);
  if (id == null) return { ok: false };
  await api.put(`/documents/${id}/draft`, { working: content });
  return { ok: true };
};

export const confirmDocument = async (
  type: DocType,
  childId: string | null,
  content: string,
): Promise<DocumentDraft> => {
  const id = await resolveDocumentId(type, childId);
  if (id == null)
    throw new ApiError(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.");
  return mapDoc(
    await api.post<SpecDocument>(`/documents/${id}/confirm`, {
      final: content,
    }),
  );
};

export const sendDocument = async (
  type: DocType,
  childId: string | null,
): Promise<{ ok: boolean }> => {
  const id = await resolveDocumentId(type, childId);
  if (id == null) return { ok: false };
  await api.post(`/documents/${id}/send`);
  return { ok: true };
};

// ---------- 사진 (EP-016~019) ----------

export const uploadPhotos = async (): Promise<{
  ok: boolean;
  added: number;
}> => {
  const res = await api.post<ListEnvelope<SpecPhoto>>("/photos");
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
      manualTag: o.tags_edited,
      memo: o.note,
    })),
  };
};

export const updateObservationTag = async (
  id: string,
  tag: DevelopmentDomain | null,
): Promise<ObservationEntry> => {
  const res = await api.put<{
    record_id: number;
    dev_domain_tags: SpecDomain[];
    tags_edited: boolean;
  }>(`/records/${recordIdToInt(id)}/tags`, {
    dev_domain_tags: tag ? [domainToSpec(tag)] : [],
  });
  // UI는 이 반환값을 쓰지 않고 관찰 쿼리를 무효화한다(childId/date/memo는 재조회로 채워짐).
  return {
    id,
    childId: "",
    date: TODAY,
    tag: domainFromSpec(res.dev_domain_tags[0]),
    manualTag: res.tags_edited,
    memo: "",
  };
};

export const addObservation = async (
  childId: string,
  tag: DevelopmentDomain | null,
  memo: string,
): Promise<ObservationEntry> => {
  const res = await api.post<{
    record_id: number;
    date: string;
    note: string;
    dev_domain_tags: SpecDomain[];
    tags_edited: boolean;
  }>(`/children/${childIdToInt(childId)}/observations`, {
    note: memo,
    dev_domain_tag: tag ? domainToSpec(tag) : null,
  });
  return {
    id: intToRecordId(res.record_id),
    childId,
    date: res.date,
    tag: domainFromSpec(res.dev_domain_tags[0]),
    manualTag: res.tags_edited,
    memo: res.note,
  };
};

// ---------- 상담 (EP-006 조회 / EP-025 확정) ----------

function mapConsult(c: SpecConsult, childId: string): ConsultSession {
  return {
    id: intToConsultId(c.consult_id),
    childId,
    date: c.created_at.slice(0, 10),
    topic: c.topic ?? "",
    transcript: c.transcript ?? [],
    summaryDraft: c.summary_draft ?? "",
    summaryFinal: c.summary_final ? summaryFromSpec(c.summary_final) : null,
    status: c.status === "confirmed" ? "confirmed" : "draft",
  };
}

export const fetchConsults = async (childId: string): Promise<ConsultData> => {
  const list = await api.get<ListEnvelope<SpecConsult>>(
    `/children/${childIdToInt(childId)}/consults`,
  );
  const sessions = list.items.map((c) => mapConsult(c, childId));
  return {
    current: sessions.find((s) => s.status === "draft") ?? sessions[0] ?? null,
    history: sessions,
  };
};

export const confirmConsult = async (
  id: string,
  summary: string,
): Promise<{ ok: boolean }> => {
  await api.post(`/consults/${consultIdToInt(id)}/confirm`, {
    summary_final: summaryToSpec(summary),
  });
  return { ok: true };
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
};

export const fetchMetrics = async (): Promise<MetricsSummary> => {
  const s = await api.get<SpecMetrics>("/metrics/summary");
  const adoptionRate = Math.round((s.adoption_rate ?? 0) * 100);
  const combinedRate = Math.round((s.minor_edit_rate ?? 0) * 100);
  return {
    adoptionRate,
    minorEditGainPt: combinedRate - adoptionRate,
    combinedRate,
    editDistribution: Object.values(s.edit_rate_distribution),
    timeSavings: Object.keys(s.time_reduction_rate).map((k) => {
      const base = s.baseline_minutes[k] ?? 0;
      const red = s.time_reduction_rate[k];
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
      s.token_cost.krw != null
        ? `월 ${s.token_cost.krw.toLocaleString()}원`
        : "-",
    dailyConfirmed: s.daily_confirmed ?? [],
  };
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

export const syncTemplates = (templates: Partial<Record<DocType, string>>) =>
  api.post<{ ok: boolean; applied: string[] }>("/templates", { templates });
