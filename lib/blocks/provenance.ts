/**
 * 출처 표시를 **현재 본문**에 다시 붙인다 (FN-022).
 *
 * ■ 왜 다시 붙여야 하나
 * 서버가 준 위치는 **AI 초안**에 대한 것이다. 교사가 한 글자만 고쳐도 그 뒤의
 * 모든 위치가 밀린다. 그대로 쓰면 밑줄이 엉뚱한 문장에 그어지고, 그건 출처를
 * 안 보여 주는 것보다 나쁘다 — 교사가 잘못된 근거를 믿게 된다.
 *
 * 그래서 span마다 함께 온 **문구**를 현재 본문에서 찾는다.
 *
 *   찾음      그 자리에 밑줄을 그린다(`matched`)
 *   못 찾음   본문에는 그리지 않고 목록으로 따로 모은다(`orphans`)
 *
 * 출처를 조용히 버리지 않는 것이 요점이다. 교사가 고친 문장의 근거도 여전히
 * 알아야 할 값이다.
 *
 * ■ 같은 문구가 여러 번 나오면
 * 서버가 준 원래 위치에서 **가장 가까운** 것을 고른다. 문장이 통째로 옮겨지는
 * 일은 드물고, 대개는 앞쪽이 조금 늘거나 줄어든 것이라 이 규칙이 맞는다.
 */

import type { ProvenanceSpan } from "@/lib/types";

/**
 * 현재 본문에 자리를 잡은 span. `start`는 **현재 본문** 기준이다.
 *
 * 위치가 서버가 준 값과 다른지는 남기지 않는다. 문구가 정확히 일치할 때만
 * 자리를 잡으므로 밀렸다는 사실이 근거의 옳음을 흔들지 않고, 맨 앞을 한 글자
 * 고치면 뒤가 전부 "밀린" 상태가 되어 표시로서 쓸모가 없다.
 */
export type AnchoredSpan = ProvenanceSpan;

export type Anchored = {
  matched: AnchoredSpan[];
  /** 문구를 찾지 못한 span. 본문에 밑줄이 없고 목록으로만 보인다 */
  orphans: ProvenanceSpan[];
};

/** 문구가 나오는 모든 위치. */
function allIndexes(haystack: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let at = haystack.indexOf(needle);
  while (at >= 0) {
    out.push(at);
    at = haystack.indexOf(needle, at + 1);
  }
  return out;
}

export function anchor(
  text: string,
  spans: ProvenanceSpan[] | null | undefined,
): Anchored {
  const body = text ?? "";
  const matched: AnchoredSpan[] = [];
  const orphans: ProvenanceSpan[] = [];

  for (const span of spans ?? []) {
    const hits = allIndexes(body, span.text);
    if (hits.length === 0) {
      orphans.push(span);
      continue;
    }
    // 원래 위치에서 가장 가까운 것. 같은 거리면 앞쪽을 쓴다.
    let best = hits[0];
    for (const hit of hits) {
      if (Math.abs(hit - span.start) < Math.abs(best - span.start)) best = hit;
    }
    matched.push({ ...span, start: best });
  }

  // 겹침을 걷어낸다. 밑줄이 겹치면 어느 구문을 눌렀는지 알 수 없다 —
  // 앞에서 시작하는 것을 살리고, 그 안에 물린 것은 짝 없는 쪽으로 보낸다.
  matched.sort((a, b) => a.start - b.start);
  const kept: AnchoredSpan[] = [];
  let end = -1;
  for (const span of matched) {
    if (span.start < end) {
      orphans.push(span);
      continue;
    }
    kept.push(span);
    end = span.start + span.length;
  }

  return { matched: kept, orphans };
}

/** 본문을 밑줄 조각과 평문 조각으로 쪼갠다. 화면이 그대로 그린다. */
export type Piece =
  | { kind: "text"; text: string }
  | { kind: "span"; text: string; span: AnchoredSpan; key: string };

export function split(text: string, matched: AnchoredSpan[]): Piece[] {
  const body = text ?? "";
  const pieces: Piece[] = [];
  let at = 0;

  matched.forEach((span, i) => {
    if (span.start > at) {
      pieces.push({ kind: "text", text: body.slice(at, span.start) });
    }
    pieces.push({
      kind: "span",
      text: body.slice(span.start, span.start + span.length),
      span,
      key: `${span.start}-${i}`,
    });
    at = span.start + span.length;
  });

  if (at < body.length) pieces.push({ kind: "text", text: body.slice(at) });
  return pieces;
}
