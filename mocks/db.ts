import type {
  AppSettings,
  ChecklistData,
  Child,
  ChildProfile,
  ChildProfileInput,
  ConsultData,
  ConsultSession,
  DailyRecord,
  DailyRecordInput,
  DevelopmentDomain,
  DocStatus,
  DocType,
  DocumentDraft,
  NoticeQueue,
  ObservationData,
  ObservationEntry,
  Photo,
  PhotoInbox,
  RecordSummary,
  UserAccount,
  UserAccountInput,
  UserAccountPatch,
} from "@/lib/types";
import { DEV_DOMAINS } from "@/lib/types";
import { applyTemplate } from "@/lib/templates";

/**
 * 상태형 인메모리 DB — MSW 핸들러의 유일한 데이터 소스.
 * 저장·확정·발송·분류가 실제로 상태를 바꾸며, 알림장 초안은 하루 기록에서 파생됩니다.
 * 백엔드 연결 시 이 파일과 handlers.ts만 걷어내면 됩니다.
 */

import { CLASS_NAME, TEACHER_NAME, TODAY } from "@/lib/constants";

export { CLASS_NAME, TEACHER_NAME, TODAY };

const AVATAR_COLORS = [
  "#2E7D52",
  "#3D6FA8",
  "#B0713A",
  "#7C5CB0",
  "#3A8F8A",
  "#BE4F3F",
];

type ChildSeed = {
  id: string;
  name: string;
  birthDate: string;
  gender: "남" | "여";
  guardian: string;
  allergy?: string;
  recorded: boolean;
  attending: boolean;
};

const CHILD_SEEDS: ChildSeed[] = [
  {
    id: "c01",
    name: "김민준",
    birthDate: "2022-03-14",
    gender: "남",
    guardian: "김지영",
    recorded: true,
    attending: true,
  },
  {
    id: "c02",
    name: "이서연",
    birthDate: "2022-05-02",
    gender: "여",
    guardian: "이수진",
    allergy: "달걀",
    recorded: true,
    attending: true,
  },
  {
    id: "c03",
    name: "박도윤",
    birthDate: "2022-01-27",
    gender: "남",
    guardian: "박현우",
    recorded: false,
    attending: true,
  },
  {
    id: "c04",
    name: "최지우",
    birthDate: "2022-08-19",
    gender: "여",
    guardian: "최은주",
    recorded: true,
    attending: true,
  },
  {
    id: "c05",
    name: "정하은",
    birthDate: "2022-06-08",
    gender: "여",
    guardian: "정민아",
    allergy: "견과류",
    recorded: false,
    attending: false,
  },
  {
    id: "c06",
    name: "한소민",
    birthDate: "2022-11-23",
    gender: "여",
    guardian: "한지혜",
    recorded: false,
    attending: true,
  },
  {
    id: "c07",
    name: "오지호",
    birthDate: "2022-02-11",
    gender: "남",
    guardian: "오세라",
    recorded: true,
    attending: true,
  },
  {
    id: "c08",
    name: "배수아",
    birthDate: "2022-09-05",
    gender: "여",
    guardian: "배정현",
    recorded: true,
    attending: true,
  },
  {
    id: "c09",
    name: "임도현",
    birthDate: "2022-04-30",
    gender: "남",
    guardian: "임소연",
    recorded: true,
    attending: true,
  },
  {
    id: "c10",
    name: "강예린",
    birthDate: "2022-07-17",
    gender: "여",
    guardian: "강미래",
    recorded: true,
    attending: true,
  },
  {
    id: "c11",
    name: "조은우",
    birthDate: "2022-10-09",
    gender: "남",
    guardian: "조아라",
    allergy: "우유",
    recorded: true,
    attending: true,
  },
  {
    id: "c12",
    name: "서다인",
    birthDate: "2022-12-01",
    gender: "여",
    guardian: "서지원",
    recorded: true,
    attending: true,
  },
  {
    id: "c13",
    name: "문시우",
    birthDate: "2022-03-28",
    gender: "남",
    guardian: "문가영",
    recorded: true,
    attending: true,
  },
  {
    id: "c14",
    name: "홍라온",
    birthDate: "2022-08-02",
    gender: "남",
    guardian: "홍유나",
    recorded: true,
    attending: true,
  },
  {
    id: "c15",
    name: "유하람",
    birthDate: "2022-05-21",
    gender: "여",
    guardian: "유선영",
    recorded: true,
    attending: true,
  },
];

const DEFAULT_ACTIVITIES = ["바깥놀이", "블록쌓기"];

const MEMO_SEEDS: Record<string, string> = {
  c01: "친구와 장난감을 두고 잠시 다퉜지만 금방 화해하고 함께 놀이함",
  c02: "역할놀이에서 친구들에게 배역을 나눠 주며 놀이를 이끎",
  c04: "그림 그리기에 오래 집중, 완성작을 친구들에게 설명함",
  c07: "미끄럼틀 계단을 스스로 오르내리며 자신감을 보임",
  c08: "동화 듣기 시간에 뒷이야기를 상상해 발표함",
  c09: "블록으로 높은 탑을 쌓고 무너지지 않게 균형을 잡음",
  c10: "새로 온 친구에게 먼저 다가가 놀이를 권함",
  c11: "우유 대신 두유를 받고 스스로 자리 정리를 함",
  c12: "노래에 맞춰 율동을 만들어 친구들과 공유함",
  c13: "개미 행렬을 오래 관찰하며 질문을 많이 함",
  c14: "점심 배식 도우미 역할을 끝까지 해냄",
  c15: "가위질이 능숙해져 곡선 오리기에 성공함",
};

// ---------- 상태 컨테이너 ----------

