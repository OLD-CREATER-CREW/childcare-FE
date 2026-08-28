"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, X } from "lucide-react";
import { useRegenerateBlock } from "@/lib/queries";
import { useApp } from "@/lib/store";
import {
  applyRegenerated,
  parse,
  planBlockBudget,
  planBlockLabel,
  planBlockLength,
  serialize,
} from "@/lib/blocks/plan";
import type { PlanBlock } from "@/lib/blocks/plan";
import { Notice } from "@/components/ui";
import type { DocType } from "@/lib/types";

/**
 * 계획안 블록 편집 (SCR-007).
 *
 * ■ 왜 나누나
 * 초안은 놀이 다섯 개가 `⋅`로 이어진 200자 한 줄로 온다. 하나를 바꾸려면 교사가
 * 그 구절을 찾아 지우고 **머리표를 살려서** 고쳐 써야 하고, 하나를 빼면 앞뒤
 * 공백이 남는다. 서식이 이미 칸과 머리표를 정해 두었으니 나눠 담기만 하면
 * 그 일이 사라진다.
 *
 * ■ 블록은 서식의 칸이다
 * 월간은 주차(1~4주), 주간은 일과 여덟 개와 주간 놀이. 완성 한글 파일의 칸과
 * 1:1이라 화면에서 고친 것이 그 칸에 그대로 들어간다. 놀이 낱개를 카드로
 * 만들면 월간이 28장이 되고 어느 주의 놀이인지가 흩어진다.
 *
 * ■ 「다시 생성」은 블록 단위다(EP-055)
 * 3주 하나가 아쉬워 전체를 다시 돌리면 손대지 않은 1·2·4주의 문장까지 달라진다.
 * 서버는 그 칸만 새로 써서 **저장하지 않고** 텍스트로 돌려주고, 반영은 여기서
 * 한다 — 교사가 새 문안을 보고 무를 수 있어야 한다.
 *
 * ■ 모양이 어긋나면 통짜로 돌아간다
 * 모델이 쓰는 글이라 칸 이름이 빠질 때가 있다. 그때 화면을 비우면 초안은 멀쩡한
 * 데 보여 주지 못하는 셈이라, 평문 편집기로 떨어뜨리고 그 사실을 밝힌다.
 */
