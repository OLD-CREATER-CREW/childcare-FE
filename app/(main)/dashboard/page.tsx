"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useMetrics } from "@/lib/queries";
import {
  N,
  Notice,
  PageHead,
  QueryError,
  Select,
  Skeleton,
  SpecBar,
} from "@/components/ui";

const DIST_LABELS = ["0", "~5%", "~10%", "~20%", "~40%", "40%+"];

// SCR-013 지표 대시보드 — 심사 시연의 마무리 화면 (FN-014)
export default function DashboardPage() {
  const metricsQuery = useMetrics();
  const m = metricsQuery.data;
  const [period, setPeriod] = useState("기간: 최근 2주");

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
          <Select
            className="w-fit"
            ariaLabel="기간"
            value={period}
            onChange={setPeriod}
            options={["기간: 최근 2주", "최근 1개월", "전체"]}
          />
        }
      />
      <SpecBar scr="SCR-013" fn={["FN-014"]} ep={["EP-028 metrics/summary"]} />

      <div className="stack">
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
                  수정 없이(편집거리 0) 확정된 비율 · 목표 60%{" "}
                  {m.adoptionRate >= 60 ? "✅ 달성" : "진행 중"}
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
                    <Tooltip
                      cursor={{ fill: "rgba(46,125,82,0.06)" }}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="var(--green)"
                      opacity={0.8}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="s mt-1.5">편집거리 구간별 문서 수</div>
          </div>
        </div>

        <div className="card">
          <h2>
            <N n={4} />
            일별 확정 문서 추이
            <span className="hint">최근 2주 · 오늘 확정하면 즉시 반영</span>
          </h2>
          {!m ? (
            <Skeleton lines={3} />
          ) : (
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={m.dailyConfirmed}
                  margin={{ top: 6, right: 6, bottom: 0, left: 6 }}
                >
                  <defs>
                    <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--green)"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--green)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10.5, fill: "var(--muted)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="확정 문서"
                    stroke="var(--green)"
                    strokeWidth={2}
                    fill="url(#gGreen)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <h2>
            <N n={5} />
            시간 단축률 (기준선 대비)
          </h2>
          {!m ? (
            <Skeleton lines={4} />
          ) : (
            <table className="tbl rowhover">
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
                    <td className="font-semibold">{row.docType}</td>
                    <td>{row.baseline}</td>
                    <td>{row.actual}</td>
                    <td className="font-extrabold text-green-deep">
                      {row.reductionPct}% ↓
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3">
            <Notice kind="soft">
              기준선 = 교사 설문 + 첫 주 수기 실측 평균. 기준선 없는 타입은
              표시하지 않고, 미설정 시 &quot;기준선 설문 필요&quot;로
              안내합니다(0%로 채우지 않음).
            </Notice>
          </div>
        </div>

        <div className="grid3">
          <div className="metric">
            <div className="k">
              <N n={6} />
              문서당 시간
            </div>
            <div className="v">{m?.perDocTime ?? "…"}</div>
            <div className="s">생성→확정 평균 · 30분 초과 건 제외</div>
          </div>
          <div className="metric">
            <div className="k">발달영역 태깅 일치율</div>
            <div className="v">{m ? `${m.taggingMatchRate}%` : "…"}</div>
            <div className="s">수동 수정 없는 비율 · 목표 80% · 시드 제외</div>
          </div>
          <div className="metric">
            <div className="k">토큰 비용</div>
            <div className="v">{m?.monthlyCost ?? "…"}</div>
            <div className="s">llm_calls 합산 × 모델 단가 (교사 1인 환산)</div>
          </div>
        </div>

        {/* (r9) 확정자별 지표 — 문서는 확정한 사람에게 귀속된다(EP-028 by_user) */}
        <div className="card">
          <h2>
            <N n={7} />
            확정자별 지표
            <span className="hint">
              줄 세우기가 아니라, AI 초안이 어떤 분의 문체·업무 방식에 잘 맞는지
              보는 값입니다
            </span>
          </h2>
          {!m ? (
            <Skeleton lines={3} />
          ) : m.byUser.length === 0 ? (
            <div className="py-2 text-[13px] text-muted">
              확정자가 기록된 문서가 아직 없습니다.
            </div>
          ) : (
            <table className="tbl rowhover">
              <thead>
                <tr>
                  <th>확정자</th>
                  <th className="w-24">확정 문서</th>
                  <th className="w-24">채택률</th>
                  <th className="w-24">평균 수정률</th>
                  <th className="w-28">문서당 시간</th>
                </tr>
              </thead>
              <tbody>
                {m.byUser.map((u) => (
                  <tr key={u.userId}>
                    <td className="font-semibold">{u.name}</td>
                    <td>{u.confirmedCount}건</td>
                    <td className="font-extrabold text-green-deep">
                      {u.adoptionRate == null ? "—" : `${u.adoptionRate}%`}
                    </td>
                    <td>
                      {u.editRateAvgPct == null ? "—" : `${u.editRateAvgPct}%`}
                    </td>
                    <td>{u.perDocTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {m && m.unattributedCount > 0 && (
            <div className="mt-3">
              <Notice kind="soft">
                확정자가 기록되지 않은 문서 {m.unattributedCount}건은 위
                집계에서 빠져 있습니다(시드 데이터와 귀속 기능 도입 이전 문서).
                확정자별 문서 수의 합에 이 수를 더하면 전체 확정 문서 수가
                됩니다.
              </Notice>
            </div>
          )}
        </div>

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