type DbState = {
  children: Child[];
  records: Map<string, DailyRecord>; // key: `${childId}:${date}`
  documents: Map<string, DocumentDraft>; // key: `${type}:${childId ?? "class"}`
  photos: Photo[];
  photoSeq: number;
  observations: ObservationEntry[];
  obsSeq: number;
  consults: ConsultSession[];
  settings: AppSettings;
  /** 로컬 양식(서식) — 지정되면 해당 문서 초안이 이 서식으로 생성된다 */
  templates: Partial<Record<DocType, string>>;
  /**
   * 명세 계약은 문서를 document_id(정수)로 주소지정한다. 내부 문서는 (type,childId)
   * 키로 관리하므로, 그 키에 안정적인 정수 id를 매겨 와이어에서 쓴다.
   */
  docIdByKey: Map<string, number>;
  docSeq: number;
  /**
   * (r7) 아동 인적사항 — 목록(children)에 없는 입소일·특이사항·퇴소일을 담는다.
   * 명세도 목록(EP-004)과 상세(EP-040)를 갈라 두었으므로 같은 구조로 흉내 낸다.
   */
  profiles: Map<string, ChildProfile>;
  childSeq: number;
  /** (r8) 계정 — 기관 하나(center_id=3)만 다룬다 */
  users: UserAccount[];
  userSeq: number;
};

function recordKey(childId: string, date: string) {
  return `${childId}:${date}`;
}

function docKey(type: DocType, childId: string | null) {
  return `${type}:${childId ?? "class"}`;
}

// ---------- 초안 생성기 (실서비스의 LLM 호출 대체) ----------

const josa = (name: string, a: string, b: string) => {
  const code = name.charCodeAt(name.length - 1);
  const hasJong = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 > 0;
  return hasJong ? a : b;
};

/** 낮잠 시작~종료(HH:MM) 분 단위 계산 */
function napMinutes(rec: DailyRecord): number {
  return (
    (Number(rec.napTo.slice(0, 2)) * 60 +
      Number(rec.napTo.slice(3)) -
      (Number(rec.napFrom.slice(0, 2)) * 60 + Number(rec.napFrom.slice(3)))) |
    0
  );
}

function noticeContent(child: Child, rec: DailyRecord): string {
  const first = child.name.slice(1) || child.name;
  const acts = rec.activities.length
    ? rec.activities.join(", ")
    : "실내 자유놀이";
  const napMin = napMinutes(rec);

  // 로컬 양식이 지정돼 있으면 그 서식대로 — 없으면 기본 내장 문장
  const tpl = state.templates.notice;
  if (tpl) {
    const napText =
      `${Math.floor(napMin / 60) ? `${Math.floor(napMin / 60)}시간 ` : ""}${napMin % 60 ? `${napMin % 60}분` : ""}`.trim();
    return applyTemplate(tpl, {
      이름: child.name,
      이름_짧게: first,
      반: CLASS_NAME,
      날짜: TODAY,
      선생님: TEACHER_NAME,
      보호자: child.guardian,
      활동: acts,
      점심: rec.lunch,
      간식: rec.snack,
      낮잠시작: rec.napFrom,
      낮잠종료: rec.napTo,
      낮잠시간: napText,
      낮잠상태: rec.napQuality,
      메모: rec.memo,
      알레르기: child.allergy ?? "없음",
    });
  }

  const lunchLine =
    rec.lunch === "다 먹음"
      ? "점심도 남김없이 잘 먹었고"
      : `점심은 ${rec.lunch} 상태였고`;
  const napLine =
    rec.napQuality === "잘 잤어요"
      ? `낮잠도 ${Math.floor(napMin / 60) ? `${Math.floor(napMin / 60)}시간 ` : ""}${napMin % 60 ? `${napMin % 60}분 ` : ""}동안 푹 잤답니다`
      : `낮잠 시간에는 ${rec.napQuality === "뒤척였어요" ? "조금 뒤척였지만 편안히 쉬었어요" : "잠들지 못했지만 조용히 몸을 쉬었어요"}`;
  const memoLine = rec.memo ? ` ${rec.memo.replace(/함$|음$/, "했어요")}.` : "";
  return `오늘 ${first}${josa(first, "이는", "는")} ${acts} 활동을 하며 즐거운 하루를 보냈어요. ${lunchLine}, ${napLine}.${memoLine} 내일도 건강하게 만나요! 🌻`;
}

function journalContent(): string {
  const recs = todaysRecords();
  const attending = state.children.filter((c) => c.attending).length;
  const absent = state.children.length - attending;
  const acts = new Set<string>();
  recs.forEach((r) => r.activities.forEach((a) => acts.add(a)));
  const memoCount = recs.filter((r) => r.memo.trim()).length;
  const actList = Array.from(acts).slice(0, 3).join(", ") || "실내 자유놀이";

  const tpl = state.templates.journal;
  if (tpl) {
    return applyTemplate(tpl, {
      반: CLASS_NAME,
      날짜: TODAY,
      선생님: TEACHER_NAME,
      등원: attending,
      결석: absent,
      활동: actList,
      관찰메모수: memoCount,
    });
  }

  return [
    `[출결] 등원 ${attending}명 / 결석 ${absent}명`,
    `[오전 활동] ${Array.from(acts).slice(0, 3).join(", ") || "실내 자유놀이"} — 유아들이 놀이를 스스로 선택하고 지속하는 모습이 관찰됨.`,
    `[급식] 정상 배식. 알레르기 유아(달걀·견과류·우유) 대체식 제공 확인.`,
    `[낮잠] 평균 1시간 20분. 개별 수면 습관에 따라 입면 시간 차이 있음.`,
    `[특이사항] 관찰 메모 ${memoCount}건 기록. 또래 갈등 1건 발생하였으나 교사 중재로 원만히 해결되어 협동 놀이로 이어짐.`,
  ].join("\n");
}

