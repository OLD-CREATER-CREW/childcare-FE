/** 도메인 타입 — 백엔드 연결 시 api-spec 기준으로 이 파일만 맞추면 됩니다. */

// ---------- 아동 ----------

export type Child = {
  id: string;
  name: string;
  birthDate: string;
  gender: "남" | "여";
  guardian: string;
  /** 알레르기 등 급식 유의사항 */
  allergy?: string;
  /** 아바타 배경 색상 토큰 (hex) */
  color: string;
  /** 오늘 하루 기록 작성 여부 */
  recorded: boolean;
  /** 오늘 등원 여부 */
  attending: boolean;
};

// ---------- 하루 기록 ----------

export type MealAmount = "다 먹음" | "조금 남김" | "많이 남김" | "거의 안 먹음";
export type NapQuality = "잘 잤어요" | "뒤척였어요" | "못 잤어요";

export type DailyRecord = {
  childId: string;
  date: string;
  activities: string[];
  lunch: MealAmount;
  snack: MealAmount;
  napFrom: string;
  napTo: string;
  napQuality: NapQuality;
  memo: string;
  savedAt: string | null;
};

export type DailyRecordInput = Omit<DailyRecord, "savedAt">;

export type RecordSummary = {
  done: number;
  total: number;
  /** 미확정 문서 수 */
  pendingDocs: number;
  /** 미분류 사진 수 */
  unclassifiedPhotos: number;
};

// ---------- 문서 공통 ----------

export type DocStatus = "draft" | "confirmed" | "sent";

export type DocType = "notice" | "journal" | "plan" | "evaluation";

export type DocumentDraft = {
  type: DocType;
  /** 아동 단위 문서(알림장·발달평가서)만 값 존재 */
  childId: string | null;
  label: string;
  /** AI가 생성한 원본 초안 */
  content: string;
  /** 교사가 수정 중인 작업본 */
  working: string;
  status: DocStatus;
  /** 원본 대비 편집 비율(%) — 확정 시 박제 */
  editDistance: number | null;
  generatedAt: string;
};

// ---------- 알림장 대기열 ----------

export type NoticeQueueItem = {
  childId: string;
  name: string;
  color: string;
  status: DocStatus;
};

export type NoticeQueue = {
  generated: number;
  total: number;
  confirmed: number;
  sent: number;
  queue: NoticeQueueItem[];
  /** 하루 기록이 없어 생성에서 제외된 아이들 */
  excluded: string[];
};

// ---------- 사진함 ----------

export type PhotoStatus = "classifying" | "classified" | "unmatched";

export type Photo = {
  id: number;
  /** 목업 아이콘(실사진 대체) */
  icon: string;
  status: PhotoStatus;
  /** 분류된 아동 — unmatched·classifying이면 null */
  childId: string | null;
  /** 얼굴 유사도(%) — 분류 완료 시에만 */
  similarity: number | null;
  takenAt: string;
  sent: boolean;
};

export type PhotoInbox = {
  photos: Photo[];
  classified: number;
  classifying: number;
  unmatched: number;
  total: number;
};

// ---------- 관찰 ----------

export type DevelopmentDomain =
  "신체운동" | "의사소통" | "사회관계" | "예술경험" | "자연탐구";

export const DEV_DOMAINS: DevelopmentDomain[] = [
  "신체운동",
  "의사소통",
  "사회관계",
  "예술경험",
  "자연탐구",
];

export type ObservationEntry = {
  id: string;
  childId: string;
  date: string;
  tag: DevelopmentDomain | null;
  /** 수동 태그 여부 — true면 자동 태깅이 덮어쓰지 않음 */
  manualTag: boolean;
  memo: string;
};

export type ObservationData = {
  domains: { name: DevelopmentDomain; count: number }[];
  timeline: ObservationEntry[];
};

// ---------- 상담 ----------

export type ConsultStatus = "draft" | "confirmed";

export type ConsultSession = {
  id: string;
  childId: string;
  date: string;
  topic: string;
  transcript: { speaker: string; text: string }[];
  summaryDraft: string;
  summaryFinal: string | null;
  status: ConsultStatus;
};

export type ConsultData = {
  current: ConsultSession | null;
  history: ConsultSession[];
};

// ---------- 평가제 체크리스트 ----------

export type ChecklistItem = {
  id: string;
  ok: boolean;
  title: string;
  desc: string;
};

export type ChecklistData = {
  items: ChecklistItem[];
  met: number;
  total: number;
  missingObservations: string[];
};

// ---------- 지표 ----------

export type TimeSaving = {
  docType: string;
  baseline: string;
  actual: string;
  reductionPct: number;
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
  /** 최근 14일 일별 확정 문서 수 */
  dailyConfirmed: { date: string; count: number }[];
};

// ---------- 인증·설정 ----------

export type LoginInput = { username: string; password: string };

export type LoginResponse = {
  token: string;
  teacher: { name: string; role: string; className: string };
};

export type AppSettings = {
  replayMode: boolean;
  models: { generate: string; light: string };
};
