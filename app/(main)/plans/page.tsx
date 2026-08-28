"use client";

import { useMemo, useState } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { MONTH_LABEL, WEEK_LABEL } from "@/lib/constants";
import {
  useActivityRecommendations,
  useChildren,
  useDocumentDraft,
} from "@/lib/queries";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { PlanBlocks } from "@/components/plan/PlanBlocks";
import { N, Notice, PageHead, Skeleton, SpecBar } from "@/components/ui";

const DOMAIN_LABEL: Record<string, string> = {
  physical: "신체운동",
  communication: "의사소통",
  social: "사회관계",
  art: "예술경험",
  nature: "자연탐구",
};

/**
 * SCR-007 주간·월간 계획안.
 *
 * 흐름은 **추천 → 주제 → 생성** 순이다. 계획안은 "이번 달을 무엇으로 묶을
 * 것인가"가 먼저 정해지고 놀이가 따라 나오는 문서라, 주제를 모델이 정하게
 * 두면 교사가 생각한 방향과 어긋난 계획이 나온다. 추천은 주제를 고르는 데
 * 참고하라고 있는 것이고, 확정은 교사가 한다.
 */
export default function PlansPage() {
  // 월간이 기본 — 현장에서 월안을 먼저 짜고 주안이 거기서 갈라져 나온다.
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [topic, setTopic] = useState("");

  const childrenQuery = useChildren();
  // 반이 하나면 그 반 기준으로 추천한다(연령이 반마다 다르다).
  const className = useMemo(() => {
    const names: string[] = [];
    for (const c of childrenQuery.data ?? []) {
      if (c.className && !names.includes(c.className)) names.push(c.className);
    }
    return names.length === 1 ? names[0] : null;
  }, [childrenQuery.data]);

  const recQuery = useActivityRecommendations(className);
  const rec = recQuery.data;

  const docType = period === "monthly" ? "plan_monthly" : "plan";
  // 블록 편집기가 "이 문서의 이 칸"을 가리켜야 한다(EP-055) — 문서 번호가 필요하다.
  const draftQuery = useDocumentDraft(docType, null);
  const documentId = draftQuery.data?.documentId ?? null;
  const periodLabel = period === "monthly" ? MONTH_LABEL : WEEK_LABEL;

  return (
    <>
      <PageHead
        title="주간·월간 계획안"
        sub="현장 약칭: 주안·월안 — 주제는 선생님이, 구체화는 AI가"
      />
      <SpecBar
        scr="SCR-007"
        fn={["FN-004 계획안+근거", "FN-013 활동 추천"]}
        ep={["EP-010 generate(weekly/monthly)", "EP-027 추천"]}
      />

      <div className="card mb-4">
        <div className="field">
          <label>
            <N n={1} />
            기간
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="seg">
              <button
                className={period === "monthly" ? "on" : ""}
                onClick={() => setPeriod("monthly")}
              >
                월간
              </button>
              <button
                className={period === "weekly" ? "on" : ""}
                onClick={() => setPeriod("weekly")}
              >
                주간
              </button>
            </span>
            <span className="rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[13px] text-ink">
              {periodLabel}
            </span>
          </div>
        </div>

        {/* 추천을 주제 입력 바로 위에 둔다 — 보고 나서 적는 순서라서. */}
        <div className="field">
          <label>
            <N n={2} />
            <Lightbulb size={14} className="text-amber" />
            이런 놀이는 어떠세요{" "}
            <span className="font-normal text-muted">
              {rec?.season && rec?.ageLabel
                ? `— ${rec.season} · ${rec.ageLabel}${className ? ` · ${className}` : ""} 기준, 최근 관찰이 적은 영역 위주`
                : "— 계절·연령·최근 관찰을 함께 봅니다"}
            </span>
          </label>
          {recQuery.isLoading ? (
            <Skeleton lines={2} />
          ) : rec && rec.items.length > 0 ? (
            <div className="chiprow">
              {rec.items.map((item) => (
                <button
                  key={item.title}
                  className="chip"
                  title={item.reason}
                  onClick={() => setTopic(item.title)}
                >
                  {item.title}
                  <span className="ml-1 text-[11px] text-muted">
                    {DOMAIN_LABEL[item.domain] ?? item.domain}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="m-0 text-[13px] text-muted">
              추천할 활동을 찾지 못했습니다. 주제는 직접 적어 주세요.
            </p>
          )}
          <p className="mt-2 text-[12.5px] text-muted">
            누르면 아래 주제 칸에 들어갑니다. 그대로 쓰셔도 되고, 고쳐 쓰셔도
            됩니다.
          </p>
        </div>

        <div className="field m-0">
          <label>
            <N n={3} />
            {period === "monthly" ? "이 달의 놀이 주제" : "이 주의 놀이 주제"}
          </label>
          <input
            className="input w-full max-w-[520px]"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={
              period === "monthly"
                ? "예: 물이 좋아요 / 가을을 만나요 / 친구와 함께"
                : "예: 스카프로 까꿍 놀이해요"
            }
            maxLength={100}
          />
          <p className="mt-2 text-[12.5px] text-muted">
            비워 두면 최근 기록에서 아이들이 관심을 보인 놀이를 골라 AI가 주제를
            정합니다.
          </p>
        </div>
      </div>

      <DocumentWorkbench
        key={docType}
        type={docType}
        topic={topic}
        generateLabel={
          period === "monthly" ? "월간 계획안 만들기" : "주간 계획안 만들기"
        }
        generateHint={
          topic.trim() ? (
            <>
              주제 <b>&ldquo;{topic.trim()}&rdquo;</b>로 {periodLabel} 계획안을
              만듭니다. 20~40초쯤 걸립니다.
            </>
          ) : (
            <>
              주제를 적으면 그 주제로 묶어 드립니다. 비워 두면 최근 기록에서
              골라 정합니다. 20~40초쯤 걸립니다.
            </>
          )
        }
        emptyMessage="계획안을 만들 누적 기록이 부족합니다. 하루 기록을 먼저 남겨 주세요."
        /*
          블록 편집(SCR-007) — 초안은 놀이 다섯 개가 `⋅`로 이어진 한 줄로 온다.
          서식이 이미 칸과 머리표를 정해 두었으니 나눠 담아 칸마다·놀이마다
          고치게 한다. 작업본 저장·확정·파일은 워크벤치가 그대로 맡는다.
        */
        editorView={
          documentId == null
            ? undefined
            : ({ working, setWorking }) => (
                <PlanBlocks
                  type={docType}
                  documentId={documentId}
                  working={working}
                  setWorking={setWorking}
                />
              )
        }
        source={<PlanSource period={period} topic={topic} />}
      />

      <div className="mt-4">
        <Notice kind="soft">
          근거를 못 찾으면 근거 없이 초안은 그대로 만듭니다(초안을 막지 않음).
        </Notice>
      </div>
    </>
  );
}

/** 원천 패널 — 무엇을 근거로 만드는지 생성 전에 보여 준다. */
function PlanSource({
  period,
  topic,
}: {
  period: "weekly" | "monthly";
  topic: string;
}) {
  const label = period === "monthly" ? MONTH_LABEL : WEEK_LABEL;
  return (
    <table className="tbl">
      <tbody>
        <tr>
          <td className="w-[92px] whitespace-nowrap text-muted">기간</td>
          <td className="font-mono">{label}</td>
        </tr>
        <tr>
          <td className="whitespace-nowrap text-muted">주제</td>
          <td>
            {topic.trim() ? (
              <b>{topic.trim()}</b>
            ) : (
              <span className="text-muted">
                미지정 — 기록에서 AI가 정합니다
              </span>
            )}
          </td>
        </tr>
        <tr>
          <td className="whitespace-nowrap text-muted">기록</td>
          <td>이 기간의 반 전체 하루 기록</td>
        </tr>
        <tr>
          <td className="whitespace-nowrap text-muted">근거</td>
          <td>
            표준보육과정(0~2세) 또는 누리과정(3~5세) — 아동 연령으로 자동 선택
          </td>
        </tr>
      </tbody>
    </table>
  );
}
