"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronRight, Mic, Paperclip } from "lucide-react";
import { useApp } from "@/lib/store";
import { ACTIVITY_PRESETS, TODAY } from "@/lib/constants";
import {
  useChildren,
  useDailyRecord,
  useDayRecordedIds,
  useSaveDailyRecord,
} from "@/lib/queries";
import {
  Avatar,
  N,
  Notice,
  PageHead,
  Select,
  Skeleton,
  SpecBar,
} from "@/components/ui";
import type { MealAmount, NapQuality } from "@/lib/types";

const LUNCH_OPTIONS: MealAmount[] = [
  "다 먹음",
  "조금 남김",
  "많이 남김",
  "거의 안 먹음",
];
const NAP_OPTIONS: NapQuality[] = ["잘 잤어요", "뒤척였어요", "못 잤어요"];

/**
 * 낮잠 시각 선택지 — 자유 입력 대신 드롭다운을 쓴다.
 *
 * 시각은 저장할 때 `HH:MM~HH:MM (품질)` 한 문자열로 합쳐지고, 읽을 때 그 형식을
 * 정규식으로 되판다. 손으로 "1시20분"처럼 적으면 파싱이 깨져 화면이 기본값을
 * 보여 주게 된다 — 아이가 얼마나 잤는지를 앱이 지어내는 셈이라 위험하다.
 * 고를 수 있는 값만 두면 그 경로가 아예 없어진다.
 *
 * 낮잠은 대개 정오~오후 4시 사이라 그 구간을 10분 간격으로 낸다.
 */
const NAP_TIME_OPTIONS: string[] = (() => {
  const times: string[] = [];
  for (let minutes = 11 * 60; minutes <= 16 * 60; minutes += 10) {
    const h = `${Math.floor(minutes / 60)}`.padStart(2, "0");
    const m = `${minutes % 60}`.padStart(2, "0");
    times.push(`${h}:${m}`);
  }
  return times;
})();

/**
 * 날짜 선택지 — 오늘부터 최근 2주.
 *
 * 예전에는 `2026-07-16`·`2026-07-15` 두 날짜가 박혀 있었다. 오늘이 그 날이
 * 아니면 드롭다운이 "선택"으로 비어 보이고, 고르는 순간 기록이 없는 날로
 * 넘어간다.
 */
const DATE_OPTIONS: { value: string; label: string }[] = (() => {
  const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
  const out: { value: string; label: string }[] = [];
  const cursor = new Date();
  for (let i = 0; i < 14; i += 1) {
    const y = cursor.getFullYear();
    const m = `${cursor.getMonth() + 1}`.padStart(2, "0");
    const d = `${cursor.getDate()}`.padStart(2, "0");
    const value = `${y}-${m}-${d}`;
    out.push({
      value,
      label: `${value} (${WEEKDAY[cursor.getDay()]})${i === 0 ? " · 오늘" : ""}`,
    });
    cursor.setDate(cursor.getDate() - 1);
  }
  return out;
})();

const EMPTY_FORM = {
  activities: ["바깥놀이"] as string[],
  lunch: "다 먹음" as MealAmount,
  snack: "다 먹음" as MealAmount,
  napFrom: "12:40",
  napTo: "14:10",
  napQuality: "잘 잤어요" as NapQuality,
  memo: "",
};

