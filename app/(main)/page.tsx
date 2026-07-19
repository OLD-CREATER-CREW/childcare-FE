"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TODAY, CLASS_NAME, TEACHER_NAME } from "@/lib/data/mock";
import { useChildren, useRecordSummary } from "@/lib/queries";
import { N, PageHead, QueryError, Skeleton, SpecBar } from "@/components/ui";

// SCR-002 오늘 홈 — 허브
export default function HomePage() {
  const router = useRouter();
  const childrenQuery = useChildren();
  const summaryQuery = useRecordSummary();

  const summary = summaryQuery.data;

  return (
    <>
      <PageHead
        title="오늘 홈"
        sub={`${TODAY} · ${CLASS_NAME} · 담임 ${TEACHER_NAME}`}
      />
      <SpecBar
        scr="SCR-002"
        fn={["허브(전 기능 연결)"]}
        ep={[
          "EP-004 아동목록",
          "EP-008 기록현황",
          "EP-012 미확정 문서",
          "EP-017 미분류 사진",
        ]}
      />

      <div className="grid3">
        <div className="metric">
          <div className="k">
            <N n={1} />
            오늘 기록
          </div>
          {summaryQuery.isLoading || !summary ? (
            <Skeleton lines={2} />
          ) : (
            <>
              <div className="v">
                {summary.done}{" "}
                <span className="text-base text-muted">/ {summary.total}</span>
              </div>
              <div className="progress my-1.5">
                <i
                  style={{ width: `${(summary.done / summary.total) * 100}%` }}
                />
              </div>
              <div className="s">
                남은 {summary.total - summary.done}명 — 아래 목록에서 이어서
                기록
              </div>
            </>
          )}
        </div>
        <div className="metric">
          <div className="k">미확정 문서</div>
          {summaryQuery.isLoading || !summary ? (
            <Skeleton lines={2} />
          ) : (
            <>
              <div className="v">
                {summary.pendingDocs}
                <span className="text-base">건</span>
              </div>
              <div className="s">
                알림장 {summary.pendingDocs}건이 검토를 기다립니다
              </div>
              <div className="btnrow">
                <Link className="btn" href="/notices">
                  확인하기 →
                </Link>
              </div>
            </>
          )}
        </div>
        <div className="metric">
          <div className="k">미분류 사진</div>
          {summaryQuery.isLoading || !summary ? (
            <Skeleton lines={2} />
          ) : (
            <>
              <div className="v">
                {summary.unclassifiedPhotos}
                <span className="text-base">장</span>
              </div>
              <div className="s">얼굴 유사도가 낮아 수동 지정이 필요해요</div>
              <div className="btnrow">
                <Link className="btn" href="/photos">
                  정리하기 →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card mt-3.5">
        <h2>
          <N n={2} />반 아동 목록{" "}
          <span className="text-[12.5px] font-normal text-muted">
            — 아이를 누르면 하루 기록 입력으로 이동
          </span>
        </h2>
        {childrenQuery.isLoading ? (
          <Skeleton lines={3} />
        ) : childrenQuery.isError ? (
          <QueryError onRetry={() => childrenQuery.refetch()} />
        ) : (
          <div className="chiprow">
            {childrenQuery.data?.map((c) => (
              <button
                key={c.id}
                className={`chip ${c.recorded ? "on" : ""}`}
                onClick={() => router.push(`/records?child=${c.id}`)}
              >
                {c.recorded ? "✅" : "⬜"} {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>
          <N n={3} />
          바로가기
        </h2>
        <div className="btnrow mt-0.5">
          <Link className="btn" href="/records">
            ✏️ 하루 기록
          </Link>
          <Link className="btn" href="/photos">
            📷 사진 올리기
          </Link>
          <Link className="btn" href="/notices">
            💌 알림장
          </Link>
          <Link className="btn" href="/journal">
            📔 보육일지
          </Link>
          <Link className="btn primary" href="/notices">
            ✨ 오늘 알림장 전체 만들기
          </Link>
        </div>
      </div>
    </>
  );
}
