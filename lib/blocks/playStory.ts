/**
 * 놀이이야기 초안 ↔ 블록 (SCR-018).
 *
 * ■ 왜 파싱인가
 * 초안은 줄글 한 덩어리로 오지만 **이미 규칙적이다.** 서식 프로필
 * (`backend/data/form_profiles/play_story.json`)이 칸 이름·번호·머리표를
 * 지시하고 있어서, 나오는 글이 늘 아래 모양을 따른다.
 *
 *     [푸른나무반 놀이이야기]      ← 머리글
 *
 *     놀이 주제
 *     즐거운 여름
 *
 *     놀이 속 배움
 *     무더운 7월, …
 *
 *     소주제별 놀이 이야기 및 사진 추천
 *     1. 우산 쓰고 장화 신고 비 오는 날 놀이해요 (7/3)
 *     ⋅놀이 이야기: …
 *     ⋅말풍선 문구 제안: "…"
 *     ⋅추천 사진 가이드: …
 *
 * 그러니 생성 방식을 바꿀 필요 없이 나눠 담기만 하면 된다. 나누고 나면
 * 수정·사진 고르기·다시 생성이 전부 **놀이 단위**가 된다.
 *
 * ■ 실패는 조용히
 * 모델이 쓰는 글이라 모양이 어긋날 때가 있다. 그때 예외를 던지면 화면이 빈다 —
 * 초안은 멀쩡히 있는데 보여 주지 못하는 셈이다. 그래서 `parse`는 실패해도
 * 예외를 내지 않고 `ok: false`를 돌려주며, 화면은 지금까지처럼 통짜 편집기를
 * 보여 준다.
 *
 * ■ 왕복이 손실 없이 닫혀야 한다
 * 교사가 고친 블록을 다시 초안 텍스트로 합쳐 저장한다(`serialize`). 파싱과
 * 직렬화가 어긋나면 저장할 때마다 글이 조금씩 달라진다 — `parse(serialize(x))`가
 * `x`와 같은지를 테스트로 고정한다.
 */

/** 블록 한 덩어리. `kind`가 화면의 편집기 모양을 정한다. */
export type PlayBlock =
  | { kind: "heading"; label: string; text: string }
  | { kind: "topic"; label: string; text: string }
  | { kind: "learning"; label: string; text: string }
  | {
      kind: "play";
      label: string;
      /** 소주제 번호. 1부터 */
      index: number;
      /** 제목 — 괄호 안 날짜를 뺀 부분 */
      title: string;
      /** `8/3` 같은 표기. 없을 수 있다 */
      date: string;
      story: string;
      quote: string;
      guide: string;
    };

export type ParseResult =
  | { ok: true; blocks: PlayBlock[] }
  | { ok: false; reason: string };

/** 서식이 정한 칸 이름. 프로필을 고치면 여기도 함께 고친다. */
const TOPIC_LABEL = "놀이 주제";
const LEARNING_LABEL = "놀이 속 배움";
const PLAYS_LABEL = "소주제별 놀이 이야기 및 사진 추천";

/** 소주제 줄 머리표. 서식이 `⋅`(U+22C5)를 쓴다 — 가운뎃점(·)과 다른 글자다. */
const BULLET = /^[⋅·•]\s*/;

const FIELD_LABELS = {
  story: "놀이 이야기",
  quote: "말풍선 문구 제안",
  guide: "추천 사진 가이드",
} as const;

/** `1. 제목 (7/3)` — 번호·제목·날짜를 뜯는다. 날짜는 없을 수 있다. */
const PLAY_HEAD = /^(\d{1,2})\.\s*(.*?)(?:\s*\((\d{1,2}\/\d{1,2})\))?\s*$/;

/**
 * 소주제 블록 하나의 라벨. 백엔드의 `block_label`로 그대로 올라가고
 * 프롬프트에 실린다(EP-055) — 화면이 만든 이름을 서버가 되받는 구조다.
 */