// SCR-003 하루 기록 입력 — 모든 문서의 유일한 원천 (FN-001)
function RecordForm() {
  const { toast } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const childrenQuery = useChildren();
  const saveMutation = useSaveDailyRecord();

  const kids = useMemo(() => childrenQuery.data ?? [], [childrenQuery.data]);
  const [childId, setChildId] = useState(params.get("child") ?? "");
  const [date, setDate] = useState(TODAY);
  const recordQuery = useDailyRecord(childId, date);
  const recordedQuery = useDayRecordedIds(date);

  // 그날 기록을 남긴 아이 집합 — 실 서버 ChildOut엔 recorded 플래그가 없으므로
  // records 조회로 판정한다. 이 값으로 "기록 완료" 표시·정렬·다음 아이를 결정한다.
  const recordedIds = useMemo(
    () => new Set(recordedQuery.data ?? []),
    [recordedQuery.data],
  );
  const isRecorded = (id: string) => recordedIds.has(id);

  // 완료된 아이를 위로 모아, 남은 작업이 아래에 이어지게 한다(안정 정렬).
  const orderedKids = useMemo(
    () =>
      [...kids].sort(
        (a, b) => Number(isRecorded(b.id)) - Number(isRecorded(a.id)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kids, recordedIds],
  );

  // 선택 아동이 비어 있으면 아직 기록 안 한 첫 아동으로 채운다(모두 완료면 첫 아동).
  useEffect(() => {
    if (childId || !kids.length) return;
    const firstTodo = kids.find((c) => !isRecorded(c.id)) ?? kids[0];
    setChildId(firstTodo.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, kids, recordedIds]);

  const [form, setForm] = useState(EMPTY_FORM);

  /**
   * 저장된 시각이 10분 격자에 없을 수도 있다(예전 기록·다른 경로로 들어온 값).
   * 그럴 때 목록에 없으면 Select가 "선택"으로 비어 보이고, 그대로 저장하면
   * 원래 시각이 사라진다. 현재 값을 목록에 끼워 넣어 그 경로를 막는다.
   */
  const napTimeOptions = useMemo(() => {
    const extra = [form.napFrom, form.napTo].filter(
      (t) => t && !NAP_TIME_OPTIONS.includes(t),
    );
    if (!extra.length) return NAP_TIME_OPTIONS;
    const merged = NAP_TIME_OPTIONS.concat(
      extra.filter((t, i) => extra.indexOf(t) === i),
    );
    return merged.sort();
  }, [form.napFrom, form.napTo]);
  const child = kids.find((c) => c.id === childId);
  const existing = recordQuery.data?.record ?? null;

  // 아이·날짜 전환 시: 저장된 기록이 있으면 수정 모드로 채우고, 없으면 초기화
  useEffect(() => {
    if (recordQuery.data === undefined) return;
    const rec = recordQuery.data.record;
    setForm(
      rec
        ? {
            activities: rec.activities,
            lunch: rec.lunch,
            snack: rec.snack,
            napFrom: rec.napFrom,
            napTo: rec.napTo,
            napQuality: rec.napQuality,
            memo: rec.memo,
          }
        : EMPTY_FORM,
    );
  }, [recordQuery.data]);

  const toggleAct = (a: string) =>
    setForm((f) => ({
      ...f,
      activities: f.activities.includes(a)
        ? f.activities.filter((x) => x !== a)
        : [...f.activities, a],
    }));

  const buildInput = () => ({ childId, date, ...form });

  const save = (onDone?: () => void) =>
    saveMutation.mutate(buildInput(), {
      onSuccess: () => {
        toast(existing ? "기록을 수정했습니다" : "저장했습니다");
        onDone?.();
      },
    });

  // 다음 아이 = 현재 이후로 아직 기록 안 한 첫 아동, 없으면 목록 내 다른 미기록 아동.
  const curIdx = orderedKids.findIndex((c) => c.id === childId);
  const nextUnrecorded =
    orderedKids.slice(curIdx + 1).find((c) => !isRecorded(c.id)) ??
    orderedKids.find((c) => !isRecorded(c.id) && c.id !== childId);

  const saveAndNext = () =>
    save(() => {
      if (nextUnrecorded) setChildId(nextUnrecorded.id);
    });

  const saveAndDraft = () =>
    save(() => router.push(`/notices?child=${childId}`));

  return (
    <>
      <PageHead
        title="하루 기록 입력"
        sub="아이별 1회 입력 — 모든 문서의 유일한 원천"
        right={
          <Select
            className="w-fit"
            value={date}
            onChange={setDate}
            ariaLabel="날짜"
            options={DATE_OPTIONS}
          />
        }
      />
      <SpecBar
        scr="SCR-003"
        fn={["FN-001"]}
        ep={["EP-007 저장", "EP-008 불러오기", "EP-004 아이 목록"]}
      />

      <div className="grid2">
        <div className="card">
          <h2>
            <N n={1} />
            아이 선택
            <span className="hint">
              {kids.filter((c) => isRecorded(c.id)).length}/{kids.length} 완료
            </span>
          </h2>
          {childrenQuery.isLoading ? (
            <Skeleton lines={6} />
          ) : (
            <div className="rail max-h-[460px] overflow-y-auto pr-1">
              {orderedKids.map((c) => (
                <button
                  key={c.id}
                  className={`rail-item ${c.id === childId ? "on" : ""}`}
                  onClick={() => setChildId(c.id)}
                >
                  <Avatar name={c.name} color={c.color} size="sm" />
                  {c.name}
                  <span className="meta">
                    {!c.attending ? (
                      "결석"
                    ) : isRecorded(c.id) ? (
                      <span className="inline-flex items-center gap-1 font-bold text-confirm">
                        <CheckCircle2 size={14} /> 기록 완료
                      </span>
                    ) : (
                      "기록 전"
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              {child && (
                <Avatar name={child.name} color={child.color} size="lg" />
              )}
              <div>
                <div className="text-[15.5px] font-extrabold">
                  {child?.name ?? "…"}
                </div>
                <div className="text-[12px] text-muted">
                  {child?.birthDate} · 보호자 {child?.guardian}
                  {child?.allergy && (
                    <span className="ml-1.5 rounded-md bg-coral-soft px-1.5 py-0.5 text-[11px] font-bold text-coral">
                      알레르기: {child.allergy}
                    </span>
                  )}
                </div>
              </div>
              {existing && (
                <span className="badge-final ml-auto">
                  ✎ 수정 모드 — {date} 기록 불러옴
                </span>
              )}
            </div>

            {/* 이 폼이 표현할 수 없는 형식으로 저장된 기록이면, 아래 선택칸은
                진짜 값이 아니라 기본값이다. 모르고 저장하면 원래 기록이
                지워지므로 원문을 먼저 보여 준다. */}
            {existing &&
              (recordQuery.data?.record?.mealParsed === false ||
                recordQuery.data?.record?.napParsed === false) && (
                <div className="mb-4">
                  <Notice kind="warn">
                    <b>이 기록은 아래 선택칸으로 옮겨 담을 수 없는 형식입니다.</b>
                    <br />
                    저장된 원문 —{" "}
                    {recordQuery.data?.record?.mealParsed === false && (
                      <>
                        식사: <b>{recordQuery.data.record.rawMeal || "—"}</b>{" "}
                      </>
                    )}
                    {recordQuery.data?.record?.napParsed === false && (
                      <>
                        낮잠: <b>{recordQuery.data.record.rawNap || "—"}</b>
                      </>
                    )}
                    <br />
                    아래 값은 기본값이라 사실과 다릅니다. 이대로 저장하면 위
                    원문이 지워집니다.
                  </Notice>
                </div>
              )}

            {recordQuery.isLoading ? (
              <Skeleton lines={6} />
            ) : (
              <>
                <div className="field">
                  <label>
                    <N n={2} />
                    활동{" "}
                    <span className="font-normal">
                      — 자주 쓰는 키워드로 빠르게(자유 서술 최소화)
                    </span>
                  </label>
                  <div className="chiprow">
                    {ACTIVITY_PRESETS.map((a) => (
                      <button
                        key={a}
                        className={`chip ${form.activities.includes(a) ? "on" : ""}`}
                        onClick={() => toggleAct(a)}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-[18px] flex flex-wrap items-end gap-x-4 gap-y-[18px]">
                  <div className="field m-0 w-[150px]">
                    <label>
                      <N n={3} />
                      점심
                    </label>
                    <Select
                      ariaLabel="점심"
                      value={form.lunch}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, lunch: v as MealAmount }))
                      }
                      options={LUNCH_OPTIONS}
                    />
                  </div>
                  <div className="field m-0 w-[150px]">
                    <label>간식</label>
                    <Select
                      ariaLabel="간식"
                      value={form.snack}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, snack: v as MealAmount }))
                      }
                      options={LUNCH_OPTIONS}
                    />
                  </div>
                  {/* 시각 두 개와 상태는 한 줄로 붙어 있어야 "언제부터 언제까지"로
                      읽힌다. 줄바꿈되면 두 시각이 위아래로 흩어져 무슨 값인지
                      알 수 없다 — 그래서 flex-nowrap. */}
                  <div className="field m-0">
                    <label>
                      <N n={4} />
                      낮잠
                    </label>
                    <span className="flex flex-nowrap items-center gap-2">
                      <Select
                        className="w-[92px] shrink-0"
                        ariaLabel="낮잠 시작"
                        value={form.napFrom}
                        onChange={(v) =>
                          setForm((f) => ({ ...f, napFrom: v }))
                        }
                        options={napTimeOptions}
                      />
                      <span className="shrink-0 text-muted">~</span>
                      <Select
                        className="w-[92px] shrink-0"
                        ariaLabel="낮잠 종료"
                        value={form.napTo}
                        onChange={(v) => setForm((f) => ({ ...f, napTo: v }))}
                        options={napTimeOptions}
                      />
                      <Select
                        className="w-[124px] shrink-0"
                        ariaLabel="낮잠 상태"
                        value={form.napQuality}
                        onChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            napQuality: v as NapQuality,
                          }))
                        }
                        options={NAP_OPTIONS}
                      />
                    </span>
                  </div>
                </div>

                <div className="field">
                  <label>
                    <N n={5} />
                    특이사항 메모{" "}
                    <span className="font-normal">
                      — 발달영역 자동 태깅(FN-010)의 원료
                    </span>
                  </label>
                  <textarea
                    className="input"
                    placeholder="예: 친구와 장난감 두고 다툼, 금방 화해"
                    value={form.memo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, memo: e.target.value }))
                    }
                  />
                </div>

                <div className="field mb-0">
                  <label>
                    <N n={6} />
                    사진·음성 첨부
                  </label>
                  <div className="inline">
                    <button
                      className="btn"
                      onClick={() =>
                        toast("사진은 사진함 분류(FN-006)로 연결됩니다")
                      }
                    >
                      <Paperclip size={14} /> 파일 선택
                    </button>
                    <button
                      className="btn"
                      onClick={() => toast("녹음은 프로토타입 범위 밖입니다")}
                    >
                      <Mic size={14} /> 녹음
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="btnrow mt-0 justify-end">
            <button
              className="btn big"
              onClick={() => save()}
              disabled={saveMutation.isPending || recordQuery.isLoading}
            >
              <N n={7} />
              {saveMutation.isPending ? "저장 중…" : "저장"}
            </button>
            {nextUnrecorded && (
              <button
                className="btn big"
                onClick={saveAndNext}
                disabled={saveMutation.isPending || recordQuery.isLoading}
              >
                저장하고 다음 아이
                <ChevronRight size={15} />
              </button>
            )}
            <button
              className="btn primary big"
              onClick={saveAndDraft}
              disabled={saveMutation.isPending || recordQuery.isLoading}
            >
              <N n={8} />
              저장하고 알림장 초안 만들기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function RecordsPage() {
  return (
    <Suspense>
      <RecordForm />
    </Suspense>
  );
}
