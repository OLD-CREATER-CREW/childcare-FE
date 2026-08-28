"use client";

/**
 * 놀이이야기 블록 편집기 — 목록 + 상세 (SCR-018).
 *
 * ■ 왜 블록인가
 * 초안은 줄글 한 덩어리로 오지만 이미 규칙적이다(`lib/blocks/playStory.ts`).
 * 나눠 담으면 수정·사진 고르기·다시 생성이 전부 **놀이 단위**가 된다.
 *
 * ■ 왜 목록 + 상세인가
 * 한 놀이를 손볼 때 다른 놀이가 시야에서 빠져 집중이 쉽고, 사진 서랍을 열어도
 * 화면이 밀리지 않는다. 원천 기록 패널을 없애 좌우를 넓게 쓴다 — 어떤 기록에서
 * 나왔는지는 소주제에 붙은 날짜가 이미 말해 준다.
 *
 * ■ 지키는 것
 *   · **확정한 블록은 다시 생성이 건드리지 않는다.** 한 블록이 아쉬워 전체를
 *     돌렸다가 공들여 고친 것을 잃지 않게 한다. `draft`를 덮어쓰지 않는다는
 *     이 저장소의 원칙과 같은 자리다.
 *   · **칸 하나만 다시 만들면 그 칸만 바뀐다**(EP-055). 서버가 저장하지 않고
 *     텍스트만 주므로, 반영은 여기서 하고 작업본으로 저장한다.
 *   · **사진 없는 블록을 확정할 때 한 번 묻는다.** 막지는 않는다 — 나중에 찍을
 *     수도 있다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Images,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { useRegenerateBlock } from "@/lib/queries";
import {
  BLOCK_BUDGET,
  blockLabel,
  blockLength,
  parseRegenerated,
} from "@/lib/blocks/playStory";
import type { PlayBlock } from "@/lib/blocks/playStory";
import type { MonthActivity } from "@/lib/api";
import type { FolderPhoto } from "@/lib/face";
import { Notice } from "@/components/ui";
import { shortDate } from "@/components/play-story/PlayPicker";

/** 블록 하나에 고른 사진들. 키는 `blockLabel(block)`. */
export type BlockPhotos = Record<string, string[]>;

const ALL_DATES = "__all__";