function planContent(): string {
  const tpl = state.templates.plan;
  if (tpl) {
    return applyTemplate(tpl, {
      반: CLASS_NAME,
      선생님: TEACHER_NAME,
      기간: "2026-07-13 ~ 07-19",
      생활주제: "여름과 물놀이",
    });
  }
  return [
    "[생활주제] 여름과 물놀이",
    "[목표] 물의 성질을 오감으로 탐색하고, 여름철 건강·안전 습관을 기른다.",
    "[월] 물놀이 준비 · 안전 약속 정하기",
    "[화] 물감 번지기 — 색의 섞임 관찰",
    "[수] 물놀이터 체험 (우천 시 실내 감각놀이)",
    "[목] 젖은 모래 조형 놀이",
    "[금] 여름 동화 「수박 수영장」 · 한 주 되돌아보기",
  ].join("\n");
}

function evaluationContent(child: Child): string {
  const obs = state.observations.filter((o) => o.childId === child.id);
  const byDomain = DEV_DOMAINS.map(
    (d) => [d, obs.filter((o) => o.tag === d).length] as const,
  );
  const strongest = [...byDomain].sort((a, b) => b[1] - a[1])[0][0];

  const tpl = state.templates.evaluation;
  if (tpl) {
    return applyTemplate(tpl, {
      이름: child.name,
      생년월일: child.birthDate,
      반: CLASS_NAME,
      선생님: TEACHER_NAME,
      관찰수: obs.length,
      최다영역: strongest,
    });
  }

  return [
    `[신체운동·건강] 대근육 발달이 또래 수준에 도달함. 계단 오르내리기·달리기에서 안정적인 신체 조절을 보임.`,
    `[의사소통] 문장 표현이 풍부해지고, 자신의 요구를 말로 전달하는 빈도가 증가함.`,
    `[사회관계] 갈등 상황에서 화해를 시도하는 등 또래 관계 조절 능력이 향상됨.`,
    `[종합] 최근 관찰 ${obs.length}건 기준, ${strongest} 영역에서 특히 활발한 성장이 관찰됨. 가정에서도 관련 놀이 경험을 이어 가기를 권함.`,
  ].join("\n");
}

// ---------- 시드 ----------

function seedRecords(): Map<string, DailyRecord> {
  const map = new Map<string, DailyRecord>();
  CHILD_SEEDS.filter((c) => c.recorded).forEach((c, i) => {
    map.set(recordKey(c.id, TODAY), {
      childId: c.id,
      date: TODAY,
      activities:
        i % 3 === 0
          ? ["바깥놀이", "블록쌓기"]
          : i % 3 === 1
            ? ["그림그리기", "역할놀이"]
            : ["바깥놀이", "동화듣기"],
      lunch: i % 4 === 1 ? "조금 남김" : "다 먹음",
      snack: i % 5 === 2 ? "조금 남김" : "다 먹음",
      napFrom: "12:40",
      napTo: i % 2 ? "14:10" : "14:00",
      napQuality: i % 5 === 3 ? "뒤척였어요" : "잘 잤어요",
      memo: MEMO_SEEDS[c.id] ?? "",
      savedAt: `${TODAY}T13:3${i % 10}:00`,
    });
  });
  return map;
}

const OBS_SEED: [string, string, DevelopmentDomain | null, string][] = [
  ["c01", "07-16", "사회관계", "친구와 다툼 후 스스로 화해를 시도함"],
  ["c01", "07-15", "신체운동", "계단 오르내리기가 능숙해짐"],
  ["c01", "07-12", "의사소통", "완성된 문장으로 요구를 표현함"],
  ["c01", "07-10", null, "새 놀잇감에 큰 흥미 — 태깅 실패, 수동 확인 필요"],
  ["c01", "07-08", "자연탐구", "그림자 길이 변화를 스스로 발견함"],
  ["c02", "07-16", "사회관계", "역할놀이에서 배역을 나누며 놀이를 이끎"],
  ["c02", "07-11", "예술경험", "노래에 맞춰 새로운 율동을 만들어 냄"],
  ["c02", "07-09", "의사소통", "동화 뒷이야기를 상상해 이야기함"],
  ["c04", "07-15", "예술경험", "곡선 가위질로 형태 오리기에 성공함"],
  ["c04", "07-10", "신체운동", "한 발 서기 10초 유지"],
  ["c07", "07-16", "신체운동", "미끄럼틀 계단을 스스로 오르내림"],
  ["c07", "07-13", "사회관계", "놀이 순서를 기다리는 모습이 안정적임"],
  ["c09", "07-14", "자연탐구", "블록 탑의 균형 원리를 실험함"],
  ["c10", "07-16", "사회관계", "새로 온 친구에게 먼저 다가가 놀이를 권함"],
  ["c13", "07-15", "자연탐구", "개미 행렬을 오래 관찰하며 질문함"],
];

function seedObservations(): ObservationEntry[] {
  return OBS_SEED.map(([childId, md, tag, memo], i) => ({
    id: `o${String(i + 1).padStart(3, "0")}`,
    childId,
    date: `2026-${md}`,
    tag,
    tags: tag ? [tag] : [],
    manualTag: false,
    memo,
  }));
}

const PHOTO_ICONS = [
  "🧒",
  "🎨",
  "🏃",
  "🧩",
  "🌳",
  "🪁",
  "📚",
  "🎪",
  "🧸",
  "🌈",
];