export const playBlockLabel = (index: number) => `소주제 ${index}`;

export function blockLabel(block: PlayBlock): string {
  return block.kind === "play" ? playBlockLabel(block.index) : block.label;
}

/** 분량 기준(글자). 서식 프로필의 칸 크기에서 온 값이다. */
export const BLOCK_BUDGET: Record<PlayBlock["kind"], number> = {
  heading: 40,
  topic: 30,
  learning: 400,
  play: 200,
};

/** 분량을 셀 대상 — 소주제는 「놀이 이야기」가 본문이다. */
export function blockLength(block: PlayBlock): number {
  return block.kind === "play" ? block.story.length : block.text.length;
}

// ------------------------------------------------------------------
// 파싱
// ------------------------------------------------------------------

/** `⋅놀이 이야기: 본문` → `본문`. 머리표가 없으면 null. */
function readField(line: string, label: string): string | null {
  const bare = line.replace(BULLET, "");
  const prefix = `${label}:`;
  if (!bare.startsWith(prefix)) return null;
  return bare.slice(prefix.length).trim();
}

/**
 * 소주제 한 덩어리를 뜯는다.
 *
 * 세 줄이 다 없어도 만든다 — 모델이 한 줄을 빠뜨렸다고 그 놀이를 통째로 버리면
 * 교사가 손댈 기회조차 없어진다. 빈 칸은 화면에서 비어 보이고 채우면 된다.
 */
function parsePlay(lines: string[]): PlayBlock | null {
  const head = PLAY_HEAD.exec(lines[0].trim());
  if (!head) return null;

  const rest = lines.slice(1);
  const pick = (label: string) => {
    for (const line of rest) {
      const got = readField(line, label);
      if (got !== null) return got;
    }
    return "";
  };

  return {
    kind: "play",
    label: playBlockLabel(Number(head[1])),
    index: Number(head[1]),
    title: head[2].trim(),
    date: head[3] ?? "",
    story: pick(FIELD_LABELS.story),
    quote: pick(FIELD_LABELS.quote),
    guide: pick(FIELD_LABELS.guide),
  };
}

/**
 * 초안 텍스트를 블록으로 나눈다.
 *
 * 소주제가 하나도 없으면 실패로 본다. 블록 편집의 요점이 놀이 단위 편집인데
 * 놀이가 없으면 나눈 보람이 없고, 그런 초안은 대개 모양이 어긋난 것이다.
 */
export function parse(draft: string): ParseResult {
  const text = (draft ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return { ok: false, reason: "초안이 비어 있습니다." };

  const lines = text.split("\n");
  const blocks: PlayBlock[] = [];

  let i = 0;

  // 머리글 — `[반이름 놀이이야기]`. 없으면 건너뛴다(있는 편이 정상이다).
  if (lines[i]?.trim().startsWith("[")) {
    blocks.push({ kind: "heading", label: "머리글", text: lines[i].trim() });
    i += 1;
  }

  /** 다음 칸 이름이 나올 때까지의 본문을 모은다. */
  const readUntilLabel = (from: number): { body: string; next: number } => {
    const body: string[] = [];
    let k = from;
    while (k < lines.length) {
      const t = lines[k].trim();
      if (t === TOPIC_LABEL || t === LEARNING_LABEL || t === PLAYS_LABEL) break;
      body.push(lines[k]);
      k += 1;
    }
    return { body: body.join("\n").trim(), next: k };
  };

  while (i < lines.length) {
    const label = lines[i].trim();

    if (label === TOPIC_LABEL) {
      const got = readUntilLabel(i + 1);
      blocks.push({ kind: "topic", label: TOPIC_LABEL, text: got.body });
      i = got.next;
      continue;
    }
    if (label === LEARNING_LABEL) {
      const got = readUntilLabel(i + 1);
      blocks.push({ kind: "learning", label: LEARNING_LABEL, text: got.body });
      i = got.next;
      continue;
    }
    if (label === PLAYS_LABEL) {
      i += 1;
      break; // 여기부터 끝까지가 소주제 구역이다
    }
    i += 1; // 알 수 없는 줄은 건너뛴다
  }

  // 소주제 — 번호 줄에서 잘라 덩어리로 만든다.
  const plays: string[][] = [];
  let current: string[] | null = null;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (PLAY_HEAD.test(line.trim()) && !BULLET.test(line.trim())) {
      current = [line];
      plays.push(current);
      continue;
    }
    if (current && line.trim()) current.push(line);
  }

  for (const chunk of plays) {
    const block = parsePlay(chunk);
    if (block) blocks.push(block);
  }

  if (!blocks.some((b) => b.kind === "play")) {
    return { ok: false, reason: "소주제를 찾지 못했습니다." };
  }
  return { ok: true, blocks };
}

