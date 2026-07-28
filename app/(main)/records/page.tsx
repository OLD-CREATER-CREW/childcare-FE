"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronRight, Mic, Paperclip } from "lucide-react";
import { useApp } from "@/lib/store";
import { ACTIVITY_PRESETS, TODAY } from "@/lib/constants";
import { useChildren, useDailyRecord, useSaveDailyRecord } from "@/lib/queries";
import { Avatar, N, PageHead, Skeleton, SpecBar } from "@/components/ui";
import type { MealAmount, NapQuality } from "@/lib/types";

const LUNCH_OPTIONS: MealAmount[] = [
  "다 먹음",
  "조금 남김",
  "많이 남김",
  "거의 안 먹음",
];
const NAP_OPTIONS: NapQuality[] = ["잘 잤어요", "뒤척였어요", "못 잤어요"];

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
  const [childId, setChildId] = useState(params.get("child") ?? "c01");
  const [date, setDate] = useState(TODAY);
  const recordQuery = useDailyRecord(childId, date);

  const [form, setForm] = useState(EMPTY_FORM);
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

  const nextUnrecorded = kids.find((c) => !c.recorded && c.id !== childId);

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
          <select
            className="input w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="날짜"
          >
            <option value="2026-07-16">2026-07-16 (목)</option>
            <option value="2026-07-15">2026-07-15 (수)</option>
          </select>
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
              {kids.filter((c) => c.recorded).length}/{kids.length} 완료
            </span>
          </h2>
          {childrenQuery.isLoading ? (
            <Skeleton lines={6} />
          ) : (
            <div className="rail max-h-[460px] overflow-y-auto pr-1">
              {kids.map((c) => (
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
                    ) : c.recorded ? (
                      <CheckCircle2 size={14} className="text-confirm" />
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
                    <select
                      className="input"
                      value={form.lunch}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          lunch: e.target.value as MealAmount,
                        }))
                      }
                    >
                      {LUNCH_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field m-0 w-[150px]">
                    <label>간식</label>
                    <select
                      className="input"
                      value={form.snack}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          snack: e.target.value as MealAmount,
                        }))
                      }
                    >
                      {LUNCH_OPTIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field m-0">
                    <label>
                      <N n={4} />
                      낮잠
                    </label>
                    <span className="inline">
                      <input
                        className="input w-[84px]"
                        value={form.napFrom}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, napFrom: e.target.value }))
                        }
                        aria-label="낮잠 시작"
                      />
                      <span className="text-muted">~</span>
                      <input
                        className="input w-[84px]"
                        value={form.napTo}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, napTo: e.target.value }))
                        }
                        aria-label="낮잠 종료"
                      />
                      <select
                        className="input w-[108px]"
                        value={form.napQuality}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            napQuality: e.target.value as NapQuality,
                          }))
                        }
                      >
                        {NAP_OPTIONS.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
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

          <div className="btnrow mt-0">
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
                저장하고 다음 아이 ({nextUnrecorded.name}){" "}
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
