"use client";

/**
 * 이 달의 놀이 고르개 (SCR-018 상단).
 *
 * ■ 무엇을 바꿨나
 * 예전에는 **주관식 한 줄**로 주제를 받았다. 교사가 한 달 치 기록을 머릿속으로
 * 되짚어야 했고, 실제로 한 놀이와 어긋난 주제를 적어도 앱이 알 길이 없었다.
 * 하루 기록에 활동 태그가 이미 쌓여 있으므로 그것을 보여 주고 고르게 한다.
 *
 * ■ 두 방식을 한 목록에 쌓는다
 *   간단히  놀이만 고른다 → 어느 날을 대표로 쓸지는 모델이 기록에서 고른다
 *   직접    달력에서 (날짜 + 활동)을 집는다 → 그 날짜가 소주제 날짜가 된다
 *
 * 둘을 **섞어 쓸 수 있다.** "물놀이는 그날, 나머지는 알아서"가 실제로 흔한
 * 요구라서다. 그래서 고른 것을 방식별로 나누지 않고 한 목록(`picks`)에 쌓는다 —
 * 나누면 교사가 "지금 어느 쪽이 반영되지?"를 계속 따져야 한다.
 *
 * ■ 아무것도 고르지 않아도 된다
 * 이 화면은 교사가 원할 때 개입하는 자리이지 반드시 거쳐야 하는 관문이 아니다.
 * 비워 두면 서버가 도입 이전과 똑같이 동작한다.
 */

import { useMemo, useState } from "react";
import { CalendarDays, ListChecks, Sparkles } from "lucide-react";
import type { MonthActivity, PlayPick } from "@/lib/api";
import { Skeleton } from "@/components/ui";

type Mode = "auto" | "manual";

/** 고를 수 있는 소주제 개수 — 서식이 말하는 3~6개 범위다. */
const COUNT_OPTIONS = [3, 4, 5, 6];

const sameDate = (a?: string, b?: string) => (a ?? "") === (b ?? "");

export function isSamePick(a: PlayPick, b: PlayPick): boolean {
  return a.activity === b.activity && sameDate(a.date, b.date);
}

