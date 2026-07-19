import type {
  AppSettings,
  Child,
  ChecklistData,
  ConsultData,
  DocumentDraft,
  LoginResponse,
  MetricsSummary,
  NoticeQueue,
  ObservationData,
  PhotoInbox,
  RecordSummary,
} from "@/lib/types";

/** MSW 핸들러가 사용하는 목 데이터 — 백엔드 연결 시 이 계층만 교체 */

export const TODAY = "2026-07-16 (목)";
export const CLASS_NAME = "해님반";
export const TEACHER_NAME = "김○○ 선생님";

export const children: Child[] = [
  { id: "c01", name: "김민준", recorded: true },
  { id: "c02", name: "이서연", recorded: true },
  { id: "c03", name: "박도윤", recorded: false },
  { id: "c04", name: "최지우", recorded: true },
  { id: "c05", name: "정하은", recorded: false },
  { id: "c06", name: "한소민", recorded: false },
  { id: "c07", name: "오지호", recorded: true },
  { id: "c08", name: "배수아", recorded: true },
  { id: "c09", name: "임도현", recorded: true },
  { id: "c10", name: "강예린", recorded: true },
  { id: "c11", name: "조은우", recorded: true },
  { id: "c12", name: "서다인", recorded: true },
  { id: "c13", name: "문시우", recorded: true },
  { id: "c14", name: "홍라온", recorded: true },
  { id: "c15", name: "유하람", recorded: true },
];

export const recordSummary: RecordSummary = {
  done: children.filter((c) => c.recorded).length,
  total: children.length,
  pendingDocs: 3,
  unclassifiedPhotos: 5,
};

export const loginResponse: LoginResponse = {
  token: "mock-token",
  teacher: { name: TEACHER_NAME, role: "담임", className: CLASS_NAME },
};

export const documentDrafts: Record<string, DocumentDraft> = {
  notice: {
    type: "notice",
    label: "김민준 · 2026-07-16 알림장",
    content:
      "오늘 민준이는 바깥놀이터에서 친구들과 즐겁게 뛰어놀았어요. 점심도 남김없이 잘 먹었고, 낮잠도 1시간 반 동안 푹 잤답니다. 놀이 중 친구와 장난감을 두고 잠시 다투었지만 금방 화해하고 다시 사이좋게 놀았어요. 🌻",
  },
  journal: {
    type: "journal",
    label: "해님반 · 2026-07-16 보육일지",
    content:
      "[오전 활동] 바깥놀이터에서 대근육 활동을 실시함. 유아들이 놀이기구를 활용하여 신체 조절 능력을 기름.\n[특이사항] 또래 간 갈등 1건 발생하였으나 교사 중재로 원만히 해결됨. 이후 협동 놀이가 자연스럽게 이어짐.",
  },
  plan: {
    type: "plan",
    label: "해님반 · 주간 계획안",
    content:
      "[생활주제] 여름과 물놀이\n[목표] 물의 성질을 오감으로 탐색하고, 여름철 건강·안전 습관을 기른다.\n[요일별 활동] 월: 물놀이 준비·약속 정하기 / 화: 물감 번지기 / 수: 물놀이터 체험 / 목: 젖은 모래 조형 / 금: 여름 동화·정리",
  },
  evaluation: {
    type: "evaluation",
    label: "김민준 · 2026 발달평가서",
    content:
      "[신체운동·건강] 대근육 발달이 또래 수준에 도달함. 계단 오르내리기·달리기에서 안정적인 신체 조절을 보임.\n[의사소통] 문장 표현이 풍부해지고, 자신의 요구를 말로 전달하는 빈도가 증가함.\n[사회관계] 갈등 상황에서 화해를 시도하는 등 또래 관계 조절 능력이 향상됨.",
  },
};

export const noticeQueue: NoticeQueue = {
  generated: 12,
  total: 15,
  queue: [
    { childId: "c01", name: "김민준", state: "reviewing" },
    { childId: "c02", name: "이서연", state: "waiting" },
    { childId: "c04", name: "최지우", state: "waiting" },
  ],
  excluded: ["박도윤", "한소민", "정하은"],
};