function seedPhotos(): Photo[] {
  const spec: [string | null, number | null, boolean][] = [
    ["c01", 94, false],
    ["c02", 91, false],
    ["c01", 88, true],
    ["c04", 86, false],
    ["c07", 92, false],
    ["c09", 89, false],
    ["c12", 95, true],
    ["c10", 87, false],
    [null, null, false], // 분류 중
    [null, null, false], // 분류 중
    ["unmatched", null, false],
    ["unmatched", null, false],
  ];
  return spec.map(([who, sim, sent], i) => ({
    id: i + 1,
    icon: PHOTO_ICONS[i % PHOTO_ICONS.length],
    status:
      who === null
        ? "classifying"
        : who === "unmatched"
          ? "unmatched"
          : "classified",
    childId: who && who !== "unmatched" ? who : null,
    similarity: sim,
    takenAt: `${TODAY} ${10 + (i % 5)}:${String(12 + i * 3).padStart(2, "0")}`,
    sent,
  }));
}

const CONSULT_SEED: Omit<ConsultSession, "id">[] = [
  {
    childId: "c01",
    date: "2026-07-16",
    topic: "수면 습관",
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
        text: "네, 그리고 하원 시간을 30분 당길 수 있을까 해서요.",
      },
      {
        speaker: "교사",
        text: "네, 2주간 낮잠을 줄여 보고 변화를 지켜본 뒤 다시 말씀 나눠요.",
      },
    ],
    summaryDraft:
      "핵심 — 수면 습관 변화 상담 (야간 취침 지연 → 기상 어려움)\n요청사항 — 하원 시간 30분 조정, 낮잠 시간 단축 검토\n후속조치 — 2주간 낮잠 단축 시도 후 재상담 (7/30 예정)",
    summaryFinal: null,
    status: "draft",
  },
  {
    childId: "c01",
    date: "2026-05-20",
    topic: "또래 관계",
    transcript: [
      { speaker: "어머니", text: "친구들과 잘 지내는지 궁금해서요." },
      {
        speaker: "교사",
        text: "특정 친구와 놀이 시간이 길어지고 있고, 갈등 시 말로 해결하려는 시도가 늘었어요.",
      },
    ],
    summaryDraft: "",
    summaryFinal:
      "핵심 — 또래 관계 적응 점검\n요청사항 — 갈등 상황 대처 방식 공유\n후속조치 — 가정에서도 감정 표현 어휘 사용 독려",
    status: "confirmed",
  },
  {
    childId: "c01",
    date: "2026-03-11",
    topic: "적응 상담",
    transcript: [
      { speaker: "어머니", text: "새 학기 적응이 걱정돼요." },
      { speaker: "교사", text: "첫 주보다 등원 시 분리가 훨씬 안정적이에요." },
    ],
    summaryDraft: "",
    summaryFinal:
      "핵심 — 신학기 적응 상담\n요청사항 — 등원 시 분리불안 관찰 요청\n후속조치 — 2주 후 적응도 재공유",
    status: "confirmed",
  },
  {
    childId: "c02",
    date: "2026-06-02",
    topic: "식습관",
    transcript: [
      { speaker: "아버지", text: "집에서 채소를 잘 안 먹으려고 해요." },
      {
        speaker: "교사",
        text: "원에서는 또래와 함께라 조금씩 시도하고 있어요. 같은 방식 공유드릴게요.",
      },
    ],
    summaryDraft: "",
    summaryFinal:
      "핵심 — 채소 편식 상담\n요청사항 — 원 식사 지도 방식 공유\n후속조치 — 가정 연계 식판 스티커판 제공",
    status: "confirmed",
  },
];

/**
 * 주간 계획안 초안을 시드로 심는다.
 * planContent()가 state.templates를 읽으므로, 반드시 state가 할당된 뒤에 호출해야 한다
 * (createState 안에서 부르면 `export let state` 초기화 전 접근 → TDZ 오류).
 */
function seedDocuments() {
  state.documents.set(docKey("plan", null), {
    type: "plan",
    childId: null,
    label: `${CLASS_NAME} · 주간 계획안 (07-13 ~ 07-19)`,
    content: planContent(),
    working: planContent(),
    status: "draft",
    editDistance: null,
    generatedAt: `${TODAY}T09:00:00`,
  });
}

/** 시드 아동의 인적사항 — 입소일은 파일럿 학기 시작일로 둔다 */
const ENROLLED_AT = "2026-03-02";

function seedProfiles(children: Child[]): Map<string, ChildProfile> {
  return new Map(
    children.map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        birthDate: c.birthDate,
        className: CLASS_NAME,
        gender: c.gender,
        status: "enrolled" as const,
        enrolledAt: ENROLLED_AT,
        withdrawnAt: null,
        memo: c.allergy ?? "",
      },
    ]),
  );
}

/** 서버가 기동 시 심는 데모 계정과 같은 구성(명세 1.2 — demo_director·demo_teacher) */
function seedUsers(): UserAccount[] {
  return [
    {
      userId: "u11",
      username: "demo_director",
      name: "데모 원장",
      role: "director",
      active: true,
    },
    {
      userId: "u12",
      username: "demo_teacher",
      name: TEACHER_NAME,
      role: "teacher",
      active: true,
    },
    {
      userId: "u15",
      username: "lee_boyuk",
      name: "이보육 선생님",
      role: "teacher",
      active: false,
    },
  ];
}

function createState(): DbState {
  const children = CHILD_SEEDS.map((c, i) => ({
    ...c,
    color: AVATAR_COLORS[i % AVATAR_COLORS.length],
  }));
  return {
    children,
    profiles: seedProfiles(children),
    childSeq: 200,
    users: seedUsers(),
    userSeq: 20,
    records: seedRecords(),
    documents: new Map(),
    photos: seedPhotos(),
    photoSeq: 100,
    observations: seedObservations(),
    obsSeq: 100,
    consults: CONSULT_SEED.map((c, i) => ({ ...c, id: `cs${i + 1}` })),
    settings: {
      replayMode: false,
      models: { generate: "Sonnet 5", light: "Haiku 4.5" },
    },
    templates: {},
    docIdByKey: new Map(),
    docSeq: 3000,
  };
}

export let state = createState();
seedDocuments();

