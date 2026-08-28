"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PencilLine, Plus, TrendingUp, X } from "lucide-react";
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
  Select,
  Skeleton,
  SpecBar,
} from "@/components/ui";
import { TODAY } from "@/lib/constants";
import { DEV_DOMAINS } from "@/lib/types";
import type { DevelopmentDomain, ObservationEntry } from "@/lib/types";

// SCR-008 관찰·발달영역 조회 — 발달평가서(FN-011)의 원료
export default function ObservationsPage() {
  const { toast } = useApp();
  const childrenQuery = useChildren();
  const kids = childrenQuery.data ?? [];
  // 선택 아동은 로드된 아동 목록의 첫 번째로 기본 지정한다(실 서버 child_id는
  // 예측 불가하므로 하드코딩 "c01"을 쓰지 않는다).
  const [picked, setPicked] = useState<string | null>(null);
  const childId = picked ?? kids[0]?.id ?? "";
  const obsQuery = useObservations(childId);
  const tagMutation = useUpdateObservationTag();
  const addMutation = useAddObservation();

  const [range, setRange] = useState("최근 1개월");
  /**
   * 매트릭스에서 고른 발달영역. null이면 전체를 본다.
   *
   * 매트릭스는 "어느 영역이 활발한가"를 한눈에 보여 주지만, 그 다음에 교사가
   * 하고 싶은 일은 **그 영역의 관찰만 읽어 보는 것**이다. 예전에는 타임라인을
   * 눈으로 훑으며 태그를 골라내야 했다 — 관찰이 쌓일수록 못 할 일이 된다.
   */
  const [domain, setDomain] = useState<DevelopmentDomain | null>(null);
  const [editTarget, setEditTarget] = useState<ObservationEntry | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newMemo, setNewMemo] = useState("");

  // 태그는 여러 개를 고를 수 있다 — 놀이 하나가 여러 영역에 걸치는 게 보통이다.
  // 여러 개일 때는 고르는 즉시 저장할 수 없으므로(무엇이 최종인지 알 수 없다)
  // 고른 뒤 「저장」을 누르는 흐름으로 간다.
  const [newTags, setNewTags] = useState<DevelopmentDomain[]>([]);
  const [editTags, setEditTags] = useState<DevelopmentDomain[]>([]);

  const toggle = (
    list: DevelopmentDomain[],
    set: (v: DevelopmentDomain[]) => void,
    d: DevelopmentDomain,
  ) => set(list.includes(d) ? list.filter((x) => x !== d) : [...list, d]);

  const openEdit = (row: ObservationEntry) => {
    setEditTags(row.tags ?? []);
    setEditTarget(row);
  };

  // 아이를 바꾸면 필터를 푼다. 그 아이에게는 그 영역의 관찰이 없을 수 있는데,
  // 필터가 남아 있으면 "기록이 없는 아이"처럼 보인다.
  const shownChildRef = useRef(childId);
  useEffect(() => {
    if (shownChildRef.current === childId) return;
    shownChildRef.current = childId;
    setDomain(null);
  }, [childId]);

  const child = kids.find((c) => c.id === childId);
  const maxCount = useMemo(
    () => Math.max(0, ...(obsQuery.data?.domains.map((d) => d.count) ?? [])),
    [obsQuery.data],
  );

  // `?? []`가 렌더마다 새 배열을 만들어 아래 useMemo가 매번 다시 돈다.
  const timeline = useMemo(
    () => obsQuery.data?.timeline ?? [],
    [obsQuery.data],
  );
  /**
   * 고른 영역의 관찰만 남긴다.
   *
   * 한 관찰이 여러 영역에 걸치는 것이 보통이라(놀이 하나가 사회관계이면서
   * 의사소통일 수 있다) `includes`로 본다 — 대표 태그 하나만 보면 그 관찰이
   * 다른 영역에서는 없는 것이 된다.
   */
  const shown = useMemo(
    () => (domain ? timeline.filter((r) => r.tags.includes(domain)) : timeline),
    [timeline, domain],
  );

  const applyTags = () => {
    if (!editTarget) return;
    tagMutation.mutate(
      { id: editTarget.id, tags: editTags },
      {
        onSuccess: () => {
          toast(
            editTags.length
              ? `${editTags.join(" · ")} 수동 태그로 저장 — 자동 태깅이 덮어쓰지 않습니다`
              : "태그를 모두 지웠습니다",
          );
          setEditTarget(null);
        },
      },
    );
  };

  const openAdd = () => {
    setNewMemo("");
    setNewTags([]);
    setAddOpen(true);
  };

  const submitAdd = () => {
    if (!newMemo.trim()) return;
    addMutation.mutate(
      { childId, tags: newTags, memo: newMemo },
      {
        onSuccess: () => {
          toast(
            newTags.length
              ? `관찰 기록을 추가했습니다 — ${newTags.join(" · ")} 수동 태그로 저장`
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
              <Select
                ariaLabel="아이 선택"
                value={childId}
                onChange={setPicked}
                options={kids.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="field m-0 w-[150px]">
              <label>기간</label>
              <Select
                ariaLabel="기간"
                value={range}
                onChange={setRange}
                options={["최근 1개월", "최근 3개월", "올해 전체"]}
              />
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
            <span className="hint">
              칸을 누르면 그 영역의 관찰만 봅니다
            </span>
          </h2>
          {obsQuery.isLoading ? (
            <Skeleton lines={2} />
          ) : obsQuery.isError ? (
            <QueryError onRetry={() => obsQuery.refetch()} />
          ) : (
            <div className="matrix">
              {obsQuery.data?.domains.map((d) => {
                const on = domain === d.name;
                return (
                  <button
                    key={d.name}
                    type="button"
                    className={`mcell ${on ? "on" : ""} ${
                      !on && d.count === maxCount && maxCount > 0 ? "hot" : ""
                    }`}
                    // 관찰이 없는 영역을 누르면 빈 목록만 나온다 — 누를 수
                    // 없다는 것을 보여 주는 편이 낫다.
                    disabled={d.count === 0}
                    aria-pressed={on}
                    onClick={() => setDomain(on ? null : d.name)}
                    title={
                      d.count === 0
                        ? `${d.name} 관찰이 아직 없습니다`
                        : on
                          ? "눌러서 전체 보기"
                          : `${d.name} 관찰만 보기`
                    }
                  >
                    <div className="num">{d.count}</div>
                    <div className="lab">{d.name}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2>
            <N n={3} />
            메모 누적 타임라인
            {domain ? (
              <span className="hint inline-flex items-center gap-1.5">
                <span className="tag dom">{domain}</span>
                {shown.length}건 / 전체 {timeline.length}건
                <button
                  className="btn ghost px-2 py-0.5 text-[11.5px]"
                  onClick={() => setDomain(null)}
                >
                  <X size={11} /> 전체 보기
                </button>
              </span>
            ) : (
              <span className="hint">태그 없는 메모는 수동 태깅으로 보완</span>
            )}
            <button className="btn ghost ml-auto px-2.5 py-1" onClick={openAdd}>
              <Plus size={14} /> 관찰 추가
            </button>
          </h2>
          {obsQuery.isLoading ? (
            <Skeleton lines={4} />
          ) : shown.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-muted">
              {domain ? (
                <>
                  <b>{domain}</b>으로 태그된 관찰이 없습니다.{" "}
                  <button
                    className="font-bold underline"
                    onClick={() => setDomain(null)}
                  >
                    전체 보기
                  </button>
                </>
              ) : (
                <>
                  아직 관찰 기록이 없어요 — 하루 기록의 메모가 자동으로 쌓입니다.
                </>
              )}
            </div>
          ) : (
            <div className="tl">
              {shown.map((r) => (
                <div key={r.id} className="row">
                  <span className="date">{r.date.slice(5)}</span>{" "}
                  {r.tags.length ? (
                    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
                      {r.tags.map((t) => (
                        <span
                          key={t}
                          className={`tag ${r.manualTag ? "manual" : "dom"}`}
                        >
                          {t}
                        </span>
                      ))}
                      {r.manualTag && (
                        <span className="text-[11px] text-muted">✎</span>
                      )}
                    </span>
                  ) : (
                    <span className="tag daily">태그 없음</span>
                  )}{" "}
                  {r.memo}{" "}
                  <button
                    className="btn ghost px-2 py-0.5 text-xs"
                    onClick={() => openEdit(r)}
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
          <label>
            발달영역 (선택){" "}
            <span className="font-normal text-muted">
              — 여러 개 고를 수 있어요
            </span>
          </label>
          <div className="chiprow">
            {DEV_DOMAINS.map((d) => (
              <button
                key={d}
                className={`chip ${newTags.includes(d) ? "on" : ""}`}
                onClick={() => toggle(newTags, setNewTags, d)}
                aria-pressed={newTags.includes(d)}
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
          「{editTarget?.memo}」<br />이 메모의 발달영역을 직접 지정합니다.{" "}
          <b>여러 개 고를 수 있어요</b> — 놀이 하나가 여러 영역에 걸치는 경우가
          많습니다. 수동 태그는 자동 태깅이 덮어쓰지 않습니다.
        </div>
        <div className="chiprow mt-4">
          {DEV_DOMAINS.map((d) => (
            <button
              key={d}
              className={`chip ${editTags.includes(d) ? "on" : ""}`}
              onClick={() => toggle(editTags, setEditTags, d)}
              aria-pressed={editTags.includes(d)}
              disabled={tagMutation.isPending}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-muted">
          {editTags.length
            ? `선택: ${editTags.join(" · ")}`
            : "선택한 영역이 없습니다 — 이대로 저장하면 태그가 지워집니다."}
        </p>
        <div className="btnrow mt-4">
          <button
            className="btn primary"
            onClick={applyTags}
            disabled={tagMutation.isPending}
          >
            {tagMutation.isPending ? "저장 중…" : "저장"}
          </button>
          <button className="btn" onClick={() => setEditTarget(null)}>
            취소
          </button>
        </div>
      </Modal>
    </>
  );
}
