"use client";

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