// ------------------------------------------------------------------
// 직렬화
// ------------------------------------------------------------------

/** 소주제 하나를 초안 형식으로 되돌린다. EP-055 응답을 파싱할 때도 이 짝을 쓴다. */
export function serializePlay(block: Extract<PlayBlock, { kind: "play" }>): string {
  const head = `${block.index}. ${block.title}${block.date ? ` (${block.date})` : ""}`;
  return [
    head,
    `⋅${FIELD_LABELS.story}: ${block.story}`,
    `⋅${FIELD_LABELS.quote}: ${block.quote}`,
    `⋅${FIELD_LABELS.guide}: ${block.guide}`,
  ].join("\n");
}

/**
 * 블록을 다시 초안 텍스트로 합친다.
 *
 * 소주제 번호는 **자리 순서로 다시 매긴다.** 교사가 중간 것을 지우면 번호가
 * 1,2,4로 비는데, 그대로 저장하면 다음에 파싱할 때 그 번호가 그대로 살아나
 * 서식의 번호가 어긋난다.
 */
export function serialize(blocks: PlayBlock[]): string {
  const parts: string[] = [];
  const plays = blocks.filter(
    (b): b is Extract<PlayBlock, { kind: "play" }> => b.kind === "play",
  );

  for (const block of blocks) {
    if (block.kind === "heading") parts.push(block.text);
    else if (block.kind === "topic") parts.push(`${TOPIC_LABEL}\n${block.text}`);
    else if (block.kind === "learning") parts.push(`${LEARNING_LABEL}\n${block.text}`);
  }

  if (plays.length > 0) {
    const listed = plays.map((p, at) => serializePlay({ ...p, index: at + 1 }));
    parts.push(`${PLAYS_LABEL}\n${listed.join("\n\n")}`);
  }

  return parts.join("\n\n");
}

/**
 * EP-055가 돌려준 한 칸의 텍스트를 블록으로 되돌린다.
 *
 * 서버는 그 칸만 쓰라고 지시하지만 모델이 칸 이름을 붙여 올 수도, 안 붙일 수도
 * 있다. 둘 다 받아 준다 — 붙여 왔으면 떼고, 안 붙였으면 그대로 본문으로 본다.
 */
export function parseRegenerated(
  block: PlayBlock,
  text: string,
): PlayBlock | null {
  const clean = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!clean) return null;

  if (block.kind === "play") {
    const lines = clean.split("\n");
    const at = lines.findIndex(
      (l) => PLAY_HEAD.test(l.trim()) && !BULLET.test(l.trim()),
    );
    const parsed = parsePlay(at >= 0 ? lines.slice(at) : ["0. 제목", ...lines]);
    if (!parsed || parsed.kind !== "play") return null;
    // 번호와 제목은 자리가 정한다 — 모델이 번호를 다르게 붙여 와도 순서를 흔들지 않는다.
    return { ...parsed, index: block.index, label: block.label };
  }

  const body = clean.startsWith(block.label)
    ? clean.slice(block.label.length).trim()
    : clean;
  return { ...block, text: body };
}