export function reseed() {
  // 양식은 기관 설정이지 연습 데이터가 아니므로 시드 초기화에도 보존한다
  const templates = state.templates;
  state = createState();
  state.templates = templates;
  seedDocuments();
}

/** 로컬에서 읽어 온 양식을 반영 — 이후 생성되는 미확정 초안이 이 서식을 따른다 */
export function setTemplates(map: Partial<Record<DocType, string>>) {
  state.templates = map ?? {};
  // 아직 미확정인 초안은 새 서식으로 다시 생성되도록 폐기(확정본은 보존)
  Array.from(state.documents.entries()).forEach(([key, doc]) => {
    if (doc.status === "draft") state.documents.delete(key);
  });
}

// ---------- 조회·연산 ----------

function todaysRecords(): DailyRecord[] {
  return Array.from(state.records.values()).filter((r) => r.date === TODAY);
}

export function getChildren(): Child[] {
  return state.children;
}

export function getChild(id: string): Child | undefined {
  return state.children.find((c) => c.id === id);
}

// ---------- 아동 인적사항 (FN-021 / EP-039~042) ----------

/** 명세 EP-004: 기본은 재원만, `all`이면 퇴소 아동까지 */
export function getRoster(status: "enrolled" | "withdrawn" | "all"): Child[] {
  return state.children.filter((c) => {
    const st = state.profiles.get(c.id)?.status ?? "enrolled";
    return status === "all" ? true : st === status;
  });
}

export function getChildProfile(id: string): ChildProfile | undefined {
  return state.profiles.get(id);
}

/** 중복 검사는 **재원 아동만** 본다 — 퇴소한 아동과 같은 이름은 다시 등록할 수 있다 */
export function hasEnrolledName(name: string, exceptId?: string): boolean {
  return Array.from(state.profiles.values()).some(
    (p) => p.id !== exceptId && p.status === "enrolled" && p.name === name,
  );
}

export function createChildProfile(input: ChildProfileInput): ChildProfile {
  const id = `c${++state.childSeq}`;
  const profile: ChildProfile = {
    id,
    name: input.name.trim(),
    birthDate: input.birthDate ?? "",
    className: input.className ?? CLASS_NAME,
    gender: input.gender ?? null,
    status: "enrolled",
    // 입소일을 비웠으면 오늘로 채운다(명세 EP-039)
    enrolledAt: input.enrolledAt || TODAY,
    withdrawnAt: null,
    memo: input.memo ?? "",
  };
  state.profiles.set(id, profile);
  state.children.push({
    id,
    name: profile.name,
    birthDate: profile.birthDate,
    gender: profile.gender ?? "남",
    guardian: "",
    allergy: profile.memo || undefined,
    color: AVATAR_COLORS[state.children.length % AVATAR_COLORS.length],
    recorded: false,
    attending: true,
  });
  return profile;
}

/** 부분 수정 — undefined는 "그대로 두기", null은 "비우기"(명세 EP-041) */
export function updateChildProfile(
  id: string,
  patch: Partial<ChildProfile>,
): ChildProfile | undefined {
  const prev = state.profiles.get(id);
  if (!prev) return undefined;
  const next: ChildProfile = { ...prev, ...patch };
  // 퇴소를 되돌리면 퇴소일도 함께 지운다(오조작 복구 경로)
  if (patch.status === "enrolled") next.withdrawnAt = null;
  state.profiles.set(id, next);
  const child = getChild(id);
  if (child) {
    child.name = next.name;
    child.birthDate = next.birthDate;
    child.gender = next.gender ?? child.gender;
    child.allergy = next.memo || undefined;
  }
  return next;
}

/** 소프트 삭제 — 행을 지우지 않고 status만 바꾼다(명세 EP-042) */
export function withdrawChildProfile(id: string): ChildProfile | undefined {
  return updateChildProfile(id, { status: "withdrawn", withdrawnAt: TODAY });
}

// ---------- 계정 (FN-022 / EP-043~048) ----------

/**
 * 목 세션 — 지금 로그인한 사람이 누구인지. 자기 잠금 판정(SELF_LOCKOUT)과 역할
 * 분기가 이 값에 걸린다. 실 서버는 토큰에서 읽지만 목은 토큰을 검증하지 않으므로
 * 로그인할 때 여기에 적어 둔다.
 */
let sessionUserId = "u12";

export function getSessionUser(): UserAccount {
  return getUser(sessionUserId) ?? state.users[0];
}

export function setSessionUser(userId: string) {
  sessionUserId = userId;
}

export function getUsers(activeOnly: boolean): UserAccount[] {
  return activeOnly ? state.users.filter((u) => u.active) : state.users;
}

export function getUser(userId: string): UserAccount | undefined {
  return state.users.find((u) => u.userId === userId);
}

export function hasUsername(username: string): boolean {
  return state.users.some((u) => u.username === username);
}

export function createUserAccount(input: UserAccountInput): UserAccount {
  const user: UserAccount = {
    userId: `u${++state.userSeq}`,
    username: input.username,
    name: input.name,
    role: input.role,
    active: true,
  };
  state.users.push(user);
  return user;
}

export function updateUserAccount(
  userId: string,
  patch: UserAccountPatch,
): UserAccount | undefined {
  const user = getUser(userId);
  if (!user) return undefined;
  Object.assign(user, patch);
  return user;
}

/** 마지막 활성 원장 보호(명세 1.2.2) — 강등·잠금이 원장 0명을 만들면 막는다 */
export function wouldRemoveLastDirector(
  userId: string,
  patch: UserAccountPatch,
): boolean {
  const target = getUser(userId);
  if (!target || target.role !== "director" || !target.active) return false;
  const losesDirector = patch.role === "teacher" || patch.active === false;
  if (!losesDirector) return false;
  return (
    state.users.filter(
      (u) => u.role === "director" && u.active && u.userId !== userId,
    ).length === 0
  );
}