export function PlanBlocks({
  type,
  documentId,
  working,
  setWorking,
}: {
  type: DocType;
  /** EP-055가 "이 문서의 이 칸"을 가리키려면 필요하다. */
  documentId: number;
  working: string;
  setWorking: (next: string) => void;
}) {
  const { toast } = useApp();
  const regenMutation = useRegenerateBlock();

  const parsed = useMemo(() => parse(working, type), [working, type]);

  /**
   * 편집 중인 블록. 자동 저장이 오가는 동안 `working`이 다시 흘러들어와도
   * 타이핑이 덮이지 않도록 화면이 들고 있는다.
   *
   * 다만 **밖에서 글이 통째로 바뀌면 다시 읽어야 한다** — 「다시 생성」으로 초안을
   * 새로 받으면 문서 번호는 그대로인데 내용이 전부 달라진다. 그때 옛 블록을 들고
   * 있으면 화면이 지난 초안을 보여 주고, 교사가 한 글자만 고쳐도 그 옛 글이
   * 새 초안을 덮어쓴다.
   *
   * 그래서 **우리가 마지막으로 내보낸 글**을 기억해 두고, 들어온 글이 그것과
   * 다르면 밖에서 바뀐 것으로 보고 다시 나눈다.
   */
  const [blocks, setBlocks] = useState<PlanBlock[] | null>(null);
  const mine = useRef<string | null>(null);

  useEffect(() => {
    if (working === mine.current) return;
    mine.current = working;
    setBlocks(parsed.ok ? parsed.blocks : null);
  }, [working, parsed]);

  /** 처음 한 번은 파싱 결과를 그대로 쓴다(위 effect가 돌기 전 렌더). */
  const current = blocks ?? (parsed.ok ? parsed.blocks : null);

  const commit = (next: PlanBlock[]) => {
    const text = serialize(next);
    // 내가 낸 글이라고 표시해 둔다 — 위 effect가 이걸 보고 되읽지 않는다.
    mine.current = text;
    setBlocks(next);
    setWorking(text);
  };

  const patch = (index: number, changed: PlanBlock) =>
    commit(current!.map((b, i) => (i === index ? changed : b)));

  const [regenIndex, setRegenIndex] = useState<number | null>(null);
  const regenerate = (index: number) => {
    const block = current![index];
    setRegenIndex(index);
    regenMutation.mutate(
      { documentId, blockLabel: planBlockLabel(block) },
      {
        onSuccess: (text) => {
          patch(index, applyRegenerated(block, text));
          toast(`${block.label} 칸을 다시 만들었습니다`);
        },
        onSettled: () => setRegenIndex(null),
      },
    );
  };

  if (!current) {
    return (
      <div className="stack">
        <Notice kind="warn">
          이 초안은 서식이 정한 칸 모양이 아니라 <b>칸별로 나누지 못했습니다</b> —
          아래에서 통째로 고쳐 주세요. 「다시 생성」으로 새 초안을 받으면 대개
          나뉩니다.
        </Notice>
        <div className="draftbox">
          <textarea
            value={working}
            onChange={(e) => setWorking(e.target.value)}
            rows={Math.max(6, Math.ceil(working.length / 60))}
            className="w-full resize-y border-0 bg-transparent text-[15px] leading-[1.9] [font-family:inherit] focus:outline-none"
            aria-label="초안 편집"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="text-[12.5px] text-muted">
        칸마다 따로 고치고 따로 다시 만듭니다 — 손대지 않은 칸은 그대로 남습니다.
      </div>

      {current.map((block, i) => (
        <BlockCard
          key={block.key}
          block={block}
          busy={regenIndex === i && regenMutation.isPending}
          onChange={(next) => patch(i, next)}
          onRegenerate={() => regenerate(i)}
        />
      ))}
    </div>
  );
}

/** 블록 하나 — 이름·분량·다시 생성 + 그 칸에 맞는 편집기. */
function BlockCard({
  block,
  busy,
  onChange,
  onRegenerate,
}: {
  block: PlanBlock;
  busy: boolean;
  onChange: (next: PlanBlock) => void;
  onRegenerate: () => void;
}) {
  const chars = planBlockLength(block);
  const budget = planBlockBudget(block);
  const over = chars > budget * 1.2;

  return (
    <div className="card !p-[13px_15px]">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[13.5px] font-bold text-ink">{block.label}</span>
        {block.kind === "routine" && (
          <span className="font-mono text-[11px] text-faint">{block.name}</span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {/*
            분량 게이지. 서식 칸이 135자인데 300자를 쓰면 완성 문서에서 표가
            밀린다 — 지금은 넘겨도 알 방법이 없었다.
          */}
          <span
            className="h-[6px] w-[64px] overflow-hidden rounded-full bg-line-soft"
            title={`서식 칸 기준 ${budget}자`}
          >
            <span
              className={`block h-full rounded-full ${over ? "bg-warn" : "bg-green"}`}
              style={{ width: `${Math.min(100, (chars / budget) * 100)}%` }}
            />
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted">
            {chars} / {budget}자
          </span>
          <button
            className="btn px-2 py-0.5 text-[11.5px]"
            onClick={onRegenerate}
            disabled={busy}
            title="이 칸만 새로 만듭니다 — 다른 칸은 그대로입니다"
          >
            <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
            {busy ? "만드는 중…" : "다시 생성"}
          </button>
        </span>
      </div>

      {block.kind === "line" && (
        <input
          className="input w-full"
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          aria-label={`${block.label} 칸`}
        />
      )}

      {block.kind === "text" && (
        <div className="draftbox">
          <textarea
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            rows={Math.max(2, Math.ceil(block.text.length / 45))}
            className="w-full resize-y border-0 bg-transparent text-[14px] leading-[1.85] [font-family:inherit] focus:outline-none"
            aria-label={`${block.label} 칸`}
          />
        </div>
      )}

      {block.kind === "week" && (
        <input
          className="input mb-2 w-full font-bold text-green-deep"
          value={block.subtopic}
          onChange={(e) => onChange({ ...block, subtopic: e.target.value })}
          placeholder="이 주의 소주제"
          aria-label={`${block.no}주 소주제`}
        />
      )}

      {block.kind !== "line" && block.kind !== "text" && (
        <ItemRows
          items={block.items}
          noun={block.kind === "list" ? block.noun : "놀이"}
          onChange={(items) => onChange({ ...block, items })}
        />
      )}
    </div>
  );
}

/** `⋅` 항목들 — 줄 단위로 고치고, 지우고, 더한다. */
function ItemRows({
  items,
  noun,
  onChange,
}: {
  items: string[];
  noun: string;
  onChange: (next: string[]) => void;
}) {
  const addedRef = useRef<HTMLInputElement | null>(null);
  const [focusLast, setFocusLast] = useState(false);

  useEffect(() => {
    if (!focusLast) return;
    addedRef.current?.focus();
    setFocusLast(false);
  }, [focusLast]);

  const set = (i: number, value: string) =>
    onChange(items.map((t, k) => (k === i ? value : t)));

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        // key를 자리로 잡는다 — 내용으로 잡으면 글자를 고칠 때마다 입력창이
        // 새로 붙어 커서가 튄다.
        <div key={i} className="flex items-center gap-1.5">
          <span className="flex-none text-[15px] leading-none text-green">
            ⋅
          </span>
          <input
            ref={i === items.length - 1 ? addedRef : undefined}
            className="input min-w-0 flex-1 py-1.5 text-[13px]"
            value={item}
            onChange={(e) => set(i, e.target.value)}
            aria-label={`${noun} ${i + 1}`}
          />
          <button
            className="flex-none rounded-md px-1.5 py-1 text-muted hover:bg-paper hover:text-warn"
            onClick={() => onChange(items.filter((_, k) => k !== i))}
            title="이 줄 지우기"
            aria-label={`${noun} ${i + 1} 지우기`}
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        className="btn ghost mt-0.5 self-start px-2.5 py-1 text-[12px]"
        onClick={() => {
          onChange([...items, ""]);
          setFocusLast(true);
        }}
      >
        <Plus size={12} />
        {noun} 추가
      </button>
    </div>
  );
}