export function PlayBlockEditor({
  documentId,
  blocks,
  onBlocksChange,
  confirmed,
  onConfirmedChange,
  photos,
  blockPhotos,
  onBlockPhotosChange,
  activities,
  disabled,
}: {
  documentId: number;
  blocks: PlayBlock[];
  onBlocksChange: (next: PlayBlock[]) => void;
  /** 확정한 블록 라벨 집합 */
  confirmed: string[];
  onConfirmedChange: (next: string[]) => void;
  /** 사진 폴더에서 읽은 사진 전부 */
  photos: FolderPhoto[];
  blockPhotos: BlockPhotos;
  onBlockPhotosChange: (next: BlockPhotos) => void;
  /** 「다른 놀이로 바꿔서 다시」용 목록 */
  activities: MonthActivity[];
  disabled?: boolean;
}) {
  const { toast } = useApp();
  const regen = useRegenerateBlock();

  const [active, setActive] = useState(0);
  /** 사진 없이 확정하려 할 때 한 번 뜨는 확인 */
  const [askPhoto, setAskPhoto] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDate, setDrawerDate] = useState<string>("");
  const [sortByPeople, setSortByPeople] = useState(true);
  /** 어느 블록을 다시 만드는 중인지 — 버튼만 잠근다 */
  const [regenLabel, setRegenLabel] = useState<string | null>(null);
  const [swapTo, setSwapTo] = useState<string>("");

  // 블록 수가 줄면(다시 생성 등) 고른 자리가 범위를 벗어난다.
  useEffect(() => {
    if (active >= blocks.length) setActive(Math.max(0, blocks.length - 1));
  }, [blocks.length, active]);

  const block = blocks[active];
  const label = block ? blockLabel(block) : "";
  const isConfirmed = confirmed.includes(label);
  const picked = blockPhotos[label] ?? [];

  // 블록을 옮기면 서랍 상태를 그 블록 기준으로 되돌린다.
  const activeKeyRef = useRef(label);
  useEffect(() => {
    if (activeKeyRef.current === label) return;
    activeKeyRef.current = label;
    setAskPhoto(false);
    setDrawerOpen(false);
    setSwapTo("");
    setDrawerDate("");
  }, [label]);

  /** 이 블록의 날짜(`8/19`)를 사진 날짜(`2026-08-19`)로 맞춘다. */
  const blockDateIso = useMemo(() => {
    if (!block || block.kind !== "play" || !block.date) return "";
    const [m, d] = block.date.split("/").map(Number);
    const hit = photos.find((p) => {
      const [, pm, pd] = p.date.split("-").map(Number);
      return pm === m && pd === d;
    });
    return hit?.date ?? "";
  }, [block, photos]);

  const effectiveDate = drawerDate || blockDateIso || ALL_DATES;

  const dateOptions = useMemo(() => {
    const days = Array.from(new Set(photos.map((p) => p.date))).sort();
    return days.map((d) => ({
      value: d,
      label: `${shortDate(d)}${d === blockDateIso ? " (이 놀이의 날짜)" : ""}`,
    }));
  }, [photos, blockDateIso]);

  /**
   * 서랍에 보여 줄 사진.
   *
   * 여러 명이 나온 사진을 위로 올린다 — 소식지에 쓰기 좋고, 그 값은 얼굴을
   * 다시 보지 않고도 안다(`countChildrenPerPhoto`). 같은 인원수면 파일 이름순
   * 이어야 호출마다 순서가 흔들리지 않는다.
   */
  const drawerPhotos = useMemo(() => {
    const list = photos.filter(
      (p) => effectiveDate === ALL_DATES || p.date === effectiveDate,
    );
    return list.slice().sort((a, b) => {
      if (sortByPeople && b.childCount !== a.childCount) {
        return b.childCount - a.childCount;
      }
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }, [photos, effectiveDate, sortByPeople]);

  const patch = (next: Partial<PlayBlock>) => {
    if (!block) return;
    onBlocksChange(
      blocks.map((b, i) => (i === active ? ({ ...b, ...next } as PlayBlock) : b)),
    );
  };

  const togglePhoto = (id: string) => {
    const next = picked.includes(id)
      ? picked.filter((x) => x !== id)
      : picked.concat(id);
    onBlockPhotosChange({ ...blockPhotos, [label]: next });
  };

  const confirm = () => {
    if (!block) return;
    // 사진 없는 블록은 소식지에서 빈 칸이 된다. 막지는 않되 한 번 알린다.
    if (block.kind === "play" && picked.length === 0 && !askPhoto) {
      setAskPhoto(true);
      return;
    }
    setAskPhoto(false);
    onConfirmedChange(confirmed.concat(label));
  };

  const runRegen = (activity?: string) => {
    if (!block) return;
    setRegenLabel(label);
    regen.mutate(
      {
        documentId,
        blockLabel: label,
        activity,
        // 날짜를 지정한 소주제는 그 날짜를 유지한다 — 다른 날의 같은 놀이로
        // 바뀌면 이미 고른 사진과 어긋난다.
        date: block.kind === "play" && blockDateIso ? blockDateIso : undefined,
      },
      {
        onSuccess: (text) => {
          const next = parseRegenerated(block, text);
          if (!next) {
            toast("새 문안을 알아보지 못했습니다. 다시 시도해 주세요.");
            return;
          }
          onBlocksChange(blocks.map((b, i) => (i === active ? next : b)));
          toast(`${label} — 다시 만들었습니다`);
        },
        onError: (e) =>
          toast(e instanceof Error ? e.message : "다시 만들지 못했습니다."),
        onSettled: () => setRegenLabel(null),
      },
    );
  };

  if (!block) {
    return (
      <Notice kind="warn">
        <span>블록이 없습니다. 초안을 다시 만들어 주세요.</span>
      </Notice>
    );
  }

  const budget = BLOCK_BUDGET[block.kind];
  const used = blockLength(block);
  const over = used > budget;

  return (
    <div className="grid items-start gap-3.5 [grid-template-columns:minmax(200px,240px)_1fr] max-[900px]:grid-cols-1">
      {/* ---------------- 왼쪽 목록 ---------------- */}
      <div className="flex flex-col gap-1.5">
        {blocks.map((b, i) => {
          const l = blockLabel(b);
          const done = confirmed.includes(l);
          const n = (blockPhotos[l] ?? []).length;
          return (
            <button
              key={l}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[10px] border px-2.5 py-2 text-left ${
                i === active ? "border-green bg-green-soft" : "border-line bg-surface"
              }`}
              onClick={() => setActive(i)}
            >
              <span
                className={`grid h-5 min-w-[20px] place-items-center rounded-md px-1.5 text-[10px] font-bold ${
                  i === active ? "bg-green text-white" : "bg-paper text-muted"
                }`}
              >
                {b.kind === "play" ? b.index : b.label.slice(0, 2)}
              </span>
              <span className="text-[12.5px] font-semibold leading-snug">
                {b.kind === "play" ? b.title || "제목 없음" : b.label}
                {b.kind === "play" && (
                  <>
                    <br />
                    <span className="font-mono text-[11px] font-normal text-muted">
                      {b.date || "날짜 없음"} · 사진 {n}
                    </span>
                  </>
                )}
              </span>
              <span className="text-[13px]">
                {done ? (
                  <Lock size={13} className="text-confirm" />
                ) : (
                  <Pencil size={13} className="text-muted" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------------- 오른쪽 상세 ---------------- */}
      <div
        className={`overflow-hidden rounded-xl border bg-surface ${
          isConfirmed ? "border-[#b9e0c7]" : "border-line"
        }`}
      >
        <div
          className={`flex flex-wrap items-center gap-2 border-b px-3.5 py-2.5 ${
            isConfirmed
              ? "border-[#b9e0c7] bg-confirm-soft"
              : "border-line bg-paper"
          }`}
        >
          <span
            className={`grid h-[22px] min-w-[22px] place-items-center rounded-[7px] px-1.5 text-[11px] font-bold ${
              isConfirmed ? "bg-confirm text-white" : "bg-green-soft text-green-deep"
            }`}
          >
            {block.kind === "play" ? block.index : block.label.slice(0, 2)}
          </span>
          <span className="text-[13.5px] font-bold">
            {block.kind === "play" ? block.title || "제목 없음" : block.label}
          </span>
          {block.kind === "play" && block.date && (
            <span className="font-mono text-[11.5px] text-muted">{block.date}</span>
          )}
          <span className={isConfirmed ? "badge-final" : "badge-ai"}>
            {isConfirmed ? "확정됨" : "AI 초안"}
          </span>

          <span className="ml-auto flex flex-wrap gap-1.5">
            {block.kind === "play" && (
              <button
                className="btn px-2.5 py-1 text-[12px]"
                onClick={() => setDrawerOpen((v) => !v)}
              >
                <Images size={13} /> 사진 {picked.length}장{" "}
                {drawerOpen ? "▲" : "▼"}
              </button>
            )}
            {isConfirmed ? (
              <button
                className="btn ghost px-2.5 py-1 text-[12px]"
                onClick={() =>
                  onConfirmedChange(confirmed.filter((x) => x !== label))
                }
              >
                수정
              </button>
            ) : (
              <button
                className="btn primary px-2.5 py-1 text-[12px]"
                onClick={confirm}
                disabled={disabled}
              >
                <CheckCircle2 size={13} /> 확정
              </button>
            )}
          </span>
        </div>

        <div className="flex flex-col gap-2.5 p-3.5">
          {block.kind === "play" ? (
            <>
              <Field label="제목">
                <input
                  className="input"
                  value={block.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  disabled={isConfirmed}
                />
              </Field>
              <Field label="놀이 이야기">
                <textarea
                  className="input min-h-[84px]"
                  rows={3}
                  value={block.story}
                  onChange={(e) => patch({ story: e.target.value })}
                  disabled={isConfirmed}
                />
              </Field>
              <Field label="말풍선 문구">
                <input
                  className="input"
                  value={block.quote}
                  onChange={(e) => patch({ quote: e.target.value })}
                  disabled={isConfirmed}
                />
              </Field>
              <Field label="추천 사진 가이드">
                <textarea
                  className="input min-h-[60px]"
                  rows={2}
                  value={block.guide}
                  onChange={(e) => patch({ guide: e.target.value })}
                  disabled={isConfirmed}
                />
              </Field>
            </>
          ) : (
            <textarea
              className={`input ${block.kind === "topic" ? "min-h-[46px]" : "min-h-[150px]"}`}
              rows={block.kind === "topic" ? 1 : 6}
              value={block.text}
              onChange={(e) => patch({ text: e.target.value })}
              disabled={isConfirmed}
            />
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 분량 — 서식 칸에 안 들어가면 교사가 잘라내야 한다. 확정한 뒤에
                알게 되지 않도록 고치는 동안 보여 준다. */}
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${
                over
                  ? "border-[#e9c4bd] bg-coral-soft text-coral"
                  : "border-[#cfe0ef] bg-blue-soft text-blue"
              }`}
            >
              {used} / {budget}자{over ? " · 넘침" : ""}
            </span>
            {block.kind === "play" && (
              <span className="text-[12px] text-muted">
                말풍선은 AI 제안입니다 — 아이가 실제로 한 말로 바꿔 주세요.
              </span>
            )}
          </div>

          {askPhoto && (
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-amber-line bg-amber-bg px-3 py-2.5 text-[12.5px] text-amber">
              <AlertTriangle size={14} />
              <span>
                <b>사진을 한 장도 고르지 않았습니다.</b> 소식지에서 사진 칸이 비게
                됩니다. 이대로 확정할까요?
              </span>
              <span className="ml-auto flex gap-1.5">
                <button
                  className="btn px-2.5 py-1 text-[12px]"
                  onClick={() => {
                    setAskPhoto(false);
                    setDrawerOpen(true);
                  }}
                >
                  사진 고르기
                </button>
                <button
                  className="btn primary px-2.5 py-1 text-[12px]"
                  onClick={confirm}
                >
                  그대로 확정
                </button>
              </span>
            </div>
          )}

          {/* 이 블록만 다시 생성 — 확정한 블록에는 띄우지 않는다 */}
          {!isConfirmed && (
            <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-line-strong pt-2.5 text-[12.5px]">
              <span className="text-muted">이 블록만 다시 생성</span>
              {block.kind === "play" && activities.length > 0 && (
                <select
                  className="rounded-lg border border-line-strong bg-surface px-2 py-1 text-[12.5px] text-ink"
                  value={swapTo}
                  onChange={(e) => setSwapTo(e.target.value)}
                  aria-label="다른 놀이로 바꾸기"
                >
                  <option value="">지금 놀이 그대로</option>
                  {activities.map((a) => (
                    <option key={a.activity} value={a.activity}>
                      {a.activity}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="btn px-2.5 py-1 text-[12px]"
                onClick={() => runRegen(swapTo || undefined)}
                disabled={disabled || regenLabel !== null}
              >
                {regenLabel === label ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> 만드는 중…
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} /> 다시 만들기
                  </>
                )}
              </button>
              <span className="text-muted">다른 블록은 그대로 둡니다</span>
            </div>
          )}
        </div>

        {/* ---------------- 사진 서랍 ---------------- */}
        {block.kind === "play" && drawerOpen && (
          <div className="border-t border-dashed border-line-strong bg-paper">
            <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5 text-[12.5px]">
              <span className="font-semibold">사진 고르기</span>
              <span className="text-muted">날짜</span>
              <select
                className="rounded-lg border border-line-strong bg-surface px-2 py-1 text-[12.5px] text-ink"
                value={effectiveDate}
                onChange={(e) => setDrawerDate(e.target.value)}
                aria-label="사진 날짜"
              >
                {dateOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value={ALL_DATES}>전체 기간</option>
              </select>
              <label className="inline-flex items-center gap-1.5 text-muted">
                <input
                  type="checkbox"
                  checked={sortByPeople}
                  onChange={(e) => setSortByPeople(e.target.checked)}
                />
                아이가 많이 나온 순
              </label>
              <span className="ml-auto text-muted">
                <b className="text-ink">{picked.length}</b>장 선택 ·{" "}
                <button
                  className="underline"
                  onClick={() => setDrawerOpen(false)}
                >
                  접기 ▲
                </button>
              </span>
            </div>

            <div className="px-3.5 pb-3.5">
              {drawerPhotos.length === 0 ? (
                <p className="m-0 py-2 text-[12.5px] text-muted">
                  이 날짜에 사진이 없습니다. 날짜를 <b>전체 기간</b>으로 바꿔
                  보세요 — 촬영일이 어긋난 사진일 수 있습니다.
                </p>
              ) : (
                <div className="photogrid">
                  {drawerPhotos.map((p) => {
                    const on = picked.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        className={`photo ${on ? "sel" : ""}`}
                        onClick={() => togglePhoto(p.id)}
                        title={`${p.childName || "미분류"} / ${p.name} · ${p.childCount}명`}
                      >
                        {/* 로컬 objectURL 이라 next/image 최적화 대상이 아니다 */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.name}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-[rgba(31,42,33,0.72)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                          👤{p.childCount}
                        </span>
                        {on && <span className="ck">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                왼쪽 위 숫자는 <b>그 사진에 몇 명이 담겼는지</b>입니다 — 사진함
                내보내기가 아이마다 폴더를 만들어 같은 파일을 넣으므로, 같은 파일이
                몇 개 폴더에 있는지를 세면 알 수 있습니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-start gap-2.5 [grid-template-columns:104px_1fr] max-[720px]:grid-cols-1">
      <span className="pt-2 text-[12px] font-bold text-muted">{label}</span>
      {children}
    </div>
  );
}