export function getRecord(childId: string, date: string): DailyRecord | null {
  return state.records.get(recordKey(childId, date)) ?? null;
}

export function saveRecord(input: DailyRecordInput): DailyRecord {
  const rec: DailyRecord = { ...input, savedAt: new Date().toISOString() };
  state.records.set(recordKey(input.childId, input.date), rec);
  if (input.date === TODAY) {
    const child = getChild(input.childId);
    if (child) child.recorded = true;
    // 원천 기록이 바뀌면 미확정 알림장 초안은 무효화 — 다음 조회 때 재생성
    const key = docKey("notice", input.childId);
    const doc = state.documents.get(key);
    if (doc && doc.status === "draft") state.documents.delete(key);
  }
  return rec;
}

export function getSummary(): RecordSummary {
  const done = state.children.filter((c) => c.recorded).length;
  const pendingDocs = Array.from(state.documents.values()).filter(
    (d) => d.type === "notice" && d.status === "draft",
  ).length;
  return {
    done,
    total: state.children.length,
    pendingDocs,
    unclassifiedPhotos: state.photos.filter((p) => p.status === "unmatched")
      .length,
  };
}

// ---------- 문서 ----------

export function getDraft(
  type: DocType,
  childId: string | null,
  regenerate = false,
): DocumentDraft | null {
  const key = docKey(type, childId);
  const existing = state.documents.get(key);
  if (existing && !regenerate) return existing;
  if (existing && existing.status !== "draft") return existing; // 확정본은 재생성 불가

  let content: string;
  let label: string;
  if (type === "notice") {
    const child = childId ? getChild(childId) : undefined;
    if (!child) return null;
    const rec = getRecord(child.id, TODAY);
    if (!rec) return null; // 하루 기록 없으면 생성 제외 (불변 원칙)
    content = noticeContent(child, rec);
    label = `${child.name} · ${TODAY} 알림장`;
  } else if (type === "journal") {
    content = journalContent();
    label = `${CLASS_NAME} · ${TODAY} 보육일지`;
  } else if (type === "plan") {
    content = planContent();
    label = `${CLASS_NAME} · 주간 계획안 (07-13 ~ 07-19)`;
  } else {
    const child = childId ? getChild(childId) : undefined;
    if (!child) return null;
    content = evaluationContent(child);
    label = `${child.name} · 2026 발달평가서`;
  }
  const doc: DocumentDraft = {
    type,
    childId: type === "notice" || type === "evaluation" ? childId : null,
    label,
    content,
    working: content,
    status: "draft",
    editDistance: null,
    generatedAt: new Date().toISOString(),
  };
  state.documents.set(key, doc);
  return doc;
}

export function saveWorking(
  type: DocType,
  childId: string | null,
  working: string,
): boolean {
  const doc = state.documents.get(docKey(type, childId));
  if (!doc || doc.status !== "draft") return false;
  doc.working = working;
  return true;
}

/** 문자 단위 Levenshtein — 편집거리(%) 산출용 (내용이 짧아 O(nm) 무방) */
function editRatio(a: string, b: string): number {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (!n || !m) return 100;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return Math.min(100, Math.round((prev[m] / Math.max(n, m)) * 100));
}

export function confirmDoc(
  type: DocType,
  childId: string | null,
  content: string,
): DocumentDraft | null {
  const doc = getDraft(type, childId);
  if (!doc || doc.status !== "draft") return doc;
  doc.working = content;
  doc.editDistance = editRatio(doc.content, content);
  doc.status = "confirmed";
  return doc;
}

export function sendDoc(
  type: DocType,
  childId: string | null,
): DocStatus | null {
  const doc = state.documents.get(docKey(type, childId));
  if (!doc || doc.status === "draft") return null; // 불변식: 확정 전 발송 불가
  doc.status = "sent";
  return doc.status;
}

export function getNoticeQueue(): NoticeQueue {
  const items = state.children
    .filter((c) => getRecord(c.id, TODAY))
    .map((c) => {
      const doc = state.documents.get(docKey("notice", c.id));
      return {
        childId: c.id,
        name: c.name,
        color: c.color,
        // 실 서버와 같은 규약 — 초안이 없으면 null("생성 전").
        status: (doc?.status ?? null) as DocStatus | null,
      };
    });
  return {
    generated: items.filter((i) => i.status !== null).length,
    ready: items.length,
    total: state.children.length,
    confirmed: items.filter(
      (i) => i.status === "confirmed" || i.status === "sent",
    ).length,
    sent: items.filter((i) => i.status === "sent").length,
    queue: items,
    excluded: state.children
      .filter((c) => !getRecord(c.id, TODAY))
      .map((c) => c.name),
  };
}

/**
 * 알림장 초안 일괄 생성 — 오늘 하루 기록이 있는 아이 전원의 초안을 한 번에 파생.
 * 이미 존재하는 초안·확정본은 건드리지 않고(불변 원칙), 새로 만든 건수만 반환.
 * "생성만 일괄, 검토·확정은 아이별" — 확정은 이 함수가 하지 않는다.
 */
export function generateAllNotices(): { created: number; total: number } {
  let created = 0;
  const withRecord = state.children.filter((c) => getRecord(c.id, TODAY));
  withRecord.forEach((c) => {
    const existing = state.documents.get(docKey("notice", c.id));
    if (existing) return; // 이미 생성됨(초안이든 확정이든) — 유지
    if (getDraft("notice", c.id)) created += 1;
  });
  return { created, total: withRecord.length };
}

// ---------- 사진함 ----------

