"use client";

import Link from "next/link";
import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { useApp } from "@/lib/store";
import { useChildren, useObservations } from "@/lib/queries";
import { N, PageHead, QueryError, Skeleton, SpecBar } from "@/components/ui";

// SCR-008 관찰·발달영역 조회 — 발달평가서(FN-011)의 원료
export default function ObservationsPage() {
  const { toast } = useApp();
  const childrenQuery = useChildren();
  const [childId, setChildId] = useState("c01");
  const obsQuery = useObservations(childId);

  return (
    <>
      <PageHead
        title="관찰·발달영역 조회"
        sub="발달 5영역 누적 — 발달평가서(FN-011)의 원료"
      />
      <SpecBar
        scr="SCR-008"
        fn={["FN-010"]}
        ep={["EP-005 observations", "EP-009 태그 수정"]}
      />

      <div className="card">
        <div className="inline">
          <div className="field m-0">
            <label>
              <N n={1} />
              아이
            </label>
            <select
              className="input"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
            >
              {(
                childrenQuery.data ?? [
                  { id: "c01", name: "김민준", recorded: true },
                ]
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field m-0">
            <label>기간</label>
            <select className="input">
              <option>최근 1개월</option>
              <option>최근 3개월</option>
              <option>올해 전체</option>
            </select>
          </div>
          <Link
            className="btn ml-auto inline-flex items-center gap-1.5"
            href="/evaluations"
          >
            <TrendingUp size={14} /> 발달평가서 만들기 →
          </Link>
        </div>
      </div>

      <div className="card">
        <h2>
          <N n={2} />
          발달 5영역 매트릭스
        </h2>
        {obsQuery.isLoading ? (
          <Skeleton lines={2} />
        ) : obsQuery.isError ? (
          <QueryError onRetry={() => obsQuery.refetch()} />
        ) : (
          <div className="matrix">
            {obsQuery.data?.domains.map((d) => (
              <div key={d.name} className="mcell">
                <div className="num">{d.count}</div>
                <div className="lab">{d.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>
          <N n={3} />
          메모 누적 타임라인
        </h2>
        {obsQuery.isLoading ? (
          <Skeleton lines={4} />
        ) : (
          <div className="tl">
            {obsQuery.data?.timeline.map((r) => (
              <div key={r.date} className="row">
                <span className="date">{r.date}</span>{" "}
                {r.tag ? (
                  <span className="tag dom">{r.tag}</span>
                ) : (
                  <span className="tag daily">태그 없음</span>
                )}{" "}
                {r.memo}{" "}
                <button
                  className="btn ghost px-2 py-0.5 text-xs"
                  onClick={() =>
                    toast("수동 태그는 이후 자동 태깅이 덮어쓰지 않습니다")
                  }
                >
                  {r.tag ? "태그 수정 ✎" : "태그 달기 ✎"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
