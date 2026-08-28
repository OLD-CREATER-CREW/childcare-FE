"use client";

/**
 * 출처 보기 (FN-022) — 초안의 어느 구문이 어느 관찰에서 나왔는지.
 *
 * ■ 왜 편집기와 따로인가
 * 밑줄은 `textarea` 안에 그릴 수 없다. 그래서 **읽기 전용 뷰**를 하나 두고
 * 편집기와 토글한다. 교사의 일이 둘로 나뉘어 있어서 오히려 맞는 구분이다 —
 * "사실이 맞나 확인하는" 일과 "문장을 고치는" 일.
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
 * 없다. 맞는 밑줄에 경고를 붙이면 교사가 옳은 표시를 의심하게 된다.
 * 정말 알려야 할 것은 아래 하나뿐이다: **문구를 못 찾은 구문**.
 *
 * ■ 출처를 조용히 버리지 않는다
 * 고쳐서 문구를 아예 못 찾은 span은 본문에 밑줄이 없다. 대신 아래 목록으로
 * 모아 둔다 — 그 문장의 근거도 교사가 알아야 할 값이다.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, FileSearch } from "lucide-react";
import { recordIdToInt } from "@/lib/api/spec";
import { anchor, split } from "@/lib/blocks/provenance";
import type { AnchoredSpan } from "@/lib/blocks/provenance";
import type { ObservationEntry, ProvenanceSpan } from "@/lib/types";
import { Notice } from "@/components/ui";

/** 기록 id → 그 관찰. 관찰 타임라인의 항목 id가 곧 기록 id다. */
function byRecordId(timeline: ObservationEntry[]): Map<number, ObservationEntry> {
  const map = new Map<number, ObservationEntry>();
  timeline.forEach((entry) => {
    const id = recordIdToInt(entry.id);
    if (!Number.isNaN(id)) map.set(id, entry);
  });
  return map;
}

export function ProvenanceReader({
  text,
  spans,
  timeline,
  childId,
}: {
  /** 지금 화면에 있는 본문(작업본). 위치는 이 글 기준으로 다시 잡는다. */
  text: string;
  spans: ProvenanceSpan[];
  /** 관찰 타임라인 — 출처 카드의 날짜·활동·메모가 여기서 온다 */
  timeline: ObservationEntry[];
  childId: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  const { matched, orphans } = useMemo(() => anchor(text, spans), [text, spans]);
  const pieces = useMemo(() => split(text, matched), [text, matched]);
  const records = useMemo(() => byRecordId(timeline), [timeline]);

  const active = matched.find((_, i) => `${matched[i].start}-${i}` === picked);

  return (
    <div className="grid items-start gap-3.5 [grid-template-columns:1.5fr_1fr] max-[1000px]:grid-cols-1">
      {/* ---------------- 본문 ---------------- */}
      <div>
        <div className="mb-2 text-[12.5px] text-muted">
          점선 밑줄 = 관찰에서 나온 구문 · 눌러서 근거를 봅니다
        </div>
        <div className="draftbox whitespace-pre-wrap text-[15px] leading-[2]">
          {pieces.map((piece, i) =>
            piece.kind === "text" ? (
              // key는 자리로 잡는다. 난수를 쓰면 매 렌더마다 전부 다시 붙는다.
              <span key={`t-${i}`}>{piece.text}</span>
            ) : (
              // `<button>`이 아니라 span인 이유: 브라우저가 버튼의 display를
              // inline-block으로 승격시켜(atomic inline box, 인라인 스타일로도
              // 못 이긴다) 구문이 통째로 다음 줄로 밀려 문장이 끊긴다. 본문 속
              // 한 구문이므로 글 흐름을 그대로 타야 해서 span에 버튼 역할을
              // 준다 — 키보드 조작은 아래 onKeyDown이 맡는다.
              <span
                key={piece.key}
                role="button"
                tabIndex={0}
                onClick={() =>
                  setPicked(picked === piece.key ? null : piece.key)
                }
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  setPicked(picked === piece.key ? null : piece.key);
                }}
                className={`cursor-pointer ${
                  picked === piece.key ? "bg-green-soft" : "hover:bg-green-ghost"
                }`}
                style={{
                  textDecoration: "underline",
                  textDecorationStyle: picked === piece.key ? "solid" : "dotted",
                  textDecorationColor: "var(--green)",
                  textDecorationThickness: "2px",
                  textUnderlineOffset: "4px",
                }}
                title={`관찰 ${piece.span.recordIds.length}건에서 나온 구문`}
              >
                {piece.text}
              </span>
            ),
          )}
        </div>

        {orphans.length > 0 && (
          <div className="mt-3">
            <Notice kind="warn">
              <span>
                <AlertTriangle size={13} className="mr-1 inline" />
                <b>고쳐진 구문 {orphans.length}곳</b> — 본문에서 그 문구를 찾지
                못해 밑줄을 그리지 않았습니다. 출처는 아래에 남아 있습니다.
              </span>
            </Notice>
            <div className="mt-2 flex flex-col gap-1.5">
              {orphans.map((span, i) => (
                <div
                  key={`orphan-${i}`}
                  className="rounded-[10px] border border-line bg-paper px-3 py-2 text-[12.5px]"
                >
                  <div className="text-muted">원래 문구</div>
                  <div className="mb-1.5">{span.text}</div>
                  <RecordList ids={span.recordIds} records={records} childId={childId} />
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
                ? `관찰 ${active.recordIds.length}건`
                : `표시 ${matched.length}곳 · 눌러 보세요`}
            </span>
          </h2>
          {active ? (
            <>
              <div className="mb-2.5 rounded-[10px] border border-line bg-green-ghost px-3 py-2 text-[12.5px] leading-relaxed text-muted">
                {active.text}
              </div>
              <RecordList
                ids={active.recordIds}
                records={records}
                childId={childId}
              />
            </>
          ) : (
            <p className="m-0 text-[13px] text-muted">
              {matched.length === 0
                ? "이 초안에는 출처 표시가 없습니다. 모델이 표시를 달지 않았거나 형식이 어긋난 경우입니다 — 초안 자체는 그대로입니다."
                : "왼쪽에서 밑줄이 그어진 구문을 눌러 주세요."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** 출처가 된 관찰 카드들. 명단에서 못 찾은 기록도 숨기지 않고 밝힌다. */
function RecordList({
  ids,
  records,
  childId,
}: {
  ids: number[];
  records: Map<number, ObservationEntry>;
  childId: string;
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
        const entry = records.get(id);
        return (
          <div
            key={id}
            className="rounded-[10px] border border-line bg-surface px-3 py-2.5"
          >
            {entry ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11.5px] font-bold text-green-deep">
                    {entry.date.slice(5)}
                  </span>
                  {entry.tags.map((t) => (
                    <span key={t} className="tag dom">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 text-[12.5px] leading-relaxed">
                  {entry.memo}
                </div>
              </>
            ) : (
              <div className="text-[12.5px] text-muted">
                이 화면에 불러온 관찰 목록에 없는 기록입니다
                <span className="ml-1 font-mono text-[11px]">#{id}</span>
              </div>
            )}
            {/* 제안 2 — 출처를 보다 "이 관찰을 고쳐야겠다"는 판단이 나올 때
                그 자리에서 넘어갈 수 있어야 한다. */}
            <div className="mt-2">
              <Link
                className="btn ghost px-2 py-0.5 text-[11.5px]"
                href={`/observations?child=${childId}`}
              >
                관찰·발달영역으로 가기 <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
