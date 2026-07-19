"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { useMetrics } from "@/lib/queries";
import {
  N,
  Notice,
  PageHead,
  QueryError,
  Skeleton,
  SpecBar,
} from "@/components/ui";

const DIST_LABELS = ["0", "~5%", "~10%", "~20%", "~40%", "40%+"];

// SCR-013 지표 대시보드 — 심사 시연의 마무리 화면 (FN-014)
export default function DashboardPage() {
  const metricsQuery = useMetrics();
  const m = metricsQuery.data;

  if (metricsQuery.isError) {
    return (
      <>
        <PageHead
          title="지표 대시보드"
          sub="AI 도입 효과 — 심사 시연의 마무리 화면"
        />
        <QueryError onRetry={() => metricsQuery.refetch()} />
      </>
    );
  }

  const distData = m?.editDistribution.map((v, i) => ({
    name: DIST_LABELS[i] ?? `${i}`,
    value: v,
  }));

  return (
    <>
      <PageHead
        title="지표 대시보드"
        sub="AI 도입 효과 — 심사 시연의 마무리 화면"
        right={
          <select className="input w-auto">
            <option>기간: 최근 2주</option>
            <option>최근 1개월</option>
            <option>전체</option>
          </select>
        }
      />
      <SpecBar scr="SCR-013" fn={["FN-014"]} ep={["EP-028 metrics/summary"]} />

      <div className="grid3">
        <div className="metric hero">
          <div className="k">
            <N n={1} />
            채택률 (핵심)
          </div>
          {!m ? (
            <Skeleton lines={2} />
          ) : (
            <>
              <div className="v">{m.adoptionRate}%</div>
              <div className="s">
                수정 없이(편집거리 0) 확정된 비율 · 목표 60% ✅ 달성
              </div>
            </>
          )}
        </div>
        <div className="metric">
          <div className="k">
            <N n={2} />
            경미수정률
          </div>
          {!m ? (
            <Skeleton lines={2} />
          ) : (
            <>
              <div className="v">+{m.minorEditGainPt}%p</div>
              <div className="s">
                수정률 10% 이하 문서 · 채택+경미수정 = {m.combinedRate}%
              </div>
            </>
          )}
        </div>
        <div className="metric">
          <div className="k">
            <N n={3} />
            수정률 분포
          </div>
          {!m ? (
            <Skeleton lines={2} />
          ) : (
            <div className="mt-2 h-[64px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distData}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: "var(--muted)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--green)"
                    opacity={0.75}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="s mt-1.5">편집거리 구간별 문서 수</div>
        </div>
      </div>

      <div className="card mt-3.5">
        <h2>
          <N n={4} />
          시간 단축률 (기준선 대비)
        </h2>
        {!m ? (
          <Skeleton lines={4} />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>문서 타입</th>
                <th>기준선(수기)</th>
                <th>AI 실측(생성→확정)</th>
                <th>단축률</th>
              </tr>
            </thead>
            <tbody>
              {m.timeSavings.map((row) => (
                <tr key={row.docType}>
                  <td>{row.docType}</td>
                  <td>{row.baseline}</td>
                  <td>{row.actual}</td>
                  <td className="font-extrabold text-green-deep">
                    {row.reduction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-2.5">
          <Notice kind="soft">
            기준선 = 교사 설문 + 첫 주 수기 실측
            평균(settings.baseline_minutes). 기준선 없는 타입은 표시하지 않고,
            미설정 시 &quot;기준선 설문 필요&quot;로 안내합니다(0%로 채우지
            않음).
          </Notice>
        </div>
      </div>

      <div className="grid3 mt-3.5">
        <div className="metric">
          <div className="k">
            <N n={5} />
            문서당 시간
          </div>
          <div className="v">{m?.perDocTime ?? "…"}</div>
          <div className="s">생성→확정 평균 · 30분 초과 건 제외(제외 2건)</div>
        </div>
        <div className="metric">
          <div className="k">
            <N n={6} />
            발달영역 태깅 일치율
          </div>
          <div className="v">{m ? `${m.taggingMatchRate}%` : "…"}</div>
          <div className="s">tags_edited=0 비율 · 목표 80% ✅ · 시드 제외</div>
        </div>
        <div className="metric">
          <div className="k">
            <N n={7} />
            토큰 비용
          </div>
          <div className="v">{m?.monthlyCost ?? "…"}</div>
          <div className="s">
            llm_calls 단독 합산 × 모델 단가(교사 1인 환산)
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Notice kind="soft">
          <span>
            <N n={8} />
            집계 제외 — 재생 모드(FN-017)·시드 데이터 산출물은 지표에 포함되지
            않습니다.
          </span>
        </Notice>
      </div>
    </>
  );
}
