"use client";

import Link from "next/link";
import { useChecklist } from "@/lib/queries";
import {
  N,
  Notice,
  PageHead,
  Progress,
  QueryError,
  Skeleton,
  SpecBar,
} from "@/components/ui";

// SCR-012 평가제 체크리스트 — LLM 없이 규칙엔진 (FN-012)
export default function ChecklistPage() {
  const checklistQuery = useChecklist();
  const data = checklistQuery.data;

  return (
    <>
      <PageHead
        title="평가제 체크리스트"
        sub="지표↔필요서류 규칙 × 실데이터 대조 — LLM 없이 규칙엔진"
        right={
          data && (
            <span className="metric flex items-center gap-3 px-4 py-2.5">
              <span className="k m-0">전체 충족률</span>
              <span className="text-xl font-extrabold leading-none text-green-deep">
                {data.met} / {data.total}
              </span>
              <span className="w-20">
                <Progress value={data.met} max={data.total} />
              </span>
            </span>
          )
        }
      />
      <SpecBar scr="SCR-012" fn={["FN-012"]} ep={["EP-026 checklist"]} />

      <div className="stack">
        <div className="card">
          <h2>
            <N n={1} />
            지표별 판정
            <span className="hint">
              조회 시마다 실데이터 재집계(저장 안 함) — 문서를 확정하면 즉시
              반영됩니다
            </span>
          </h2>
          {checklistQuery.isLoading ? (
            <Skeleton lines={5} />
          ) : checklistQuery.isError ? (
            <QueryError onRetry={() => checklistQuery.refetch()} />
          ) : (
            data?.items.map((it) => (
              <div key={it.id} className={`check ${it.ok ? "ok" : "miss"}`}>
                <span className="st">{it.ok ? "✅" : "⚠️"}</span>
                <div>
                  <div className="t">{it.title}</div>
                  <div className="d">{it.desc}</div>
                </div>
                <span className="r">{it.ok ? "충족" : "누락"}</span>
              </div>
            ))
          )}
        </div>

        {data && data.missingObservations.length > 0 && (
          <Notice kind="warn">
            🔔{" "}
            <span>
              <N n={2} />
              <b>누락 알림</b> — {data.missingObservations.join("·")}의
              관찰기록이 없습니다.{" "}
              <Link className="btn ml-2 px-3 py-1" href="/observations">
                관찰 화면으로 이동 →
              </Link>
            </span>
          </Notice>
        )}
      </div>
    </>
  );
}
