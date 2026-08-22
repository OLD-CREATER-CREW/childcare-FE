/**
 * 명세(final_API_명세서.md) 와이어 계약 타입 + UI↔명세 매핑 규약.
 *
 * 여기 있는 타입은 "선을 타고 오가는" 실제 백엔드 계약이다(정수 ID·영문 enum·
 * ISO 시각·{items,total} 봉투). 화면이 쓰는 UI 타입(lib/types)과의 변환은
 * seam(lib/api/index.ts)이 담당하고, 목(mocks/*)도 이 타입으로 응답을 만든다.
 *
 * 순수 모듈(react·msw 의존 없음) — seam과 mock 양쪽에서 import한다.
 */

import type {
  DailyRecordInput,
  DevelopmentDomain,
  DocType,
  MealAmount,
  NapQuality,
} from "@/lib/types";

// ---------- 발달영역(명세 EP-005) ----------

/** 명세 영문 enum */
export type SpecDomain =
  "physical" | "communication" | "social" | "art" | "nature";

const DOMAIN_TO_SPEC: Record<DevelopmentDomain, SpecDomain> = {
  신체운동: "physical",
  의사소통: "communication",
  사회관계: "social",
  예술경험: "art",
  자연탐구: "nature",
};

const DOMAIN_FROM_SPEC: Record<SpecDomain, DevelopmentDomain> = {
  physical: "신체운동",
  communication: "의사소통",
  social: "사회관계",
  art: "예술경험",
  nature: "자연탐구",
};

export const domainToSpec = (d: DevelopmentDomain | null): SpecDomain | null =>
  d ? DOMAIN_TO_SPEC[d] : null;

export const domainFromSpec = (d: SpecDomain | null | undefined) =>
  d ? DOMAIN_FROM_SPEC[d] : null;

// ---------- 문서 타입(명세 EP-010) ----------

/** 명세 type enum. UI의 plan은 weekly_plan, evaluation은 dev_eval에 대응 */
export type SpecDocType =
  | "notice"
  | "journal"
  | "weekly_plan"
  | "monthly_plan"
  | "dev_eval"
  | "play_story";

const DOCTYPE_TO_SPEC: Record<DocType, SpecDocType> = {
  notice: "notice",
  journal: "journal",
  plan: "weekly_plan",
  plan_monthly: "monthly_plan",
  evaluation: "dev_eval",
  // 놀이이야기는 UI 이름과 와이어 이름이 같다 — 계획안처럼 하나의 UI 종류가
  // 둘로 갈리는 사정이 없다.
  play_story: "play_story",
};

const DOCTYPE_FROM_SPEC: Record<SpecDocType, DocType> = {
  notice: "notice",
  journal: "journal",
  weekly_plan: "plan",
  monthly_plan: "plan_monthly",
  dev_eval: "evaluation",
  play_story: "play_story",
};

export const docTypeToSpec = (t: DocType): SpecDocType => DOCTYPE_TO_SPEC[t];
export const docTypeFromSpec = (t: SpecDocType): DocType =>
  DOCTYPE_FROM_SPEC[t];

// ---------- ID 브리지 (UI 문자열 ↔ 명세 정수) ----------
//
// UI는 아동·관찰(기록)·상담을 접두 문자열 키("c13"·"o68"·"cs3")로 다루고,
// 와이어는 정수 ID를 쓴다. 실 백엔드가 부여하는 정수 값은 예측할 수 없으므로
// (예: child_id가 13부터 시작) 오프셋을 두지 않고 **무손실 왕복**만 보장한다:
// 접두 문자(c/o/cs)는 표현용이고, 정수 값은 그대로 왕복한다.
//   intToChildId(13) → "c13" → childIdToInt("c13") → 13

export const childIdToInt = (id: string): number =>
  Number(id.replace(/\D/g, ""));
export const intToChildId = (n: number): string => `c${n}`;

