/**
 * 계획안 초안 ↔ 블록 (SCR-007).
 *
 * ■ 왜 파싱인가
 * 초안은 줄글 한 덩어리로 오지만 **이미 규칙적이다.** 서식 프로필
 * (`backend/data/form_profiles/{weekly,monthly}_plan.json`)이 칸 이름과
 * 머리표(⋅)를 지시하고 있어서, 나오는 글이 늘 아래 모양을 따른다.
 *
 *     놀이 주제
 *     여름이 좋아요
 *
 *     주차별 놀이
 *     1주 < 물을 만나요 >
 *     ⋅손으로 물을 첨벙첨벙 쳐 봐요 ⋅컵에 물을 담았다 부어요
 *
 * 그러니 생성 방식을 바꿀 필요 없이 나눠 담기만 하면 된다.
 *
 * ■ 놀이가 한 줄에 이어져 있다
 * 이것이 이 파일의 존재 이유다. 놀이 다섯 개가 `⋅`로 이어진 200자 한 줄이라,
 * 하나를 바꾸려면 교사가 그 구절을 찾아 지우고 **머리표를 살려서** 고쳐 써야
 * 한다. 하나를 빼면 앞뒤 공백이 남는다. 줄로 나눠 두면 그 일이 사라진다.
 *
 * ■ 실패는 조용히
 * 모델이 쓰는 글이라 모양이 어긋날 때가 있다. 그때 예외를 던지면 화면이 빈다 —
 * 초안은 멀쩡히 있는데 보여 주지 못하는 셈이다. 그래서 `parse`는 실패해도
 * 예외를 내지 않고 `ok: false`를 돌려주며, 화면은 지금까지처럼 통짜 편집기를
 * 보여 준다.
 *
 * ■ 왕복이 손실 없이 닫혀야 한다
 * 교사가 고친 블록을 다시 초안 텍스트로 합쳐 저장한다(`serialize`). 파싱과
 * 직렬화가 어긋나면 저장할 때마다 글이 조금씩 달라진다.
 */

import type { DocType } from "@/lib/types";

/** 서식이 정한 칸 이름. 프로필을 고치면 여기도 함께 고친다. */
const SECTIONS: Record<"plan" | "plan_monthly", string[]> = {
  plan: ["주제", "기간", "일과별 계획", "주간 놀이", "발달영역 연계"],
  plan_monthly: ["놀이 주제", "놀이 기간", "교사의 기대", "주차별 놀이"],
};

/** 항목 줄 머리표. 서식이 `⋅`(U+22C5)를 쓴다 — 가운뎃점(·)과 다른 글자다. */
const BULLET = "⋅";

/** 여러 항목이 이어진 칸의 분량 기준(글자). 서식 프로필의 `target_chars`다. */
const BUDGET: Record<string, number> = {
  주제: 10,
  기간: 30,
  "일과별 계획": 115,
  "주간 놀이": 170,
  "발달영역 연계": 125,
  "놀이 주제": 6,
  "놀이 기간": 20,
  "교사의 기대": 130,
  "주차별 놀이": 135,
};

/** `1주 < 물을 만나요 >` — 주차 번호와 소주제를 뜯는다. */
const WEEK_HEAD = /^(\d{1,2})\s*주\s*<\s*(.*?)\s*>\s*$/;

export type PlanBlock =
  /** 한 줄짜리 칸 — 주제·기간. 값만 고친다. */
  | { kind: "line"; key: string; section: string; label: string; text: string }
  /** 여러 문장이 든 칸 — 발달영역 연계. 통째로 고친다. */
  | { kind: "text"; key: string; section: string; label: string; text: string }
  /** `⋅` 항목이 늘어선 칸 — 교사의 기대·주간 놀이. 줄 단위로 고친다. */
  | {
      kind: "list";
      key: string;
      section: string;
      label: string;
      /** 항목을 부르는 이름 — 「+ 놀이 추가」의 그 말 */
      noun: string;
      items: string[];
      /** 원래 글에서 항목이 줄마다 있었나 — 직렬화가 그 모양을 지킨다 */
      perLine: boolean;
    }
  /** 주차 하나 — 소주제 + 놀이 줄들. */
  | {
      kind: "week";
      key: string;
      section: string;
      label: string;
      no: number;
      subtopic: string;
      items: string[];
      perLine: boolean;
    }
  /** 일과 하나 — 일과 이름 + 계획 줄들. */
  | {
      kind: "routine";
      key: string;
      section: string;
      label: string;
      name: string;
      items: string[];
      perLine: boolean;
    };

export type PlanParseResult =
  { ok: true; blocks: PlanBlock[] } | { ok: false; reason: string };

/** 이 문서 종류가 블록으로 나뉘는가. 계획안 둘만 해당한다. */
export function isPlanType(type: DocType): type is "plan" | "plan_monthly" {
  return type === "plan" || type === "plan_monthly";
}

