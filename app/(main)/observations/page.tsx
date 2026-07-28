"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PencilLine, Plus, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/store";
import {
  useAddObservation,
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
import { TODAY } from "@/lib/constants";
import { DEV_DOMAINS } from "@/lib/types";
import type { ObservationEntry } from "@/lib/types";

// SCR-008 관찰·발달영역 조회 — 발달평가서(FN-011)의 원료
export default function ObservationsPage() {
  const { toast } = useApp();
  const childrenQuery = useChildren();
  const [childId, setChildId] = useState("c01");
  const obsQuery = useObservations(childId);
  const tagMutation = useUpdateObservationTag();
  const addMutation = useAddObservation();

  const [editTarget, setEditTarget] = useState<ObservationEntry | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newMemo, setNewMemo] = useState("");
  const [newTag, setNewTag] = useState<(typeof DEV_DOMAINS)[number] | null>(
    null,
  );

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

  const openAdd = () => {
    setNewMemo("");
    setNewTag(null);
    setAddOpen(true);
  };

  const submitAdd = () => {
    if (!newMemo.trim()) return;
    addMutation.mutate(
      { childId, tag: newTag, memo: newMemo },
      {
        onSuccess: () => {
          toast(
            newTag
              ? `관찰 기록을 추가했습니다 — ${newTag} 수동 태그로 저장`
              : "관찰 기록을 추가했습니다 — 태그는 나중에 달 수 있어요",
          );
          setAddOpen(false);
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
          <div className="flex flex-wrap items-end gap-4">
            <div className="field m-0 w-[150px]">
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
            <div className="field m-0 w-[150px]">
              <label>기간</label>
              <select className="input">
                <option>최근 1개월</option>
                <option>최근 3개월</option>
                <option>올해 전체</option>
              </select>
            </div>
            {child && (
              <span className="ml-auto inline-flex items-center gap-2 pb-2.5 text-[13px] text-muted">
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
            <button className="btn ghost ml-auto px-2.5 py-1" onClick={openAdd}>
              <Plus size={14} /> 관찰 추가
            </button>
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
        open={addOpen}
        label="관찰 기록 추가"
        onClose={() => setAddOpen(false)}
      >
        <h3>관찰 기록 추가</h3>
        <div className="desc">
          {child?.name ?? "이 아이"} · {TODAY} — 관찰한 내용을 직접 남깁니다.
          발달영역은 선택 사항이며, 지정하면 수동 태그로 박제됩니다.
        </div>
        <div className="field mt-4">
          <label>관찰 메모</label>
          <textarea
            className="input min-h-[92px] resize-y"
            value={newMemo}
            onChange={(e) => setNewMemo(e.target.value)}
            placeholder="예) 블록으로 다리를 만들며 친구에게 만드는 방법을 설명함"
            aria-label="관찰 메모"
          />
        </div>
        <div className="field">
          <label>발달영역 (선택)</label>
          <div className="chiprow">
            {DEV_DOMAINS.map((d) => (
              <button
                key={d}
                className={`chip ${newTag === d ? "on" : ""}`}
                onClick={() => setNewTag(newTag === d ? null : d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="btnrow mt-4">
          <button
            className="btn primary"
            onClick={submitAdd}
            disabled={!newMemo.trim() || addMutation.isPending}
          >
            <Plus size={14} />
            {addMutation.isPending ? "저장 중…" : "관찰 추가"}
          </button>
          <button className="btn" onClick={() => setAddOpen(false)}>
            취소
          </button>
        </div>
      </Modal>

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