// 계정도 같은 규율을 따른다 — 명세 정수 ID가 훅·화면까지 새면 백엔드가 user_id를
// UUID로 바꿀 때 seam 한 줄이 아니라 타입·훅·화면 전부를 고쳐야 한다.
export const userIdToInt = (id: string): number =>
  Number(id.replace(/\D/g, ""));
export const intToUserId = (n: number): string => `u${n}`;

export const recordIdToInt = (id: string): number =>
  Number(id.replace(/\D/g, ""));
export const intToRecordId = (n: number): string => `o${n}`;

export const consultIdToInt = (id: string): number =>
  Number(id.replace(/\D/g, ""));
export const intToConsultId = (n: number): string => `cs${n}`;

// ---------- 와이어 응답 타입 ----------

export type SpecList<T> = { items: T[]; total: number };

/** EP-003 응답 · EP-001/050/051 응답의 `user` */
export type SpecUser = {
  user_id: number;
  name: string;
  role: "teacher" | "director";
  center_id: number;
  center_name: string;
};

/** EP-001 로그인 / EP-051 회원가입 성공 응답 (명세 r11 — 토큰이 본문으로 온다) */
export type SpecAuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  user: SpecUser;
};

/** EP-050 갱신 응답 — 리프레시 토큰은 회전하지 않으므로 access만 온다 */
export type SpecRefresh = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  user?: SpecUser;
};

/** EP-043~048 계정. 비밀번호는 어떤 응답에도 실리지 않는다 */
export type SpecUserAccount = {
  user_id: number;
  username: string;
  name: string;
  role: "teacher" | "director";
  active: boolean;
  center_id: number;
  created_at?: string;
  updated_at?: string;
};

/** EP-049 본인 비밀번호 변경 응답 */
export type SpecPasswordChange = {
  ok: boolean;
  revoked_sessions: number;
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  /** keep_refresh_token이 유효했으면 null — 갖고 있던 것을 계속 쓴다 */
  refresh_token: string | null;
};

/** EP-039·040·041·042 — 아동 인적사항 전체(목록 EP-004보다 넓다) */
export type SpecChildDetail = {
  child_id: number;
  name: string;
  birth: string | null;
  class_name: string | null;
  gender: "male" | "female" | null;
  status: "enrolled" | "withdrawn";
  enrolled_at: string | null;
  withdrawn_at: string | null;
  memo: string | null;
  created_at?: string;
  updated_at?: string;
};

/** EP-004 (+ 목 부가 필드: 명세 응답의 상위집합, 실 백엔드는 무시 가능) */
export type SpecChild = {
  child_id: number;
  name: string;
  /** 이름만 등록한 아동은 생년월일이 비어 온다(EP-039는 이름만 필수) */
  birth: string | null;
  class_name: string;
  /** (r7) `male` · `female` · null(미입력) */
  gender?: "male" | "female" | null;
  /** (r7) `enrolled`(재원)·`withdrawn`(퇴소). 기본 쿼리가 enrolled라 목록엔 재원만 온다 */
  status?: "enrolled" | "withdrawn";
  // --- 목 부가(표현/현황) ---
  guardian?: string;
  allergy?: string | null;
  recorded?: boolean;
  attending?: boolean;
};

/** EP-007 / EP-008 하루 기록 */
export type SpecRecord = {
  record_id: number;
  child_id: number;
  date: string;
  activity?: string;
  meal?: string;
  nap?: string;
  note?: string;
  keywords?: string[];
  dev_domain_tags?: SpecDomain[];
  tags_edited?: boolean;
  audio_key?: string | null;
  created?: boolean;
};

/** EP-005 관찰 누적 */
export type SpecObservationItem = {
  record_id: number;
  date: string;
  note: string;
  dev_domain_tags: SpecDomain[];
  tags_edited: boolean;
};

export type SpecObservations = {
  child_id: number;
  matrix: Record<SpecDomain, number>;
  timeline: SpecObservationItem[];
  total: number;
};