/**
 * 블록 하나의 라벨. 백엔드의 `block_label`로 그대로 올라가 프롬프트에 실린다
 * (EP-055) — 화면이 만든 이름을 서버가 되받는 구조다. 그래서 **칸 이름을
 * 그대로 담아야** 모델이 [출력 구조]에서 그 칸을 찾는다.
 */
export function planBlockLabel(block: PlanBlock): string {
  if (block.kind === "week") return `${block.section} ${block.no}주`;
  if (block.kind === "routine") return `${block.section} ${block.name}`;
  return block.section;
}

/** 이 블록이 차지하는 글자 수 — 분량 게이지가 쓴다. */
export function planBlockLength(block: PlanBlock): number {
  if (block.kind === "line" || block.kind === "text") return block.text.length;
  return block.items.join("").length;
}

/** 이 블록의 분량 기준(글자). 서식 칸 크기에서 온 값이다. */
export function planBlockBudget(block: PlanBlock): number {
  return BUDGET[block.section] ?? 150;
}

/** `⋅가 ⋅나 ⋅다` 또는 줄마다 `⋅`인 덩어리를 항목 배열로. */
function splitItems(body: string): string[] {
  return body
    .split(BULLET)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * 항목 배열을 다시 글로. **원래 모양을 지킨다.**
 *
 * 서식 견본은 한 줄에 `⋅가 ⋅나 ⋅다`로 잇지만, 실제 모델(solar-pro4)은 줄마다
 * 하나씩 쓴다(2026-08-28 실측). 어느 쪽이든 파싱은 되지만 **저장할 때 모양을
 * 바꾸면** 교사가 놀이 하나만 고쳐도 문서 전체가 한 줄로 접히고, 원본 초안과의
 * 편집거리(채택률·수정률 지표)가 통째로 부풀어 오른다.
 */
function joinItems(items: string[], perLine: boolean): string {
  const kept = items
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => BULLET + t);
  return kept.join(perLine ? "\n" : " ");
}

/** 항목이 줄마다 있었나 — 머리표로 시작하는 줄이 둘 이상이면 그렇다. */
function isPerLine(body: string[]): boolean {
  return body.filter((l) => l.trim().startsWith(BULLET)).length > 1;
}

/**
 * 초안 텍스트를 블록으로 나눈다.
 *
 * 칸을 하나도 못 찾으면 실패로 본다. 블록 편집의 요점이 칸 단위 편집인데 칸이
 * 없으면 나눈 보람이 없고, 그런 초안은 대개 모양이 어긋난 것이다.
 */
