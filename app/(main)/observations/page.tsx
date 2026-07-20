"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PencilLine, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/store";
import {
  useChildren,
  useObservations,
  useUpdateObservationTag,
} from "@/lib/queries";
import {
  Avatar,
  Modal,
  N,
  PageHead,
  QueryError,
  Skeleton,
  SpecBar,
} from "@/components/ui";
import { DEV_DOMAINS } from "@/lib/types";
import type { ObservationEntry } from "@/lib/types";

// SCR-008 관찰·발달영역 조회 — 발달평가서(FN-011)의 원료
export default function ObservationsPage() {
  const { toast } = useApp();
  const childrenQuery = useChildren();
  const [childId, setChildId] = useState("c01");
  const obsQuery = useObservations(childId);
  const tagMutation = useUpdateObservationTag();

  const [editTarget, setEditTarget] = useState<ObservationEntry | null>(null);

  const kids = childrenQuery.data ?? [];
  const child = kids.find((c) => c.id === childId);
  const maxCount = useMemo(
    () => Math.max(0, ...(obsQuery.data?.domains.map((d) => d.count) ?? [])),
    [obsQuery.data],
  );

  const applyTag = (tag: (typeof DEV_DOMAINS)[number]) => {
    if (!editTarget) return;
    tagMutation.mutate(
      { id: editTarget.id, tag },
      {
        onSuccess: () => {
          toast("수동 태그로 저장 — 이후 자동 태깅이 덮어쓰지 않습니다");
          setEditTarget(null);
        },
      },
    );
  };

  return (
    <>
      <PageHead
        title="관찰·발달영역 조회"
        sub="발달 5영역 누적 — 발달평가서(FN-011)의 원료"
        right={
          <Link className="btn" href="/evaluations">
            <TrendingUp size={14} /> 발달평가서 만들기 →
          </Link>
        }
      />
      <SpecBar
        scr="SCR-008"
        fn={["FN-010"]}
        ep={["EP-005 observations", "EP-009 태그 수정"]}
      />

      <div className="stack">
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
                {(kids.length ? kids : [{ id: "c01", name: "김민준" }]).map(
                  (c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ),
                )}
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
            {child && (
              <span className="ml-auto inline-flex items-center gap-2 text-[13px] text-muted">
                <Avatar name={child.name} color={child.color} />
                {child.name} · 관찰 {obsQuery.data?.timeline.length ?? "…"}건
                누적
              </span>
            )}
          </div>
        </div>

        <div className="card">
          <h2>
            <N n={2} />
            발달 5영역 매트릭스
            <span className="hint">가장 활발한 영역이 진하게 표시됩니다</span>
          </h2>
          {obsQuery.isLoading ? (
            <Skeleton lines={2} />
          ) : obsQuery.isError ? (
            <QueryError onRetry={() => obsQuery.refetch()} />
          ) : (
            <div className="matrix">
              {obsQuery.data?.domains.map((d) => (
                <div
                  key={d.name}
                  className={`mcell ${d.count === maxCount && maxCount > 0 ? "hot" : ""}`}
                >
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
            <span className="hint">태그 없는 메모는 수동 태깅으로 보완</span>
          </h2>
          {obsQuery.isLoading ? (
            <Skeleton lines={4} />
          ) : (obsQuery.data?.timeline.length ?? 0) === 0 ? (
            <div className="py-4 text-center text-[13px] text-muted">
              아직 관찰 기록이 없어요 — 하루 기록의 특이사항 메모가 자동으로
              쌓입니다.
            </div>
          ) : (
            <div className="tl">
              {obsQuery.data?.timeline.map((r) => (
                <div key={r.id} className="row">
                  <span className="date">{r.date.slice(5)}</span>{" "}
                  {r.tag ? (
                    <span className={`tag ${r.manualTag ? "manual" : "dom"}`}>
                      {r.tag}
                      {r.manualTag && " ✎"}
                    </span>
                  ) : (
                    <span className="tag daily">태그 없음</span>
                  )}{" "}
                  {r.memo}{" "}
                  <button
                    className="btn ghost px-2 py-0.5 text-xs"
                    onClick={() => setEditTarget(r)}
                  >
                    <PencilLine size={12} />
                    {r.tag ? "태그 수정" : "태그 달기"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={editTarget !== null}
        label="발달영역 태그 선택"
        onClose={() => setEditTarget(null)}
      >
        <h3>발달영역 태그 선택</h3>
        <div className="desc">
          「{editTarget?.memo}」<br />이 메모의 발달영역을 직접 지정합니다. 수동
          태그는 자동 태깅이 덮어쓰지 않습니다.
        </div>
        <div className="chiprow mt-4">
          {DEV_DOMAINS.map((d) => (
            <button
              key={d}
              className={`chip ${editTarget?.tag === d ? "on" : ""}`}
              onClick={() => applyTag(d)}
              disabled={tagMutation.isPending}
            >
              {d}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