/** EP-010 / EP-011 문서 */
export type SpecDocument = {
  document_id: number;
  type: SpecDocType;
  status: "draft" | "confirmed" | "sent";
  child_id?: number | null;
  draft: string;
  working?: string | null;
  final?: string | null;
  edit_distance?: number | null;
  source_record_ids?: number[];
  citations?: unknown[];
  /** 놀이이야기(play_story)만 채워진다. 다른 문서는 없거나 빈 배열. */
  photo_suggestions?: SpecPhotoSuggestion[];
  created_at: string;
  confirmed_at?: string | null;
  sent_at?: string | null;
  // --- 목 부가(화면 라벨) ---
  label?: string;
};

/** EP-010 놀이이야기 사진 후보. 놀이(날짜 + 활동) 단위로 묶여 온다. */
export type SpecPhotoSuggestion = {
  date: string;
  activity: string | null;
  record_ids: number[];
  photos: {
    photo_id: number;
    file_key: string;
    matched_child_id: number | null;
    similarity: number | null;
  }[];
};

/** EP-012 문서 목록 항목 */
export type SpecDocumentListItem = {
  document_id: number;
  type: SpecDocType;
  status: "draft" | "confirmed" | "sent";
  child_id?: number | null;
  created_at: string;
};

/** EP-016 / EP-017 사진 */
export type SpecPhoto = {
  photo_id: number;
  file_key: string;
  status: "classifying" | "classified" | "unmatched" | "sent";
  matched_child_id: number | null;
  similarity?: number | null;
  selected?: boolean;
  sent_at?: string | null;
  // --- 목 부가(실사진 대체 아이콘) ---
  icon?: string;
  taken_at?: string;
};

export type SpecPhotoList = SpecList<SpecPhoto> & { pending: number };

/** EP-006 상담 */
export type SpecConsultSummary = {
  core: string;
  requests: string;
  follow_up: string;
};

export type SpecConsult = {
  consult_id: number;
  child_id?: number;
  created_at: string;
  status: "transcribing" | "summarizing" | "draft" | "confirmed" | "stt_failed";
  summary_draft?: string | null;
  summary_final?: SpecConsultSummary | null;
  // --- 목 부가(화면 표시) ---
  topic?: string;
  transcript?: { speaker: string; text: string }[];
};

/** EP-026 평가제 체크리스트 */
export type SpecChecklistItem = {
  indicator: string;
  indicator_ref?: string;
  required_doc_type?: string;
  period?: string;
  status: "met" | "missing";
  found?: number;
  needed?: number;
  hint?: string;
  // --- 목 부가 ---
  id?: string;
};

export type SpecChecklist = SpecList<SpecChecklistItem> & {
  met: number;
  missing: number;
  missing_observations?: string[];
};

/** EP-028 지표 */
export type SpecMetrics = {
  confirmed_count: number;
  adopted_count: number;
  adoption_rate: number | null;
  adoption_threshold: number;
  minor_edit_rate: number | null;
  edit_rate_avg: number | null;
  // 확정 문서가 없으면 서버가 아래 파생 집계를 null로 준다(EP-028 예외 1)
  edit_rate_distribution: Record<string, number> | null;
  avg_minutes_per_doc: number | null;
  baseline_minutes: Record<string, number> | null;
  time_reduction_rate: Record<string, number> | null;
  tagging_agreement_rate: number | null;
  token_cost: {
    tokens_in: number;
    tokens_out: number;
    krw?: number | null;
    source: string;
  } | null;
  /** (r9) 확정자별 채택률·수정률. 귀속 가능한 문서가 없으면 null */
  by_user?:
    | {
        user_id: number;
        name: string;
        confirmed_count: number;
        adopted_count: number;
        adoption_rate: number | null;
        edit_rate_avg: number | null;
        avg_minutes_per_doc: number | null;
      }[]
    | null;
  /** (r9) confirmed_by가 비어 by_user 분모에서 빠진 문서 수 */
  unattributed_count?: number;
  // --- 목 부가(최근 확정 추이) ---
  daily_confirmed?: { date: string; count: number }[];
};

/** EP-029 설정 */
export type SpecSettings = {
  replay_enabled: boolean;
  generation_model: string;
  light_model: string;
};

