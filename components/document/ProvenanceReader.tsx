"use client";

/**
 * 출처 보기 (FN-022) — 초안의 어느 구문이 어느 기록에서 나왔는지.
 *
 * ■ 왜 편집기와 따로인가
 * 밑줄은 `textarea` 안에 그릴 수 없다. 그래서 **읽기 전용 뷰**를 하나 두고
 * 편집기와 토글한다. 교사의 일이 둘로 나뉘어 있어서 오히려 맞는 구분이다 —
 * "사실이 맞나 확인하는" 일과 "문장을 고치는" 일.
 *
 * ■ 블록이 단위다
 * 발달평가서는 본문 한 덩어리, 보육일지는 서식의 칸 하나하나가 블록이다. 같은
 * 부품으로 둘을 그리는 이유는 밑줄·자리 다시 찾기·출처 패널이 똑같기 때문이다.
 * 다른 것은 **블록에 이름이 있는가**뿐이다.
 *
 * ■ 칸 이름은 크게 붙인다
 * 라벨을 작은 회색 글씨로 뒀더니 "어느 칸인지 안 보인다"는 말이 바로 나왔다.
 * 칸은 이 화면의 좌표계다 — 교사가 고칠 곳을 한글에서 찾으려면 칸 이름과 표
 * 좌표가 문장보다 먼저 읽혀야 한다. 그래서 블록마다 색 띠 + 굵은 라벨 + 표
 * 좌표를 두고, 고른 구문이 든 블록은 띠가 진해진다.
 *
 * ■ 왼쪽 본문 · 오른쪽 출처
 * 구문을 눌러도 글 위치가 흔들리지 않아 여러 문장을 이어 확인하기 쉽다.
 * 좁은 화면에서는 아래로 쌓인다.
 *
 * ■ 밑줄은 점선이다
 * 실선은 오타 교정 표시로 읽히고, 배경색은 형광펜처럼 본문을 덮어 읽기를
 * 방해한다. 선택한 구문만 실선으로 바뀐다.
 *
 * ■ "위치가 밀렸다"는 표시하지 않는다
 * 처음에는 밀린 구문을 물결선으로 알리려 했는데, 맨 앞에 두 글자만 넣어도 뒤의
 * 모든 구문이 밀려 문서가 온통 경고가 됐다. 게다가 우리는 **문구가 정확히
 * 일치할 때만** 밑줄을 그린다 — 위치가 밀린 것과 근거가 옳은 것은 아무 상관이
 * 없다. 정말 알려야 할 것은 하나뿐이다: **문구를 못 찾은 구문**.
 *
 * ■ 출처를 조용히 버리지 않는다
 * 고쳐서 문구를 아예 못 찾은 span은 밑줄이 없다. 대신 목록으로 모아 둔다 —
 * 그 문장의 근거도 교사가 알아야 할 값이다.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, FileSearch, Lock } from "lucide-react";
import { anchor, split } from "@/lib/blocks/provenance";
import type { Citation, ProvenanceSpan } from "@/lib/types";
import { CitationPanel } from "@/components/document/CitationPanel";
import { Notice } from "@/components/ui";

/** 밑줄을 그릴 글 한 덩어리. 보육일지는 서식의 칸 하나가 이것이다. */
export type ProvenanceBlock = {
  key: string;
  /** 서식의 행/열 이름. 없으면 이름 없는 한 덩어리(발달평가서 본문)다. */
  label?: string | null;
  /** 표 좌표 — 교사가 한글에서 그 칸을 찾을 때 쓴다. */
  where?: string | null;
  text: string;
  spans: ProvenanceSpan[];
  /** 서식에 인쇄된 문구 칸 — 고치지 않고 그대로 나간다. */
  locked?: boolean;
};

/** 출처 패널에 그릴 기록 하나. 화면마다 부르는 이름이 달라 문자열로 받는다. */
export type SourceRecordCard = {
  /** 앞머리 — 발달평가서는 날짜, 보육일지는 날짜와 아이 이름 */
  lead: string;
  tags: string[];
  body: string;
  /** 「그 화면에서 보기」 링크. 없으면 버튼을 그리지 않는다. */
  href?: string;
  hrefLabel?: string;
};