export const photoInbox: PhotoInbox = {
  photos: [
    { id: 1, icon: "🧒", similarity: "94%" },
    { id: 2, icon: "🎨", similarity: "91%" },
    { id: 3, icon: "🏃", similarity: "88%" },
    { id: 4, icon: "🧩", similarity: "86%" },
    { id: 5, icon: "🌳", similarity: "분류 중…", classifying: true },
    { id: 6, icon: "❓", similarity: "미분류", unmatched: true },
  ],
  classified: 12,
  total: 18,
  tabs: ["전체", "김민준", "이서연", "박도윤", "최지우"],
};

export const observationData: ObservationData = {
  domains: [
    { name: "신체운동", count: 8 },
    { name: "의사소통", count: 5 },
    { name: "사회관계", count: 6 },
    { name: "예술경험", count: 3 },
    { name: "자연탐구", count: 4 },
  ],
  timeline: [
    { date: "07-16", tag: "사회관계", memo: "친구와 다툼 후 화해" },
    { date: "07-15", tag: "신체운동", memo: "계단 오르내리기 능숙" },
    { date: "07-12", tag: "의사소통", memo: "문장으로 요구 표현" },
    {
      date: "07-10",
      tag: null,
      memo: "자동 태깅 실패 — 메모만 표시, 수동 태깅 유도",
    },
  ],
};

export const consultData: ConsultData = {
  transcript: [
    {
      speaker: "어머니",
      text: "요즘 아이가 밤에 늦게 자서 아침에 일어나기 힘들어해요.",
    },
    {
      speaker: "교사",
      text: "낮잠 시간에도 잠들기까지 시간이 좀 걸리는 편이에요. 낮잠을 조금 줄여 볼까요?",
    },
    {
      speaker: "어머니",
      text: "네, 그리고 하원 시간을 30분 당길 수 있을까 해서요…",
    },
  ],
  summaryDraft:
    "핵심 — 수면 습관 변화 상담 (야간 취침 지연 → 기상 어려움)\n요청사항 — 하원 시간 30분 조정, 낮잠 시간 단축 검토\n후속조치 — 2주간 낮잠 단축 시도 후 재상담 (7/30 예정)",
  history: [
    { date: "07-16", topic: "수면 습관", active: true },
    { date: "05-20", topic: "또래 관계" },
    { date: "03-11", topic: "적응 상담" },
  ],
};

export const checklistData: ChecklistData = {
  items: [
    { ok: true, title: "보육일지 작성 (주 5회)", desc: "이번 주 5/5 작성" },
    { ok: true, title: "주간 계획안 비치", desc: "이번 주 계획안 확정본 있음" },
    { ok: true, title: "알림장 발송 (일 단위)", desc: "최근 5일 연속 발송" },
    { ok: false, title: "관찰기록 (아동별 월 1회)", desc: "3명 미작성" },
    { ok: false, title: "상담일지", desc: "이번 분기 상담 기록 0건" },
  ],
  met: 7,
  total: 10,
  missingObservations: ["박도윤", "최지우", "정하은"],
};

export const metricsSummary: MetricsSummary = {
  adoptionRate: 62,
  minorEditGainPt: 19,
  combinedRate: 81,
  editDistribution: [18, 42, 100, 64, 28, 12],
  timeSavings: [
    {
      docType: "알림장",
      baseline: "7분 05초",
      actual: "3분 20초",
      reduction: "53% ↓",
    },
    {
      docType: "보육일지",
      baseline: "18분",
      actual: "7분 01초",
      reduction: "61% ↓",
    },
    {
      docType: "주간 계획안",
      baseline: "45분",
      actual: "14분 24초",
      reduction: "68% ↓",
    },
  ],
  perDocTime: "3분 20초",
  taggingMatchRate: 82,
  monthlyCost: "월 3,540원",
};

export const appSettings: AppSettings = {
  replayMode: false,
  models: { generate: "Sonnet 5", light: "Haiku 4.5" },
};