// ---------- 하루 기록 인코딩 ----------
//
// UI 하루 기록은 백엔드보다 구조가 풍부하다(activities[]·점심/간식 분리·낮잠 상태).
// 명세 record는 activity·meal·nap·note 문자열뿐이므로, 왕복 손실을 막기 위해
// seam·mock 양쪽이 이 한 쌍으로만 인·디코딩한다(계약은 문자열, 복원은 규칙).

type RecordWireFields = {
  activity: string;
  meal: string;
  nap: string;
  note: string;
};

export function encodeRecordToSpec(input: DailyRecordInput): RecordWireFields {
  return {
    activity: input.activities.join(", "),
    meal: `점심: ${input.lunch} / 간식: ${input.snack}`,
    nap: `${input.napFrom}~${input.napTo} (${input.napQuality})`,
    note: input.memo,
  };
}

/**
 * 명세 record 문자열 → UI 구조 필드.
 *
 * ⚠️ 형식이 안 맞을 때가 있다. 이 앱의 입력 폼을 거치지 않은 기록(시드·음성
 * 입력·다른 클라이언트)은 `"점심 보통, 국은 남김"`처럼 자유 문장으로 들어온다.
 *
 * 예전에는 그럴 때 조용히 `다 먹음 / 12:40~14:00 / 잘 잤어요`로 **채워 넣었다.**
 * 화면에는 그 가짜 값이 뜨는데 LLM은 진짜 문자열을 받으므로, 교사가 "기록이랑
 * 알림장이 다르다"고 느끼게 된다. 실제로 그 신고가 들어왔다. 아이가 무엇을
 * 먹고 얼마나 잤는지를 앱이 지어내는 것은 그 자체로 위험하다.
 *
 * 그래서 원문(`rawMeal`·`rawNap`)과 **파싱 성공 여부**를 함께 돌려준다.
 * 보여 주는 쪽은 파싱에 실패했으면 원문을 그대로 보여야 한다.
 */
export function decodeSpecRecord(spec: Partial<RecordWireFields>): {
  activities: string[];
  lunch: MealAmount;
  snack: MealAmount;
  napFrom: string;
  napTo: string;
  napQuality: NapQuality;
  memo: string;
  rawMeal: string;
  rawNap: string;
  mealParsed: boolean;
  napParsed: boolean;
} {
  const activities = (spec.activity ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const meal = /점심:\s*(.+?)\s*\/\s*간식:\s*(.+)/.exec(spec.meal ?? "");
  const nap = /(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})\s*\((.+)\)/.exec(
    spec.nap ?? "",
  );
  return {
    activities,
    lunch: (meal?.[1]?.trim() ?? "다 먹음") as MealAmount,
    snack: (meal?.[2]?.trim() ?? "다 먹음") as MealAmount,
    napFrom: nap?.[1] ?? "12:40",
    napTo: nap?.[2] ?? "14:00",
    napQuality: (nap?.[3]?.trim() ?? "잘 잤어요") as NapQuality,
    memo: spec.note ?? "",
    rawMeal: spec.meal ?? "",
    rawNap: spec.nap ?? "",
    mealParsed: meal !== null,
    napParsed: nap !== null,
  };
}

// ---------- 상담 요약 3단 구조(명세 EP-006/025) ----------

/** UI는 요약을 한 문자열로 다루고, 명세는 core·requests·follow_up 3키 객체다. */
export function summaryToSpec(text: string): SpecConsultSummary {
  const pick = (label: string) => {
    const m = new RegExp(`${label}\\s*[—-]\\s*(.+)`).exec(text);
    return m?.[1]?.trim() ?? "";
  };
  const core = pick("핵심");
  return {
    core: core || text.trim(),
    requests: pick("요청사항"),
    follow_up: pick("후속조치"),
  };
}

export function summaryFromSpec(s: SpecConsultSummary): string {
  return `핵심 — ${s.core}\n요청사항 — ${s.requests}\n후속조치 — ${s.follow_up}`;
}
