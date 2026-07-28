"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useApp } from "@/lib/store";

/** 명세 주석 — 요소 번호 (스토리보드 목업의 ①②…) */
export function N({ n }: { n: number }) {
  return <span className="n">{n}</span>;
}

/** 명세 바 — SCR·FN·EP 매핑 칩 (body.annot일 때만 표시) */
export function SpecBar({
  scr,
  fn = [],
  ep = [],
}: {
  scr: string;
  fn?: string[];
  ep?: string[];
}) {
  return (
    <div className="specbar">
      <span className="spec-chip scr">{scr}</span>
      {fn.map((f) => (
        <span key={f} className="spec-chip fn">
          {f}
        </span>
      ))}
      {ep.map((e) => (
        <span key={e} className="spec-chip">
          {e}
        </span>
      ))}
    </div>
  );
}

export function PageHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="pagehead">
      <h1>{title}</h1>
      {sub && <span className="sub">{sub}</span>}
      {right && <div className="right">{right}</div>}
    </div>
  );
}

export function Notice({
  kind,
  children,
}: {
  kind: "warn" | "info" | "soft";
  children: React.ReactNode;
}) {
  return <div className={`notice ${kind}`}>{children}</div>;
}

export function Toast() {
  const { toastMsg, toastShow } = useApp();
  return (
    <div className={`statusbar ${toastShow ? "show" : ""}`} role="status">
      {toastMsg}
    </div>
  );
}

/** 로딩 스켈레톤 — TanStack Query isLoading 상태용 */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2.5 py-1" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skel" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

/** 쿼리 에러 표시 — 재시도 버튼 포함 */
export function QueryError({ onRetry }: { onRetry?: () => void }) {
  return (
    <Notice kind="warn">
      ⚠{" "}
      <span>
        데이터를 불러오지 못했습니다.
        {onRetry && (
          <button className="btn ml-2 px-3 py-1 text-xs" onClick={onRetry}>
            다시 시도
          </button>
        )}
      </span>
    </Notice>
  );
}

/** 아동 아바타 — 이름 끝 글자 + 지정 색 */
export function Avatar({
  name,
  color,
  size,
}: {
  name: string;
  color: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={`avatar ${size ?? ""}`}
      style={{ background: color }}
      aria-hidden
    >
      {name.slice(-2, -1) || name.slice(0, 1)}
    </span>
  );
}

/** 진행률 바 */
export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-5 py-10 text-center">
      <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-paper text-[22px]">
        {icon}
      </div>
      <div className="text-[14.5px] font-bold">{title}</div>
      {desc && (
        <div className="max-w-[42ch] text-[13px] text-muted">{desc}</div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * 확인 모달 — window.confirm 대체.
 * open이 truthy일 때 표시하며 AnimatePresence로 부드럽게 등장·퇴장.
 */
export function ConfirmDialog({
  open,
  title,
  desc,
  confirmLabel = "확인",
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  desc: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            role="alertdialog"
            aria-modal
            aria-label={title}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{title}</h3>
            <div className="desc">{desc}</div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn ghost" onClick={onClose}>
                취소
              </button>
              <button
                className={`btn ${danger ? "danger" : "primary"}`}
                onClick={onConfirm}
                disabled={pending}
                autoFocus
              >
                {pending ? "처리 중…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 범용 모달 — 콘텐츠 자유형 (사진 수동 지정 등) */
export function Modal({
  open,
  label,
  children,
  onClose,
  wide = false,
}: {
  open: boolean;
  label: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            style={wide ? { maxWidth: 560 } : undefined}
            role="dialog"
            aria-modal
            aria-label={label}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 등장 모션 래퍼 — 리스트·카드의 미세한 페이드업 */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * 톤앤매너 통일 드롭다운 — OS 기본 `<select>` 대신 앱 디자인 토큰으로 그린다.
 * 트리거는 `.input`과 동일한 테두리·라운드·포커스 링을 쓰고, 목록은 카드 톤의
 * 팝오버(초록 강조·체크)로 뜬다. 키보드(↑↓·Enter·Esc)와 바깥 클릭 닫기를 지원한다.
 *
 * width는 wrapper의 className으로 제어한다(미지정 시 w-full, `w-auto`·`w-[150px]` 등 가능).
 */
export type SelectOption = { value: string; label: string };

export function Select({
  value,
  onChange,
  options,
  className,
  ariaLabel,
  placeholder = "선택",
}: {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const opts: SelectOption[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const selected = opts.find((o) => o.value === value);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 열릴 때 활성 항목을 현재 선택값으로 맞춘다
  useEffect(() => {
    if (open) setActive(opts.findIndex((o) => o.value === value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + dir + opts.length) % opts.length);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) setOpen(true);
      else if (active >= 0) choose(opts[active].value);
    }
  };

  return (
    <div className={`relative ${className ?? "w-full"}`} ref={ref}>
      <button
        type="button"
        className="input flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "truncate" : "truncate text-faint"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`flex-none text-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-30 mt-1.5 max-h-[248px] w-full min-w-max overflow-y-auto rounded-[10px] border border-line-strong bg-surface p-1"
            style={{ boxShadow: "var(--shadow-lift)" }}
          >
            {opts.map((o, i) => {
              const on = o.value === value;
              const isActive = i === active;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                      on
                        ? "bg-green-soft font-bold text-green-deep"
                        : isActive
                          ? "bg-green-ghost"
                          : "text-ink"
                    }`}
                  >
                    <span className="whitespace-nowrap">{o.label}</span>
                    {on && <Check size={14} className="flex-none text-green" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
