/** 도메인 타입 — 백엔드 연결 시 api-spec 기준으로 이 파일만 맞추면 됩니다. */

export type Child = {
  id: string;
  name: string;
  /** 오늘 하루 기록 작성 여부 */
  recorded: boolean;
};

export type DocStatus = "draft" | "confirmed" | "sent";

export type DocType = "notice" | "journal" | "plan" | "evaluation";

export type DocumentDraft = {
  type: DocType;
  label: string;
  content: string;
};

export type RecordSummary = {
  done: number;
  total: number;
  /** 미확정 문서 수 */
  pendingDocs: number;
  /** 미분류 사진 수 */
  unclassifiedPhotos: number;
};

export type DailyRecordInput = {
  childId: string;
  date: string;
  activities: string[];
  lunch: string;
  snack: string;
  napFrom: string;
  napTo: string;
  napQuality: string;
  memo: string;
};

export type Photo = {
  id: number;
  /** 목업 아이콘(실사진 대체) */
  icon: string;
  /** 얼굴 유사도 표시 문자열 (예: "94%", "분류 중…", "미분류") */
  similarity: string;
  unmatched?: boolean;
  classifying?: boolean;
};

export type PhotoInbox = {
  photos: Photo[];
  /** 분류 진행률 */
  classified: number;
  total: number;
  tabs: string[];
};

export type NoticeQueueItem = {
  childId: string;
  name: string;
  state: "reviewing" | "waiting";
};

export type NoticeQueue = {
  generated: number;
  total: number;
  queue: NoticeQueueItem[];
  /** 하루 기록이 없어 생성에서 제외된 아이들 */
  excluded: string[];
};

export type ObservationDomain = { name: string; count: number };

export type ObservationEntry = {
  date: string;
  tag: string | null;
  memo: string;
};

export type ObservationData = {
  domains: ObservationDomain[];
  timeline: ObservationEntry[];
};

export type ConsultHistoryItem = {
  date: string;
  topic: string;
  active?: boolean;
};

export type ConsultData = {
  transcript: { speaker: string; text: string }[];
  summaryDraft: string;
  history: ConsultHistoryItem[];
};

export type ChecklistItem = { ok: boolean; title: string; desc: string };

export type ChecklistData = {
  items: ChecklistItem[];
  met: number;
  total: number;
  missingObservations: string[];
};

export type TimeSaving = {
  docType: string;
  baseline: string;
  actual: string;
  reduction: string;
};

export type MetricsSummary = {
  adoptionRate: number;
  minorEditGainPt: number;
  combinedRate: number;
  /** 편집거리 구간별 문서 수 분포 */
  editDistribution: number[];
  timeSavings: TimeSaving[];
  perDocTime: string;
  taggingMatchRate: number;
  monthlyCost: string;
};

export type LoginInput = { username: string; password: string };

export type LoginResponse = {
  token: string;
  teacher: { name: string; role: string; className: string };
};

export type AppSettings = {
  replayMode: boolean;
  models: { generate: string; light: string };
};
