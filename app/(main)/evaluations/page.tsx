"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  useChildren,
  useDocumentDraft,
  useObservations,
} from "@/lib/queries";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { ProvenanceReader } from "@/components/document/ProvenanceReader";
import {
  Avatar,
  Notice,
  PageHead,
  Select,
  Skeleton,
  SpecBar,
} from "@/components/ui";
import type { DevelopmentDomain, ObservationEntry } from "@/lib/types";

// SCR-011 발달평가서 — 누적 관찰 종합 (아동 단위 문서)
export default function EvaluationsPage() {
  const childrenQuery = useChildren();
  const kids = childrenQuery.data ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const childId = picked ?? kids[0]?.id ?? "";
  const obsQuery = useObservations(childId);
  // 출처 표시는 문서에 딸려 온다. 워크벤치도 같은 훅을 쓰므로 같은 캐시를 본다.
  const draftQuery = useDocumentDraft("evaluation", childId);

  const child = kids.find((c) => c.id === childId);
  const totalObs =
    obsQuery.data?.domains.reduce((sum, d) => sum + d.count, 0) ?? 0;

  return (
    <>
      <PageHead
        title="발달평가서"
        sub={`${child?.name ?? "…"} · 2026 — 누적 관찰 종합`}
        right={
          <Select
            className="w-[180px]"
            ariaLabel="아이 선택"
            value={childId}
            onChange={setPicked}
            options={kids.map((c) => ({ value: c.id, label: c.name }))}
          />
        }
      />
      <SpecBar
        scr="SCR-011"
        fn={["FN-011", "FN-005"]}
        ep={["EP-010 generate(dev_eval)", "EP-013", "EP-014"]}
      />

      <DocumentWorkbench
        key={childId}
        type="evaluation"
        childId={childId}
        /*
          출처 보기(FN-022) — 초안의 어느 구문이 어느 관찰에서 나왔는지.
          `provenance`가 null이면(추적 안 하는 타입·구버전 서버) 토글이 붙지
          않아 화면이 지금과 똑같다.
        */
        provenanceView={
          draftQuery.data?.provenance
            ? (working) => (
                <ProvenanceReader
                  text={working}
                  spans={draftQuery.data?.provenance ?? []}
                  timeline={obsQuery.data?.timeline ?? []}
                  childId={childId}
                />
              )
            : undefined
        }
        source={
          <>
            {child && (
              <div className="mb-3 flex items-center gap-2.5">
                <Avatar name={child.name} color={child.color} size="lg" />
                <div>
                  <div className="font-bold">{child.name}</div>
                  <div className="text-[12px] text-muted">
                    {child.birthDate} · 누적 관찰 {totalObs}건
                  </div>
                </div>
              </div>
            )}
            {obsQuery.isLoading ? (
              <Skeleton lines={5} />
            ) : (
              <div className="flex flex-col">
                {obsQuery.data?.domains.map((d) => (
                  <DomainFold
                    key={d.name}
                    name={d.name}
                    count={d.count}
                    memos={(obsQuery.data?.timeline ?? []).filter((r) =>
                      r.tags.includes(d.name as DevelopmentDomain),
                    )}
                  />
                ))}
              </div>
            )}
            <div className="mt-3">
              <Notice kind="soft">
                입력이 상한(8K)을 넘으면 최근·대표 기록 위주로 추려 생성하고,
                근거로 남긴 기록을 표시합니다.
              </Notice>
            </div>
          </>
        }
      />
    </>
  );
}

/**
 * 영역 한 줄을 눌러 그 영역으로 태깅된 관찰 메모를 펼쳐 본다.
 *
 * "신체운동 관찰 4건"만 보여 주면 교사는 그 4건이 무엇이었는지 확인할 방법이
 * 없다. 초안이 사실과 맞는지 대조하려면 근거가 된 메모를 그 자리에서 볼 수
 * 있어야 한다 — 원천 패널의 존재 이유가 그것이다.
 */
function DomainFold({
  name,
  count,
  memos,
}: {
  name: string;
  count: number;
  memos: ObservationEntry[];
}) {
  const [open, setOpen] = useState(false);
  const empty = count === 0;

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        className="flex w-full items-center gap-2 py-2.5 text-left disabled:cursor-default"
        onClick={() => setOpen((v) => !v)}
        disabled={empty}
        aria-expanded={open}
      >
        <ChevronRight
          size={14}
          className={`shrink-0 text-muted transition-transform ${
            open ? "rotate-90" : ""
          } ${empty ? "opacity-0" : ""}`}
        />
        <span className="flex-1 text-[13.5px]">{name}</span>
        <span
          className={`text-[13px] font-bold ${empty ? "text-muted" : "text-ink"}`}
        >
          {empty ? "관찰 없음" : `관찰 ${count}건`}
        </span>
      </button>

      {open && memos.length > 0 && (
        <ul className="m-0 mb-3 list-none space-y-2 border-l-2 border-line-strong pl-3">
          {memos.map((m) => (
            <li key={m.id} className="text-[12.5px] leading-relaxed">
              <span className="mr-1.5 font-mono text-[11.5px] text-muted">
                {m.date.slice(5)}
              </span>
              {m.manualTag && (
                <span className="mr-1 text-[11px] text-muted" title="수동 태그">
                  ✎
                </span>
              )}
              <span className="text-ink">{m.memo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
