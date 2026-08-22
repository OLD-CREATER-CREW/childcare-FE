/** 도메인 타입 — 백엔드 연결 시 api-spec 기준으로 이 파일만 맞추면 됩니다. */

// ---------- 아동 ----------

export type Child = {
  id: string;
  name: string;
  birthDate: string;
  /** null이면 미입력 — "남"으로 접지 않는다(EP-004가 세 값을 준다) */
  gender: "남" | "여" | null;
  guardian: string;
  /** 알레르기 등 급식 유의사항 */
  allergy?: string;
  /** 반 이름 (EP-004 `class_name`) */
  className?: string;
  /** (r7) 재원·퇴소. EP-004 기본 조회는 재원만 준다 */
  status?: ChildStatus;
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
  /** 서버에 저장된 원문. 구조 필드로 파싱이 안 될 때 이것을 보여 준다. */
  rawMeal?: string;
  rawNap?: string;
  /** 위 구조 필드를 믿어도 되는지. false면 기본값이라 사실이 아니다. */
  mealParsed?: boolean;
  napParsed?: boolean;
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

/**
 * 화면이 다루는 문서 종류.
 *
 * 계획안은 주간·월간이 서로 다른 문서다(칸 구성도 기간도 다르다). 예전에는
 * 둘 다 `plan` 하나였고 와이어로는 늘 `weekly_plan`이 나갔다 — 화면의
 * 주간/월간 토글이 아무것도 바꾸지 못했다.
 */
export type DocType =
  | "notice"
  | "journal"
  | "plan"
  | "plan_monthly"
  | "evaluation"
  | "play_story";

/** 놀이이야기 초안에 함께 오는 사진 후보(EP-010 photo_suggestions).
 *
 * 묶는 단위는 하루 기록이 아니라 **놀이(날짜 + 활동)** 다. 초안의 소주제가
 * `1. 낙엽 밟기 산책해요 (10/6)`처럼 날짜를 달고 나오므로, `date`로 짝을
 * 지으면 소주제 옆에 그 놀이의 사진을 놓을 수 있다.
 *
 * **비어 있을 수 있다.** 사진의 날짜는 서버가 `Photo.record_id`로만 아는데
 * (업로드 시각은 촬영일이 아니다) 교사가 일지에 붙이지 않은 사진은 날짜를
 * 알 수 없어 빠진다. 화면은 빈 배열을 정상 상태로 다뤄야 한다.
 */
export type PhotoSuggestion = {
  date: string;
  activity: string | null;
  recordIds: number[];
  photos: {
    photoId: number;
    fileKey: string;
    matchedChildId: number | null;
    similarity: number | null;
  }[];
};

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
  /** 놀이이야기만 값 존재. 다른 문서는 빈 배열. */
  photoSuggestions: PhotoSuggestion[];
};

// ---------- 알림장 대기열 ----------

// ---------- 활동 추천 (EP-027) ----------

export type ActivityRecommendation = {
  title: string;
  /** 발달영역 코드(physical·communication·social·art·nature) */
  domain: string;
  /** 왜 이걸 골랐는지 — 교사가 판단 근거를 볼 수 있어야 한다 */
  reason: string;
};

export type ActivityRecommendations = {
  items: ActivityRecommendation[];
  total: number;
  /** 무엇을 기준으로 고른 목록인지 화면에 밝히기 위한 값 */
  season: string | null;
  ageLabel: string | null;
};

export type NoticeQueueItem = {
  childId: string;
  name: string;
  color: string;
  /** 초안이 아직 없으면 `null` — "생성 전"과 "생성했고 검토 대기"는 다른 상태다. */
  status: DocStatus | null;
};