/** 조회할 때마다 분류 중인 사진 1장을 완료 처리 — 폴링과 함께 진행감을 만든다 */
export function tickClassification() {
  const next = state.photos.find((p) => p.status === "classifying");
  if (!next) return;
  const candidates = state.children.filter((c) => c.attending);
  const child = candidates[next.id % candidates.length];
  const sim = 85 + ((next.id * 7) % 13);
  if (sim < 87) {
    next.status = "unmatched";
  } else {
    next.status = "classified";
    next.childId = child.id;
    next.similarity = sim;
  }
}

export function getPhotoInbox(): PhotoInbox {
  const photos = [...state.photos].sort((a, b) => b.id - a.id);
  return {
    photos,
    classified: photos.filter((p) => p.status === "classified").length,
    classifying: photos.filter((p) => p.status === "classifying").length,
    unmatched: photos.filter((p) => p.status === "unmatched").length,
    total: photos.length,
  };
}

export function uploadPhotos(count = 3): number {
  for (let i = 0; i < count; i++) {
    state.photoSeq += 1;
    state.photos.push({
      id: state.photoSeq,
      icon: PHOTO_ICONS[state.photoSeq % PHOTO_ICONS.length],
      status: "classifying",
      childId: null,
      similarity: null,
      takenAt: `${TODAY} 15:${String(state.photoSeq % 60).padStart(2, "0")}`,
      sent: false,
    });
  }
  return count;
}

export function assignPhoto(photoId: number, childId: string): boolean {
  const photo = state.photos.find((p) => p.id === photoId);
  const child = getChild(childId);
  if (!photo || !child) return false;
  photo.status = "classified";
  photo.childId = childId;
  photo.similarity = null; // 수동 지정 — 유사도 대신 "수동" 표기
  return true;
}

export function sendPhotos(ids: number[]): number {
  let sent = 0;
  ids.forEach((id) => {
    const photo = state.photos.find(
      (p) => p.id === id && p.status === "classified" && !p.sent,
    );
    if (photo) {
      photo.sent = true;
      sent += 1;
    }
  });
  return sent;
}

// ---------- 관찰 ----------

