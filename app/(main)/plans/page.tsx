"use client";

import { useApp } from "@/lib/store";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { N, Notice, PageHead, SpecBar } from "@/components/ui";

// SCR-007 주간·월간 계획안 — 초안 + 누리과정 근거 패널 (RAG citations)
export default function PlansPage() {
  const { toast } = useApp();

  const citation = (title: string, desc: string) => (
    <div className="notice info mb-[9px] block">
      <b>{title}</b>
      <br />
      <span className="text-[12.5px]">
        {desc}{" "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            toast("출처 원문 위치·전문을 펼쳐 보여 줍니다");
          }}
          className="text-blue"
        >
          원문 보기
        </a>
      </span>
    </div>
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

      <div className="card">
        <div className="inline">
          <div className="field m-0">
            <label>
              <N n={1} />
              기간
            </label>
            <span className="inline">
              <select className="input">
                <option>주간</option>
                <option>월간</option>
              </select>
              <input
                className="input w-[210px]"
                defaultValue="2026-07-13 ~ 07-19"
              />
            </span>
          </div>
          <button
            className="btn primary ml-auto"
            onClick={() => toast("누적 기록 수집 → 근거 검색 → 초안 생성 중…")}
          >
            초안 만들기
          </button>
        </div>
      </div>

      <DocumentWorkbench
        type="plan"
        source={
          <>
            <h2 className="mb-2 mt-0 text-sm">
              <N n={3} />
              누리과정 근거{" "}
              <span className="text-xs font-normal text-muted">
                RAG citations
              </span>
            </h2>
            {citation(
              "[누리과정] 신체운동·건강 3-2",
              "물놀이를 통한 신체 활동·안전 수칙 실천 관련 조항",
            )}
            {citation(
              "[표준보육과정] 의사소통 2-1",
              "경험을 말로 표현하는 기회 제공 관련 조항",
            )}
          </>
        }
        sidePanel={
          <div className="card mt-3.5">
            <details>
              <summary className="cursor-pointer text-sm font-bold">
                <N n={6} />▸ 활동 추천 패널(확장) — 계절·연령·이력 기반 후보,
                참고용(자동 반영 안 함)
              </summary>
              <div className="chiprow mt-3">
                <span className="chip">💧 얼음 보물찾기</span>
                <span className="chip">🎨 물풍선 그림</span>
                <span className="chip">🫧 비눗방울 과학놀이</span>
                <span className="chip">🌊 파도 소리 명상</span>
              </div>
            </details>
          </div>
        }
      />
      <div className="mt-3">
        <Notice kind="soft">
          근거를 못 찾으면 패널을 비운 채 초안은 그대로 만듭니다(초안을 막지
          않음).
        </Notice>
      </div>
    </>
  );
}