export function parse(draft: string, type: DocType): PlanParseResult {
  if (!isPlanType(type)) return { ok: false, reason: "계획안이 아닙니다." };

  const text = (draft ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return { ok: false, reason: "초안이 비어 있습니다." };

  const names = SECTIONS[type];
  const lines = text.split("\n");
  const blocks: PlanBlock[] = [];

  /** 지금 읽고 있는 칸과 그 본문 줄들. */
  let section: string | null = null;
  let body: string[] = [];

  const flush = () => {
    if (section === null) return;
    blocks.push(...toBlocks(section, body));
    section = null;
    body = [];
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (names.includes(t)) {
      flush();
      section = t;
      continue;
    }
    if (section !== null) body.push(raw);
  }
  flush();

  if (blocks.length === 0)
    return { ok: false, reason: "서식의 칸 이름을 찾지 못했습니다." };
  return { ok: true, blocks };
}

/** 한 칸의 본문을 그 칸에 맞는 블록들로. 주차·일과는 여럿으로 갈라진다. */
function toBlocks(section: string, body: string[]): PlanBlock[] {
  const joined = body.join("\n").trim();

  // 주차별 놀이 — `N주 < 소주제 >` 마다 하나씩
  if (section === "주차별 놀이") {
    const out: PlanBlock[] = [];
    let head: RegExpExecArray | null = null;
    let items: string[] = [];
    /** 이 주의 놀이가 몇 줄에 걸쳐 있었나 */
    let lineCount = 0;
    const push = () => {
      if (!head) return;
      out.push({
        kind: "week",
        key: `${section}-${head[1]}`,
        section,
        label: `${section} · ${head[1]}주`,
        no: Number(head[1]),
        subtopic: head[2],
        items,
        perLine: lineCount > 1,
      });
      head = null;
      items = [];
      lineCount = 0;
    };
    for (const raw of body) {
      const t = raw.trim();
      const m = WEEK_HEAD.exec(t);
      if (m) {
        push();
        head = m;
        continue;
      }
      if (head && t) {
        items.push(...splitItems(t));
        lineCount += 1;
      }
    }
    push();
    if (out.length > 0) return out;
  }

  // 일과별 계획 — 머리표 없는 줄이 일과 이름, 그 아래가 계획 줄
  if (section === "일과별 계획") {
    const out: PlanBlock[] = [];
    let name: string | null = null;
    let items: string[] = [];
    let lineCount = 0;
    const push = () => {
      if (name === null) return;
      out.push({
        kind: "routine",
        key: `${section}-${name}`,
        section,
        // 시각까지 넣으면 카드 제목이 길어 문장을 밀어낸다. 시각은 부제로 간다.
        label: `${section} · ${name.split(" (")[0]}`,
        name,
        items,
        perLine: lineCount > 1,
      });
      name = null;
      items = [];
      lineCount = 0;
    };
    for (const raw of body) {
      const t = raw.trim();
      if (!t) continue;
      if (t.startsWith(BULLET)) {
        if (name !== null) {
          items.push(...splitItems(t));
          lineCount += 1;
        }
        continue;
      }
      push();
      name = t;
    }
    push();
    if (out.length > 0) return out;
  }

  // 머리표가 있으면 항목 칸, 없으면 글 칸
  if (joined.includes(BULLET)) {
    return [
      {
        kind: "list",
        key: section,
        section,
        label: section,
        noun: section === "교사의 기대" ? "기대" : "놀이",
        items: splitItems(joined),
        perLine: isPerLine(body),
      },
    ];
  }

  const single = !joined.includes("\n") && joined.length <= 40;
  return [
    {
      kind: single ? "line" : "text",
      key: section,
      section,
      label: section,
      text: joined,
    },
  ];
}

/**
 * 블록을 다시 초안 텍스트로 합친다.
 *
 * 같은 칸에서 갈라진 블록들(주차·일과)은 **칸 이름을 한 번만** 쓴다 — 파싱이
 * 칸 이름으로 경계를 잡으므로, 두 번 쓰면 다음 파싱에서 칸이 둘로 갈린다.
 */
export function serialize(blocks: PlanBlock[]): string {
  const out: string[] = [];
  let lastSection: string | null = null;

  for (const block of blocks) {
    const parts: string[] = [];
    if (block.section !== lastSection) {
      parts.push(block.section);
      lastSection = block.section;
    }

    if (block.kind === "line" || block.kind === "text") {
      parts.push(block.text);
    } else if (block.kind === "list") {
      parts.push(joinItems(block.items, block.perLine));
    } else if (block.kind === "week") {
      parts.push(`${block.no}주 < ${block.subtopic} >`);
      parts.push(joinItems(block.items, block.perLine));
    } else {
      parts.push(block.name);
      parts.push(joinItems(block.items, block.perLine));
    }
    out.push(parts.filter((p) => p !== "").join("\n"));
  }

  /*
    같은 칸에서 갈라진 블록끼리는 한 줄만 띄우고, 칸이 바뀔 때 두 줄을 띄운다.
    파싱은 빈 줄을 보지 않지만 사람이 읽는 글이라 경계가 보여야 한다.
  */
  let text = "";
  blocks.forEach((block, i) => {
    if (i > 0) text += blocks[i - 1].section === block.section ? "\n" : "\n\n";
    text += out[i];
  });
  return text;
}

/**
 * EP-055가 돌려준 텍스트를 그 블록에 다시 담는다.
 *
 * 서버는 **그 칸 하나만** 쓴 텍스트를 준다(칸 이름은 붙기도, 안 붙기도 한다).
 * 모양이 어긋나면 통째로 본문에 넣는 편이 낫다 — 교사가 보고 고칠 수 있다.
 */
export function applyRegenerated(block: PlanBlock, text: string): PlanBlock {
  const body = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!body) return block;

  // 칸 이름이 첫 줄에 붙어 오면 떼어 낸다.
  const lines = body.split("\n");
  if (lines[0].trim() === block.section) lines.shift();
  const rest = lines.join("\n").trim();

  if (block.kind === "line" || block.kind === "text")
    return { ...block, text: rest };

  if (block.kind === "week") {
    const m = WEEK_HEAD.exec(lines[0]?.trim() ?? "");
    const items = splitItems((m ? lines.slice(1).join("\n") : rest).trim());
    return {
      ...block,
      subtopic: m ? m[2] : block.subtopic,
      items: items.length > 0 ? items : block.items,
    };
  }

  if (block.kind === "routine") {
    // 일과 이름이 첫 줄에 오면 그대로 두고 나머지를 항목으로 읽는다.
    const first = lines[0]?.trim() ?? "";
    const hasName = first !== "" && !first.startsWith(BULLET);
    const items = splitItems(
      (hasName ? lines.slice(1).join("\n") : rest).trim(),
    );
    return { ...block, items: items.length > 0 ? items : block.items };
  }

  const items = splitItems(rest);
  return { ...block, items: items.length > 0 ? items : block.items };
}
