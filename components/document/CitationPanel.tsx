"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import type { Citation } from "@/lib/types";

/**
 * 초안이 기대고 있는 근거 (FN-004).
 *
 * ■ 왜 밑줄이 아니라 목록인가
 * 원천 기록은 **사실**이 어디서 왔는지라 문장에 밑줄을 그을 수 있다. 근거는
 * 다르다 — "어떤 말로 어떻게 서술할지"의 기준이라 특정 구문에 1:1로 붙지 않는다.
 * 억지로 문장에 매달면 없는 대응 관계를 있는 것처럼 보여 주게 된다.
 *
 * ■ 슬롯이 곧 묶음이다
 * 서버가 발달영역·평가지표별로 **나눠서** 검색한다(`retrieval_plan`). 그 묶음을
 * 그대로 보여 주면 "사회관계 서술은 이 근거들을 보고 썼다"가 바로 읽힌다.
 *
 * ■ 기본은 접힘
 * 근거 한 조각이 수백 자다. 스무 개를 펼쳐 두면 초안이 화면 밖으로 밀려난다.
 * 교사가 궁금할 때 펴 보는 자리다 — 요청도 "드롭다운으로 펴 보거나"였다.
 *
 * ■ 없으면 그 사실을 밝힌다
 * 검색이 비는 일이 있다(근거를 못 찾아도 초안은 그대로 만든다 — FN-004 예외).
 * 그때 패널을 통째로 감추면 교사는 근거가 있었는지조차 알 수 없다.
 */
export function CitationPanel({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  const [openSlot, setOpenSlot] = useState<string | null>(null);

  /** 슬롯 → 근거들. 순서는 서버가 준 그대로 둔다(검색 순위가 곧 그 순서다). */
  const groups = useMemo(() => {
    const map = new Map<string, Citation[]>();
    citations.forEach((c) => {
      const key = c.slot || "일반";
      map.set(key, [...(map.get(key) ?? []), c]);
    });
    return Array.from(map.entries());
  }, [citations]);

  const docs = useMemo(
    () => Array.from(new Set(citations.map((c) => c.doc))),
    [citations],
  );

  return (
    <div className="card mt-3">
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <BookOpen size={15} className="text-green" />
        <span className="text-[14px] font-bold text-ink">근거 자료</span>
        <span className="hint ml-auto">
          {citations.length === 0 ? "없음" : `${citations.length}건`}
        </span>
      </button>

      {citations.length === 0 ? (
        <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-muted">
          이 초안은 근거를 찾지 못한 채 만들어졌습니다. 근거가 없어도 초안은
          그대로 나옵니다 — 기록에 있는 사실로만 쓰였다는 뜻입니다.
        </p>
      ) : (
        !open && (
          <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-muted">
            {docs.join(" · ")}에서 찾았습니다. 눌러서 어떤 대목을 봤는지 확인하세요.
          </p>
        )
      )}

      {open && citations.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {groups.map(([slot, items]) => {
            const isOpen = openSlot === slot;
            return (
              <div
                key={slot}
                className="rounded-[10px] border border-line bg-paper"
              >
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  onClick={() => setOpenSlot(isOpen ? null : slot)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown size={13} />
                  ) : (
                    <ChevronRight size={13} />
                  )}
                  <span className="text-[12.5px] font-bold text-green-deep">
                    {slot}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-faint">
                    {items.length}건
                  </span>
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-2 px-3 pb-3">
                    {items.map((c, i) => (
                      <CitationCard key={`${slot}-${i}`} citation={c} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 근거 한 조각. 본문은 길어서 접어 두고 펼 수 있게 한다 — 누리과정 사례 하나가
 * 700자를 넘기도 한다.
 */
function CitationCard({ citation }: { citation: Citation }) {
  const [full, setFull] = useState(false);
  const long = citation.text.length > 160;

  return (
    <div className="rounded-[9px] border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="text-[11.5px] font-bold text-ink">{citation.doc}</span>
        {citation.where && (
          <span className="text-[11.5px] text-muted">{citation.where}</span>
        )}
        {citation.page != null && (
          <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-faint">
            p.{citation.page}
          </span>
        )}
      </div>
      <p className="mb-0 mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
        {full || !long ? citation.text : `${citation.text.slice(0, 160)}…`}
      </p>
      {long && (
        <button
          className="btn ghost mt-1.5 px-2 py-0.5 text-[11.5px]"
          onClick={() => setFull((v) => !v)}
        >
          {full ? "접기" : "전문 보기"}
        </button>
      )}
    </div>
  );
}
