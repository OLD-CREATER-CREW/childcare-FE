"use client";

import { useState } from "react";
import { BookMarked, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { useRegenerateDraft } from "@/lib/queries";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { N, Notice, PageHead, SpecBar } from "@/components/ui";

const CITATIONS = [
  {
    title: "[누리과정] 신체운동·건강 3-2",
    desc: "물놀이를 통한 신체 활동·안전 수칙 실천 관련 조항",
  },
  {
    title: "[표준보육과정] 의사소통 2-1",
    desc: "경험을 말로 표현하는 기회 제공 관련 조항",
  },
  {
    title: "[누리과정] 자연탐구 1-3",
    desc: "물의 성질을 오감으로 탐색하는 활동 근거",
  },
];

// SCR-007 주간·월간 계획안 — 초안 + 누리과정 근거 패널 (RAG citations)
export default function PlansPage() {
  const { toast } = useApp();
  const regenMutation = useRegenerateDraft();
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");

  const makeDraft = () =>
    regenMutation.mutate(
      { type: "plan", childId: null },
      {
        onSuccess: () =>
          toast("누적 기록 수집 → 근거 검색 → 초안을 새로 만들었습니다"),
      },
    );

  return (
    <>
      <PageHead
        title="주간·월간 계획안"
        sub="현장 약칭: 주안·월안 — 누적 기록 + 누리과정 근거"
      />
      <SpecBar
        scr="SCR-007"
        fn={["FN-004 계획안+근거", "FN-013 활동 추천(확장)"]}
        ep={["EP-010 generate(weekly/monthly)", "EP-027 추천"]}
      />

      <div className="card mb-4">
        <div className="field m-0">
          <label>
            <N n={1} />
            기간
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="seg">
              <button
                className={period === "weekly" ? "on" : ""}
                onClick={() => setPeriod("weekly")}
              >
                주간
              </button>
              <button
                className={period === "monthly" ? "on" : ""}
                onClick={() => setPeriod("monthly")}
              >
                월간
              </button>
            </span>
            <input
              className="input w-[200px]"
              readOnly
              value={
                period === "weekly" ? "2026-07-13 ~ 07-19" : "2026-07 전체"
              }
            />
            <button
              className="btn primary"
              onClick={makeDraft}
              disabled={regenMutation.isPending}
            >
              <Sparkles size={14} />
              {regenMutation.isPending ? "생성 중…" : "초안 만들기"}
            </button>
          </div>
        </div>
      </div>

      <DocumentWorkbench
        type="plan"
        source={
          <>
            <div className="mb-2.5 flex items-center gap-1.5 text-sm font-bold">
              <N n={3} />
              <BookMarked size={14} className="text-green" />
              누리과정 근거{" "}
              <span className="text-xs font-normal text-muted">
                RAG citations
              </span>
            </div>
            {CITATIONS.map((c) => (
              <div key={c.title} className="notice info mb-2.5 block">
                <b>{c.title}</b>
                <br />
                <span className="text-[12.5px]">
                  {c.desc}{" "}
                  <button
                    className="font-semibold text-blue underline-offset-2 hover:underline"
                    onClick={() =>
                      toast("출처 원문 위치·전문을 펼쳐 보여 줍니다")
                    }
                  >
                    원문 보기
                  </button>
                </span>
              </div>
            ))}
          </>
        }
        sidePanel={
          <div className="card mt-4">
            <details>
              <summary className="cursor-pointer text-sm font-bold">
                <N n={6} />▸ 활동 추천 패널(확장) — 계절·연령·이력 기반 후보,
                참고용(자동 반영 안 함)
              </summary>
              <div className="chiprow mt-3.5">
                <span className="chip">💧 얼음 보물찾기</span>
                <span className="chip">🎨 물풍선 그림</span>
                <span className="chip">🫧 비눗방울 과학놀이</span>
                <span className="chip">🌊 파도 소리 명상</span>
              </div>
            </details>
          </div>
        }
      />
      <div className="mt-4">
        <Notice kind="soft">
          근거를 못 찾으면 패널을 비운 채 초안은 그대로 만듭니다(초안을 막지
          않음).
        </Notice>
      </div>
    </>
  );
}