export function getObservations(childId: string): ObservationData {
  const timeline = state.observations
    .filter((o) => o.childId === childId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return {
    domains: DEV_DOMAINS.map((name) => ({
      name,
      count: timeline.filter((o) => o.tag === name).length,
    })),
    timeline,
  };
}

export function updateObservationTag(
  id: string,
  tag: DevelopmentDomain | null,
): ObservationEntry | null {
  const entry = state.observations.find((o) => o.id === id);
  if (!entry) return null;
  entry.tag = tag;
  entry.manualTag = true;
  return entry;
}

/**
 * 관찰 기록 직접 추가 — 교사가 하루 기록 유입과 별개로 직접 남기는 관찰.
 * 발달영역을 지정하면 수동 태그(manualTag)로 박제되어 자동 태깅이 덮어쓰지 않는다.
 */
export function addObservation(
  childId: string,
  tag: DevelopmentDomain | null,
  memo: string,
): ObservationEntry | null {
  const child = getChild(childId);
  if (!child || !memo.trim()) return null;
  state.obsSeq += 1;
  const entry: ObservationEntry = {
    id: `o${state.obsSeq}`,
    childId,
    date: TODAY,
    tag,
    tags: tag ? [tag] : [],
    manualTag: tag !== null,
    memo: memo.trim(),
  };
  state.observations.push(entry);
  return entry;
}

// ---------- 상담 ----------

export function getConsults(childId: string): ConsultData {
  const sessions = state.consults
    .filter((c) => c.childId === childId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return {
    current: sessions.find((s) => s.status === "draft") ?? sessions[0] ?? null,
    history: sessions,
  };
}

export function confirmConsult(id: string, summary: string): boolean {
  const session = state.consults.find((c) => c.id === id);
  if (!session || session.status !== "draft") return false;
  session.summaryFinal = summary;
  session.status = "confirmed";
  return true;
}

// ---------- 평가제 체크리스트 (규칙엔진 — 조회 시 실데이터 재집계) ----------

export function getChecklist(): ChecklistData {
  const journal = state.documents.get(docKey("journal", null));
  const plan = state.documents.get(docKey("plan", null));
  const sentNotices = Array.from(state.documents.values()).filter(
    (d) => d.type === "notice" && d.status === "sent",
  ).length;
  const recentObsChildIds = new Set(
    state.observations
      .filter((o) => o.date >= "2026-07-01")
      .map((o) => o.childId),
  );
  const missingObservations = state.children
    .filter((c) => !recentObsChildIds.has(c.id))
    .map((c) => c.name);
  const consultCount = state.consults.filter(
    (c) => c.status === "confirmed" && c.date >= "2026-04-01",
  ).length;

  const items = [
    {
      id: "journal",
      ok: !!journal && journal.status !== "draft",
      title: "보육일지 작성 (주 5회)",
      desc:
        journal && journal.status !== "draft"
          ? "이번 주 5/5 작성 · 오늘분 확정 완료"
          : "오늘분 미확정 — 보육일지 화면에서 확정 필요",
    },
    {
      id: "plan",
      ok: !!plan,
      title: "주간 계획안 비치",
      desc: plan ? "이번 주 계획안 있음" : "이번 주 계획안 없음",
    },
    {
      id: "notice",
      ok: sentNotices > 0,
      title: "알림장 발송 (일 단위)",
      desc:
        sentNotices > 0
          ? `오늘 ${sentNotices}건 발송 · 최근 5일 연속 발송`
          : "오늘 발송분 없음 — 알림장 확정 후 발송 필요",
    },
    {
      id: "observation",
      ok: missingObservations.length === 0,
      title: "관찰기록 (아동별 월 1회)",
      desc:
        missingObservations.length === 0
          ? "이번 달 전원 작성"
          : `${missingObservations.length}명 미작성`,
    },
    {
      id: "consult",
      ok: consultCount > 0,
      title: "상담일지 (분기 1회)",
      desc:
        consultCount > 0
          ? `이번 분기 확정 상담 ${consultCount}건`
          : "이번 분기 상담 기록 0건",
    },
  ];
  return {
    items,
    met: items.filter((i) => i.ok).length,
    total: items.length,
    missingObservations,
  };
}

// ---------- 지표 ----------

/**
 * (r9) 확정자별 지표 — 교사를 줄 세우는 값이 아니라 "AI 초안이 누구의 문체에
 * 잘 맞는지"를 보는 값이다(명세 EP-028). 목은 고정 표본으로 화면만 채운다.
 */
export const MOCK_BY_USER = [
  {
    user_id: 12,
    name: TEACHER_NAME,
    confirmed_count: 24,
    adopted_count: 16,
    adoption_rate: 0.667,
    edit_rate_avg: 0.061,
    avg_minutes_per_doc: 3.8,
  },
  {
    user_id: 15,
    name: "이보육 선생님",
    confirmed_count: 18,
    adopted_count: 9,
    adoption_rate: 0.5,
    edit_rate_avg: 0.112,
    avg_minutes_per_doc: 4.9,
  },
];

/** by_user 분모에서 빠진 문서 수(시드·r9 이전 확정분) */
export const MOCK_UNATTRIBUTED = 6;

/** 명세 EP-028 단위(0~1 비율·분·원)로 지표를 낸다. 화면 포맷은 seam이 맡는다. */
export function getMetricsSpec() {
  const confirmed = Array.from(state.documents.values()).filter(
    (d) => d.status !== "draft" && d.editDistance !== null,
  );
  const seededDone = 34;
  const zeroEdits =
    21 + confirmed.filter((d) => (d.editDistance ?? 100) === 0).length;
  const minorEdits =
    7 +
    confirmed.filter((d) => {
      const e = d.editDistance ?? 100;
      return e > 0 && e <= 10;
    }).length;
  const totalDocs = seededDone + confirmed.length;
  const nonManual = state.observations.filter((o) => !o.manualTag).length;
  return {
    confirmed_count: totalDocs,
    adopted_count: zeroEdits,
    adoption_rate: zeroEdits / totalDocs,
    adoption_threshold: 0,
    minor_edit_rate: (zeroEdits + minorEdits) / totalDocs,
    edit_rate_avg: 0.084,
    edit_rate_distribution: {
      "0": zeroEdits,
      "0-0.1": minorEdits,
      "0.1-0.3": 4,
      "0.3+": 3,
    },
    avg_minutes_per_doc: 3 + 20 / 60,
    baseline_minutes: { notice: 7 + 5 / 60, journal: 18, weekly_plan: 45 },
    time_reduction_rate: { notice: 0.53, journal: 0.61, weekly_plan: 0.68 },
    tagging_agreement_rate: nonManual / Math.max(1, state.observations.length),
    token_cost: {
      tokens_in: 184000,
      tokens_out: 41000,
      krw: 3540,
      source: "llm_calls",
    },
    daily_confirmed: [
      { date: "07-03", count: 9 },
      { date: "07-04", count: 12 },
      { date: "07-07", count: 14 },
      { date: "07-08", count: 11 },
      { date: "07-09", count: 15 },
      { date: "07-10", count: 13 },
      { date: "07-11", count: 16 },
      { date: "07-14", count: 12 },
      { date: "07-15", count: 15 },
      { date: "07-16", count: Math.min(15, 10 + confirmed.length) },
    ],
    by_user: MOCK_BY_USER,
    unattributed_count: MOCK_UNATTRIBUTED,
  };
}

// ---------- 설정 ----------

export function getSettings(): AppSettings {
  return state.settings;
}

export function setReplayMode(on: boolean) {
  state.settings.replayMode = on;
}

// ---------- 문서 id 브리지 (명세: document_id 정수) ----------

/** (type,childId) 키에 안정적인 정수 document_id를 매긴다(없으면 발급). */
export function assignDocId(type: DocType, childId: string | null): number {
  const key = docKey(type, childId);
  let id = state.docIdByKey.get(key);
  if (id == null) {
    id = state.docSeq += 1;
    state.docIdByKey.set(key, id);
  }
  return id;
}

/** document_id → (type,childId) 역해소. 없으면 null. */
export function resolveDocId(
  id: number,
): { type: DocType; childId: string | null } | null {
  const found = Array.from(state.docIdByKey.entries()).find(
    ([, value]) => value === id,
  );
  if (!found) return null;
  const key = found[0];
  const idx = key.indexOf(":");
  return {
    type: key.slice(0, idx) as DocType,
    childId: key.slice(idx + 1) === "class" ? null : key.slice(idx + 1),
  };
}

/** 특정 (type,childId) 문서를 조회(있으면). id 없이 키로 직접 접근. */
export function getDocByTarget(
  type: DocType,
  childId: string | null,
): DocumentDraft | null {
  return state.documents.get(docKey(type, childId)) ?? null;
}

/** EP-012 목록: 조건에 맞는 (id, doc) 쌍을 반환. */
export function listDocuments(filter: {
  type?: DocType;
  childId?: string | null;
  status?: DocStatus;
}): { id: number; doc: DocumentDraft }[] {
  const out: { id: number; doc: DocumentDraft }[] = [];
  Array.from(state.documents.entries()).forEach(([key, doc]) => {
    const idx = key.indexOf(":");
    const cid = key.slice(idx + 1);
    const childId = cid === "class" ? null : cid;
    if (filter.type && doc.type !== filter.type) return;
    if (filter.childId !== undefined && childId !== filter.childId) return;
    if (filter.status && doc.status !== filter.status) return;
    out.push({ id: assignDocId(doc.type, childId), doc });
  });
  return out;
}