export type NoticeQueue = {
  /** 초안이 실제로 만들어진 아이 수. */
  generated: number;
  /** 오늘 하루 기록이 있어 초안을 만들 수 있는 아이 수. */
  ready: number;
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
  /** 대표 태그(첫 번째) — 태그 편집 모달의 단일 선택 기준 */
  tag: DevelopmentDomain | null;
  /** 이 기록의 전체 발달영역 태그 — 서버 자동 태깅은 다중 도메인을 준다.
   *  도메인 매트릭스(막대그래프)와 어긋나지 않도록 리스트도 전체를 표시한다. */
  tags: DevelopmentDomain[];
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
  /** (r9) 확정자별 채택률·수정률 — 줄 세우기가 아니라 문체 적합도 단서다 */
  byUser: {
    userId: string;
    name: string;
    confirmedCount: number;
    adoptionRate: number | null;
    editRateAvgPct: number | null;
    perDocTime: string;
  }[];
  /** (r9) 확정자가 비어 byUser 분모에서 빠진 문서 수(시드·r9 이전 문서) */
  unattributedCount: number;
};

// ---------- 인증·설정 ----------

export type LoginInput = { username: string; password: string };

/** SCR-018 원장 회원가입(EP-051) — 기관과 첫 원장 계정을 함께 만든다 */
export type SignupInput = {
  centerName: string;
  username: string;
  password: string;
  name: string;
};

export type UserRole = "teacher" | "director";

/** 명세 EP-001·003·050 응답의 `user` — 로그인한 사용자와 소속 기관 */
export type AuthUser = {
  /** seam이 번역한 표시용 ID(`u12`) — 명세 정수 ID는 seam 밖으로 나오지 않는다 */
  userId: string;
  name: string;
  role: UserRole;
  centerId: number;
  centerName: string;
};

/** 역할 표시 문구 — 서버 값은 영문 상수, 화면에는 한글로 보인다 */
export const ROLE_LABEL: Record<UserRole, string> = {
  teacher: "보육교사",
  director: "원장",
};

// ---------- FN-021 아동 인적사항 관리 (SCR-016) ----------

export type ChildStatus = "enrolled" | "withdrawn";

/** EP-040 인적사항 전체 — 목록(Child)보다 넓다 */
export type ChildProfile = {
  id: string;
  name: string;
  birthDate: string;
  className: string;
  gender: "남" | "여" | null;
  status: ChildStatus;
  enrolledAt: string;
  withdrawnAt: string | null;
  memo: string;
};

/** EP-039 등록 · EP-041 수정 입력 — 이름만 필수, 나머지는 나중에 채운다 */
export type ChildProfileInput = {
  name: string;
  birthDate?: string;
  className?: string;
  gender?: "남" | "여" | null;
  enrolledAt?: string;
  memo?: string;
  // `status`는 일부러 없다. 퇴소는 EP-042(원장 전용), 퇴소 취소는 seam의
  // `reenrollChild` 전용 경로로만 보낸다 — EP-041은 교사도 부를 수 있고 서버가
  // 이 필드를 막아 주지 않아(실측 확인), 일반 수정 입력에 열어 두면 화면 어디서든
  // 상태를 바꿀 수 있는 구멍이 된다.
};

// ---------- FN-022 계정 관리 (SCR-017) ----------

/** EP-043~048 계정. 비밀번호는 어떤 응답에도 실리지 않는다 */
export type UserAccount = {
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  active: boolean;
};

/** EP-043 계정 생성 — center_id는 보내지 않는다(원장 본인 기관에 만들어진다) */
export type UserAccountInput = {
  username: string;
  password: string;
  name: string;
  role: UserRole;
};

/** EP-046 부분 수정 — 아이디·비밀번호는 여기서 바꿀 수 없다 */
export type UserAccountPatch = {
  name?: string;
  role?: UserRole;
  active?: boolean;
};

/** EP-049 본인 비밀번호 변경 */
export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type PasswordChangeResult = {
  /** 이번 변경으로 끊긴 다른 기기의 세션 수 */
  revokedSessions: number;
};

export type AppSettings = {
  replayMode: boolean;
  models: { generate: string; light: string };
};
