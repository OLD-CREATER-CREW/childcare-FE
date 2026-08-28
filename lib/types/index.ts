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
  "notice" | "journal" | "plan" | "plan_monthly" | "evaluation" | "play_story";

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

/** 초안의 한 구문과 그 출처(FN-022). */
export type ProvenanceSpan = {
  /** AI 초안에서의 위치. 교사가 고친 뒤에는 `text`로 다시 찾는다. */
  start: number;
  length: number;
  text: string;
  /** 근거가 된 하루 기록 id. 관찰 타임라인의 항목 id와 같은 값이다. */
  recordIds: number[];
};

export type DocumentDraft = {
  /**
   * 서버가 매긴 문서 번호. 칸 단위 재생성(EP-055)이 이 값을 필요로 한다 —
   * 그 호출은 "이 문서의 이 칸"을 가리켜야 하고, 문서를 만든 그 기록·근거를
   * 서버가 되찾는 열쇠가 이것뿐이다.
   */
  documentId: number;
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
  /** 이 문서를 만들 때 쓴 양식 템플릿. 없으면 평문 폴백 문서다. */
  templateId: number | null;
  /**
   * 칸 단위 본문. 템플릿 주도로 만든 문서만 채워진다.
   *
   * 표 구조(행·열 총량)는 여기 없다 — `templateId`로 템플릿을 한 번 받아
   * 캐시한다. 문서마다 같은 구조를 다시 받을 이유가 없다.
   */
  cells: DocumentCell[];
  /**
   * FN-022 — 어느 구문이 어느 기록에서 나왔는지.
   *
   * 본문(`content`·`working`)에는 아무 표시도 없다. 화면이 이 위치에 밑줄을
   * 그린다. `text`를 함께 받는 이유는 교사가 고치면 위치가 어긋나기 때문이다 —
   * 현재 본문에서 그 문구를 다시 찾아 밑줄을 옮긴다.
   *
   * null이면 추적하지 않는 문서 타입이다(발달평가서만 켜져 있다).
   */
  provenance: ProvenanceSpan[] | null;
  /** 완성 문서 파일 키. null이면 아직 없다 — 이유는 `fileRenderStatus`가 말한다. */
  fileKey: string | null;
  fileRenderStatus: FileRenderStatus;
};

/** `file_key`가 없는 **이유**. 화면은 이 값으로 어떤 버튼을 보일지 정한다. */
export type FileRenderStatus =
  /** 아직 「문서 만들기」를 누르지 않았다 — 가장 흔하다 */
  | "not_requested"
  /** 만들어졌다 — 내려받을 수 있다 */
  | "ok"
  /** 그 타입에 활성 템플릿이 없다. **정상 폴백이지 오류가 아니다** */
  | "no_template"
  /** 템플릿은 있으나 표 셀 매핑에 실패했다 */
  | "failed";

/** 원본 서식의 칸 하나 — 교사가 칸 단위로 검토·수정한다. */
export type DocumentCell = {
  key: string;
  table: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  /** `행 라벨 / 열 라벨` */
  label: string;
  text: string;
  /**
   * 이 글이 어디서 왔는지.
   * - `ai`       모델이 썼다 — 교사가 검토할 곳
   * - `template` 서식에 인쇄된 정형 문구 — 손대지 않는다
   * - `teacher`  사람이 고쳤다
   *
   * 화면은 이 값으로 "AI가 손댄 곳"만 강조해 교사의 검토 범위를 좁힌다.
   */
  source: "ai" | "template" | "teacher";
  /** `template` 칸은 false */
  editable: boolean;
};

// ---------- 양식 템플릿 (SCR-015) ----------

/**
 * 서식을 등록할 수 있는 문서 종류.
 *
 * 놀이이야기는 빠진다 — 백엔드 `TEMPLATE_DOC_TYPES`에 없다
 * (기능 명세서 부록 A).
 */
export type TemplateDocType = Exclude<DocType, "play_story">;

export const TEMPLATE_DOC_TYPES: TemplateDocType[] = [
  "notice",
  "journal",
  "plan",
  "plan_monthly",
  "evaluation",
];

export const TEMPLATE_DOC_TYPE_LABEL: Record<TemplateDocType, string> = {
  notice: "알림장",
  journal: "보육일지",
  plan: "주간계획안",
  plan_monthly: "월간계획안",
  evaluation: "발달평가서",
};

/** 서식에서 찾아낸 채울 칸 하나 */
export type TemplateCell = {
  key: string;
  table: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  /** `행 라벨 / 열 라벨` */
  label: string;
  /** 서식이 이 칸을 비워 뒀는지 */
  empty: boolean;
  /**
   * 서식에 **이미 적혀 있던 문안**.
   *
   * 교사가 올리는 서식은 빈 양식이 아니라 작년 작성본인 경우가 많고 실제
   * 아동·교사 이름이 들어 있다. `styleEnabled`를 켜면 이 글이 프롬프트에
   * 실리므로, 화면은 켜기 전에 이 값을 보여 줘야 한다.
   */
  existingText: string;
  /** 이 칸이 감당하는 글자 수 */
  budgetChars: number;
};

export type TemplateStructure = {
  sourceFormat: "hwpx" | "docx" | "hwp" | null;
  tables: { index: number; rows: number; cols: number; nested: boolean }[];
  cells: TemplateCell[];
};

export type FormTemplate = {
  id: number;
  docType: TemplateDocType;
  fileKey: string;
  /** 사람이 올린 원본 파일명. 등록 이력에서 "무엇을 올렸는지" 보여 주는 값이다. */
  fileName: string;
  /**
   * 분석된 칸 구조. `null`인 경우가 둘이다 —
   * 분석 실패(`analysisFailed`)이거나, 구 v1로 분석돼 칸 정보가 없는 템플릿이다.
   * 어느 쪽이든 미리보기를 그릴 수 없다.
   */
  structure: TemplateStructure | null;
  /** 분석 실패 — 활성화할 수 없다(EP-037이 409로 막는다) */
  analysisFailed: boolean;
  active: boolean;
  /** 서식의 기존 문안을 생성 문체 예시로 쓸지. 기본 꺼짐(개인정보). */
  styleEnabled: boolean;
  createdAt: string;
  /** 목록에서 온 항목은 구조가 없다 — 상세(EP-034)를 받아야 채워진다 */
  hasStructure: boolean;
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