export function ProvenanceReader({
  blocks,
  records,
  citations = [],
  hint,
}: {
  blocks: ProvenanceBlock[];
  /** 기록 id → 그 기록의 카드. 화면이 만들어 준다. */
  records: Map<number, SourceRecordCard>;
  /**
   * 이 초안이 기대고 있는 근거(FN-004). 기록과 성격이 달라 밑줄이 아니라 목록으로
   * 보여 준다 — 근거는 "어떤 말로 서술할지"의 기준이라 특정 구문에 1:1로 붙지
   * 않는다. 억지로 매달면 없는 대응 관계를 있는 것처럼 보여 주게 된다.
   */
  citations?: Citation[];
  /** 본문 위에 놓을 한 줄 안내. 화면마다 다르다. */
  hint?: React.ReactNode;
}) {
  /** 고른 구문 — `블록키|span번호`. 블록이 여러 개라 블록 키까지 있어야 한다. */
  const [picked, setPicked] = useState<string | null>(null);

  /*
    자리 다시 찾기는 블록마다 따로 한다 — span의 위치가 그 블록 안에서의 값이다.
    교사가 한 칸을 고쳐도 다른 칸의 밑줄은 흔들리지 않는다.
  */
  const anchored = useMemo(
    () =>
      blocks.map((block) => {
        const { matched, orphans } = anchor(block.text, block.spans);
        return { block, pieces: split(block.text, matched), matched, orphans };
      }),
    [blocks],
  );

  const totalMarks = anchored.reduce((n, b) => n + b.matched.length, 0);
  const orphans = anchored.flatMap((b) =>
    b.orphans.map((span) => ({ span, block: b.block })),
  );

  const active = (() => {
    if (!picked) return null;
    for (const entry of anchored) {
      for (const piece of entry.pieces) {
        if (piece.kind === "span" && keyOf(entry.block, piece.key) === picked)
          return { span: piece.span, block: entry.block };
      }
    }
    return null;
  })();

  return (
    <div className="grid items-start gap-3.5 [grid-template-columns:1.5fr_1fr] max-[1000px]:grid-cols-1">
      {/* ---------------- 본문 ---------------- */}
      <div className="flex flex-col gap-2.5">
        <div className="text-[12.5px] text-muted">
          {hint ?? "점선 밑줄 = 기록에서 나온 구문 · 눌러서 근거를 봅니다"}
        </div>

        {anchored.map(({ block, pieces }) => {
          const isActive = active?.block.key === block.key;
          return (
            <div
              key={block.key}
              className={`rounded-[12px] border border-l-[4px] bg-surface px-3.5 py-3 ${
                isActive
                  ? "border-green border-l-green"
                  : "border-line border-l-line"
              }`}
            >
              {/* 칸 이름 — 이 화면의 좌표계라 문장보다 먼저 읽혀야 한다 */}
              {(block.label || block.where) && (
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {block.label && (
                    <span className="text-[13.5px] font-bold leading-tight text-ink">
                      {block.label}
                    </span>
                  )}
                  {block.locked && (
                    <span className="tag" title="서식에 인쇄된 문구">
                      <Lock size={10} className="mr-0.5 inline" />
                      서식 문구
                    </span>
                  )}
                  {block.where && (
                    <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-faint">
                      {block.where}
                    </span>
                  )}
                </div>
              )}

              <div className="whitespace-pre-wrap text-[14.5px] leading-[1.95]">
                {pieces.map((piece, i) =>
                  piece.kind === "text" ? (
                    // key는 자리로 잡는다. 난수를 쓰면 매 렌더마다 전부 다시 붙는다.
                    <span key={`t-${i}`}>{piece.text}</span>
                  ) : (
                    <SpanMark
                      key={piece.key}
                      text={piece.text}
                      count={piece.span.recordIds.length}
                      picked={picked === keyOf(block, piece.key)}
                      onToggle={() =>
                        setPicked((prev) =>
                          prev === keyOf(block, piece.key)
                            ? null
                            : keyOf(block, piece.key),
                        )
                      }
                    />
                  ),
                )}
                {!block.text.trim() && (
                  <span className="text-[13px] text-muted">
                    비어 있는 칸입니다.
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {orphans.length > 0 && (
          <div className="mt-0.5">
            <Notice kind="warn">
              <span>
                <AlertTriangle size={13} className="mr-1 inline" />
                <b>고쳐진 구문 {orphans.length}곳</b> — 본문에서 그 문구를 찾지
                못해 밑줄을 그리지 않았습니다. 출처는 아래에 남아 있습니다.
              </span>
            </Notice>
            <div className="mt-2 flex flex-col gap-1.5">
              {orphans.map(({ span, block }, i) => (
                <div
                  key={`orphan-${i}`}
                  className="rounded-[10px] border border-line bg-paper px-3 py-2 text-[12.5px]"
                >
                  <div className="text-muted">
                    원래 문구{block.label ? ` · ${block.label} 칸` : ""}
                  </div>
                  <div className="mb-1.5">{span.text}</div>
                  <RecordList ids={span.recordIds} records={records} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---------------- 출처 패널 ---------------- */}
      <div className="sticky top-3">
        <div className="card">
          <h2>
            <FileSearch size={15} />
            출처
            <span className="hint">
              {active
                ? `기록 ${active.span.recordIds.length}건`
                : `표시 ${totalMarks}곳 · 눌러 보세요`}
            </span>
          </h2>
          {active ? (
            <>
              {/* 어느 칸의 구문인지 — 교사가 고칠 자리를 찾는 열쇠다 */}
              {(active.block.label || active.block.where) && (
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[13px] font-bold text-green-deep">
                    {active.block.label ?? "본문"}
                  </span>
                  <span className="text-[11.5px] text-muted">칸</span>
                  {active.block.where && (
                    <span className="font-mono text-[11px] text-faint">
                      {active.block.where}
                    </span>
                  )}
                </div>
              )}
              <div className="mb-2.5 rounded-[10px] border border-line bg-green-ghost px-3 py-2 text-[12.5px] leading-relaxed text-muted">
                {active.span.text}
              </div>
              <RecordList ids={active.span.recordIds} records={records} />
            </>
          ) : (
            <p className="m-0 text-[13px] text-muted">
              {totalMarks === 0
                ? "이 초안에는 출처 표시가 없습니다. 모델이 표시를 달지 않았거나 형식이 어긋난 경우입니다 — 초안 자체는 그대로입니다."
                : "왼쪽에서 밑줄이 그어진 구문을 눌러 주세요."}
            </p>
          )}
        </div>

        {/*
          근거는 출처 카드 **아래**에 둔다. 교사가 먼저 묻는 것은 "이 문장이 어느
          기록에서 나왔나"이고, 근거는 그다음 질문이다. 기본은 접힘이다 — 근거
          하나가 수백 자라 펼쳐 두면 초안이 화면 밖으로 밀려난다.
        */}
        <CitationPanel citations={citations} />
      </div>
    </div>
  );
}

/** 블록이 여러 개이므로 span 키에 블록 키를 붙여야 유일해진다. */
function keyOf(block: ProvenanceBlock, spanKey: string) {
  return `${block.key}|${spanKey}`;
}

/**
 * 밑줄 그어진 구문 하나.
 *
 * `<button>`이 아니라 span인 이유: 브라우저가 버튼의 display를 inline-block으로
 * 승격시켜(인라인 스타일로도 못 이긴다) 구문이 통째로 다음 줄로 밀려 문장이
 * 끊긴다. 본문 속 한 구문이므로 글 흐름을 그대로 타야 해서 span에 버튼 역할을
 * 준다 — 키보드 조작은 onKeyDown이 맡는다.
 */
function SpanMark({
  text,
  count,
  picked,
  onToggle,
}: {
  text: string;
  count: number;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onToggle();
      }}
      className={`cursor-pointer ${picked ? "bg-green-soft" : "hover:bg-green-ghost"}`}
      style={{
        textDecoration: "underline",
        textDecorationStyle: picked ? "solid" : "dotted",
        textDecorationColor: "var(--green)",
        textDecorationThickness: "2px",
        textUnderlineOffset: "4px",
      }}
      title={`기록 ${count}건에서 나온 구문`}
    >
      {text}
    </span>
  );
}

/** 출처가 된 기록 카드들. 명단에서 못 찾은 기록도 숨기지 않고 밝힌다. */
function RecordList({
  ids,
  records,
}: {
  ids: number[];
  records: Map<number, SourceRecordCard>;
}) {
  if (ids.length === 0) {
    return (
      <p className="m-0 text-[12.5px] text-muted">
        연결된 기록이 없습니다 — 모델이 번호를 잘못 적은 경우입니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {ids.map((id) => {
        const card = records.get(id);
        return (
          <div
            key={id}
            className="rounded-[10px] border border-line bg-surface px-3 py-2.5"
          >
            {card ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11.5px] font-bold text-green-deep">
                    {card.lead}
                  </span>
                  {card.tags.map((t) => (
                    <span key={t} className="tag dom">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 text-[12.5px] leading-relaxed">
                  {card.body}
                </div>
                {card.href && (
                  // 출처를 보다 "이 기록을 고쳐야겠다"는 판단이 나올 때 그 자리에서
                  // 넘어갈 수 있어야 한다.
                  <div className="mt-2">
                    <Link
                      className="btn ghost px-2 py-0.5 text-[11.5px]"
                      href={card.href}
                    >
                      {card.hrefLabel ?? "기록 보기"} <ArrowRight size={11} />
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="text-[12.5px] text-muted">
                이 화면에 불러온 기록 목록에 없습니다
                <span className="ml-1 font-mono text-[11px]">#{id}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
