"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/store";
import { ACTIVITY_PRESETS, DATE_OPTIONS, TODAY } from "@/lib/constants";
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
  // 지난 날짜의 기록으로 바로 오는 링크가 있다(보육일지 출처 카드) — 날짜가
  // 오늘로 고정되면 그 링크가 엉뚱한 날의 빈 폼을 연다.
  const [date, setDate] = useState(params.get("date") ?? TODAY);
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

  // --- 활동 직접 입력 -------------------------------------------------------
  //
  // 키워드 여덟 개로는 그날 실제로 한 놀이를 담지 못한다("두꺼비집", "물총",
  // "재활용품 만들기"). 그렇다고 자유 서술로 되돌리면 문서 생성이 쓰기 어려운
  // 긴 문장을 받게 되므로, **낱말 단위 태그**로 받는다 — 키워드를 누르는 것과
  // 같은 모양의 값이 되어 뒷단은 아무것도 달라지지 않는다.
  const [actDraft, setActDraft] = useState("");
  const actInputRef = useRef<HTMLInputElement>(null);

  /**
   * 적은 것을 태그로 굳힌다.
   *
   * 쉼표를 걷어내는 이유: 저장할 때 활동을 `", "`로 이어 붙이고 읽을 때 다시
   * 쉼표로 쪼갠다(`lib/api/spec.ts`). 태그 안에 쉼표가 들어가면 다음에 불러올 때
   * 한 활동이 둘로 갈라진다. 쉼표를 넣는 것은 대개 여러 개를 한 번에 적으려는
   * 뜻이므로, **거기서 끊어 각각 태그로 만든다.**
   */
  const commitAct = (raw = actDraft) => {
    const parts = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      setActDraft("");
      return;
    }
    setForm((f) => {
      const next = [...f.activities];
      parts.forEach((t) => {
        if (!next.includes(t)) next.push(t);
      });
      return { ...f, activities: next };
    });
    setActDraft("");
  };

  const removeAct = (a: string) =>
    setForm((f) => ({ ...f, activities: f.activities.filter((x) => x !== a) }));

  const onActKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글은 조합 중에도 Enter가 온다. 조합이 끝나기 전에 굳히면 "ㄱ"만 남는다.
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      commitAct();
      return;
    }
    // 빈 칸에서 지우기를 누르면 마지막 태그를 떼어 낸다 — 태그 입력칸의 관례다.
    if (e.key === "Backspace" && actDraft === "" && form.activities.length > 0) {
      e.preventDefault();
      removeAct(form.activities[form.activities.length - 1]);
    }
  };

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
                      — 적고 Enter를 누르면 태그가 됩니다
                    </span>
                  </label>

                  {/* 고른 활동은 여기 모인다. 키워드로 넣든 손으로 적든 같은
                      자리에 쌓여야, 지금 무엇이 담겼는지 한눈에 보인다. */}
                  <div
                    className="tagbox"
                    onClick={(e) => {
                      // 빈 곳을 눌러도 바로 적을 수 있게 — 입력칸이 좁아서
                      // 정확히 겨냥해야 하면 손이 많이 간다.
                      if (e.target === e.currentTarget) actInputRef.current?.focus();
                    }}
                  >
                    {form.activities.map((a) => (
                      <span key={a} className="tag-pill">
                        {a}
                        <button
                          type="button"
                          aria-label={`${a} 지우기`}
                          onClick={() => removeAct(a)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      ref={actInputRef}
                      value={actDraft}
                      onChange={(e) => setActDraft(e.target.value)}
                      onKeyDown={onActKeyDown}
                      onBlur={() => commitAct()}
                      placeholder={
                        form.activities.length ? "" : "활동을 적고 Enter"
                      }
                      aria-label="활동 추가"
                    />
                  </div>

                  <div className="mt-2.5">
                    <div className="mb-1.5 text-[12px] text-muted">
                      자주 쓰는 키워드
                    </div>
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

                {/* 이름이 「특이사항 메모」였을 때는 특별한 일이 있을 때만
                    적는 칸으로 읽혀 대부분 비어 있었다. 이 칸이 발달영역
                    태깅(FN-010)과 알림장 문장의 원료라, 비면 앱 전체의 재료가
                    줄어든다. 이름을 넓히고 칸도 함께 넓힌다. */}
                <div className="field mb-0">
                  <label>
                    <N n={5} />
                    메모 기록{" "}
                    <span className="font-normal">
                      — 발달영역 자동 태깅(FN-010)의 원료
                    </span>
                  </label>
                  <textarea
                    className="input min-h-[168px]"
                    rows={6}
                    placeholder={
                      "예: 모래놀이터에서 두꺼비집을 만들다가 무너지자 다시 쌓음.\n" +
                      "옆에 있던 지호가 물을 떠다 부어 주자 함께 웃으며 이어 감."
                    }
                    value={form.memo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, memo: e.target.value }))
                    }
                  />
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
              <N n={6} />
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
              <N n={7} />
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