/** `2026-08-19` → `8/19`. 화면은 짧게, 서버에는 온전한 날짜를 보낸다. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : iso;
}

export function PlayPicker({
  activities,
  loading,
  picks,
  onPicksChange,
  playCount,
  onPlayCountChange,
  periodLabel,
  disabled,
}: {
  activities: MonthActivity[];
  loading: boolean;
  picks: PlayPick[];
  onPicksChange: (next: PlayPick[]) => void;
  playCount: number;
  onPlayCountChange: (next: number) => void;
  periodLabel: string;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("auto");

  const toggle = (pick: PlayPick) => {
    const at = picks.findIndex((p) => isSamePick(p, pick));
    onPicksChange(
      at >= 0 ? picks.filter((_, i) => i !== at) : picks.concat(pick),
    );
  };
  const has = (pick: PlayPick) => picks.some((p) => isSamePick(p, pick));

  /** 목록 정렬은 서버가 이미 「며칠 했는가」 순으로 준다 — 다시 정렬하지 않는다. */
  const maxDays = useMemo(
    () => activities.reduce((m, a) => Math.max(m, a.days), 1),
    [activities],
  );

  /** 달력에 꽂을 자료: 날짜 → 그날 한 활동 이름들. */
  const byDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of activities) {
      for (const d of a.dates) {
        const list = map.get(d);
        if (list) list.push(a.activity);
        else map.set(d, [a.activity]);
      }
    }
    return map;
  }, [activities]);

  /** 기록이 있는 달을 그린다 — 없는 달을 띄우면 빈 격자만 보인다. */
  const month = useMemo(() => {
    const days = Array.from(byDate.keys()).sort();
    const anchor = days[0] ?? new Date().toISOString().slice(0, 10);
    const [y, m] = anchor.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0).getDate();
    return { year: y, month: m, lead: first.getDay(), last };
  }, [byDate]);

  const iso = (day: number) =>
    `${month.year}-${`${month.month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;

  return (
    <div className="card">
      <div className="mb-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3.5">
        <span className="text-[12.5px] font-bold text-muted">고르는 방법</span>
        <div className="seg">
          <button
            className={mode === "auto" ? "on" : ""}
            onClick={() => setMode("auto")}
          >
            <ListChecks size={14} className="mr-1.5 inline" />
            간단히 · 놀이만 고르기
          </button>
          <button
            className={mode === "manual" ? "on" : ""}
            onClick={() => setMode("manual")}
          >
            <CalendarDays size={14} className="mr-1.5 inline" />
            직접 · 날짜까지 정하기
          </button>
        </div>
        <span className="text-[12.5px] text-muted">
          {mode === "auto"
            ? "놀이만 고르면 어느 날을 대표로 쓸지는 AI가 정합니다"
            : "달력 칸의 활동 이름을 눌러 (날짜 + 활동)을 집습니다"}
        </span>
      </div>

      {loading ? (
        <Skeleton lines={6} />
      ) : activities.length === 0 ? (
        <p className="m-0 py-2 text-[13px] text-muted">
          {periodLabel}에 남긴 활동 기록이 없습니다. 하루 기록의 <b>활동</b>을 먼저
          채워 주세요 — 여기 목록은 그 태그를 모은 것입니다.
        </p>
      ) : mode === "auto" ? (
        <>
          <div className="mb-2.5 text-[12.5px] text-muted">
            많이 한 순서 · 날짜는 AI가 기록에서 고릅니다
          </div>
          <div className="flex flex-col gap-1">
            {activities.map((a) => {
              const on = has({ activity: a.activity });
              // 같은 놀이를 날짜까지 집어 둔 것이 있으면 알려 준다 — 두 방식이
              // 한 목록에 쌓이므로 모르면 같은 놀이를 두 번 넣게 된다.
              const pinned = picks.filter(
                (p) => p.activity === a.activity && p.date,
              ).length;
              return (
                <button
                  key={a.activity}
                  className={`grid grid-cols-[18px_1fr_120px_54px] items-center gap-3 rounded-[10px] border px-2.5 py-1.5 text-left ${
                    on
                      ? "border-green bg-green-soft"
                      : "border-transparent hover:bg-green-ghost"
                  }`}
                  onClick={() => toggle({ activity: a.activity })}
                  disabled={disabled}
                  aria-pressed={on}
                >
                  <span
                    className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] border-[1.5px] text-[11px] text-white ${
                      on ? "border-green bg-green" : "border-line-strong bg-surface"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span
                    className={`text-[13.5px] font-semibold ${on ? "text-green-deep" : ""}`}
                  >
                    {a.activity}
                    {pinned > 0 && (
                      <span className="ml-1.5 font-normal text-muted">
                        · 날짜 지정 {pinned}건
                      </span>
                    )}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-line">
                    <span
                      className={`block h-full rounded-full bg-green ${on ? "" : "opacity-55"}`}
                      style={{ width: `${Math.round((a.days / maxDays) * 100)}%` }}
                    />
                  </span>
                  <span className="text-right font-mono text-[11.5px] text-muted">
                    {a.days}일
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="mb-2.5 text-[12.5px] text-muted">
            칸 안의 <b>활동 이름을 눌러</b> 고릅니다 — 같은 날 여러 놀이 중 원하는
            것만 집을 수 있습니다
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <div
                key={d}
                className="pb-1 text-center text-[11px] font-bold text-muted"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: month.lead }, (_, i) => (
              <div key={`lead-${i}`} />
            ))}
            {Array.from({ length: month.last }, (_, i) => {
              const day = i + 1;
              const date = iso(day);
              const names = byDate.get(date) ?? [];
              const any = names.some((n) => has({ activity: n, date }));
              return (
                <div
                  key={date}
                  className={`flex min-h-[70px] flex-col gap-1 rounded-[9px] border p-1.5 ${
                    any
                      ? "border-green bg-green-soft"
                      : names.length
                        ? "border-line bg-green-ghost"
                        : "border-line bg-surface"
                  }`}
                >
                  <span className="font-mono text-[10.5px] text-faint">{day}</span>
                  {names.map((name) => {
                    const on = has({ activity: name, date });
                    return (
                      <button
                        key={name}
                        className={`w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[10px] font-semibold ${
                          on
                            ? "border-green bg-green text-white"
                            : "border-line bg-surface hover:border-green hover:bg-green-ghost"
                        }`}
                        onClick={() => toggle({ activity: name, date })}
                        disabled={disabled}
                        title={`${shortDate(date)} ${name}`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------- 공통 요약 ---------- */}
      <div className="mt-[18px] border-t border-line pt-4">
        <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[12.5px] font-bold text-muted">소주제 개수</span>
          <div className="flex gap-1.5">
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                className={`btn px-3 py-1 text-[12.5px] ${playCount === n ? "primary" : ""}`}
                onClick={() => onPlayCountChange(n)}
                disabled={disabled}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-[12.5px] text-muted">
            {picks.length >= playCount
              ? `고른 ${picks.length}개 중 앞에서 ${playCount}개를 씁니다`
              : picks.length === 0
                ? `고른 놀이가 없어 ${playCount}개 모두 AI가 고릅니다`
                : `고른 ${picks.length}개를 넣고, 남은 ${playCount - picks.length}개는 AI가 기록에서 고릅니다`}
          </span>
        </div>

        <div className="mb-2 text-[12.5px] font-bold text-muted">고른 놀이</div>
        <div className="flex flex-wrap gap-2">
          {picks.map((p, i) => (
            <span
              key={`${p.activity}-${p.date ?? ""}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-green bg-green-soft py-1 pl-3 pr-1.5 text-[12.5px] font-bold text-green-deep"
            >
              {p.date ? (
                <span className="font-mono text-[11px] opacity-75">
                  {shortDate(p.date)}
                </span>
              ) : (
                <span className="text-[10.5px] font-semibold opacity-70">
                  날짜 자동
                </span>
              )}
              {p.activity}
              <button
                className="border-0 bg-transparent px-1 text-[15px] leading-none text-green-deep opacity-55 hover:opacity-100"
                onClick={() => onPicksChange(picks.filter((_, k) => k !== i))}
                aria-label={`${p.activity} 빼기`}
                disabled={disabled}
              >
                ×
              </button>
            </span>
          ))}
          {Array.from(
            { length: Math.max(0, playCount - picks.length) },
            (_, i) => (
              <span
                key={`slot-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 py-1 text-[12.5px] text-faint"
              >
                <Sparkles size={12} />
                AI가 고름
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
