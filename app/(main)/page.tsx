"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Mail,
  Pencil,
  Sparkles,
} from "lucide-react";
import { CLASS_NAME, TEACHER_NAME, TODAY, TODAY_LABEL } from "@/lib/constants";
import {
  useChildren,
  useDayRecordedIds,
  useNoticeQueue,
  useRecordSummary,
} from "@/lib/queries";
import {
  Avatar,
  N,
  PageHead,
  Progress,
  QueryError,
  Skeleton,
  SpecBar,
} from "@/components/ui";

// SCR-002 오늘 홈 — 허브
export default function HomePage() {
  const router = useRouter();
  const childrenQuery = useChildren();
  const summaryQuery = useRecordSummary();
  const queueQuery = useNoticeQueue();
  const recordedQuery = useDayRecordedIds(TODAY);

  const summary = summaryQuery.data;
  const kids = childrenQuery.data ?? [];
  // 하루 기록 화면과 동일한 원천으로 "기록 완료"를 판정한다 — 실 서버 ChildOut엔
  // recorded 플래그가 없어(?? false), 그날 records 조회 결과를 유일한 기준으로 쓴다.
  const recordedIds = new Set(recordedQuery.data ?? []);
  const isRecorded = (id: string) => recordedIds.has(id);
  const remaining = kids.filter((c) => !isRecorded(c.id));

  return (
    <>
      <PageHead
        title="오늘 홈"
        sub={`${TODAY_LABEL} · ${CLASS_NAME} · 담임 ${TEACHER_NAME}`}
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

      <div className="stack">
        <div className="grid3">
          <div className="metric hero">
            <div className="k">
              <N n={1} />
              <Pencil size={13} /> 오늘 기록
            </div>
            {summaryQuery.isLoading || !summary ? (
              <Skeleton lines={2} />
            ) : (
              <>
                <div className="v">
                  {summary.done}
                  <span className="text-base font-bold text-muted">
                    {" "}
                    / {summary.total}명
                  </span>
                </div>
                <div className="my-2">
                  <Progress value={summary.done} max={summary.total} />
                </div>
                <div className="s">
                  {summary.total - summary.done > 0
                    ? `남은 ${summary.total - summary.done}명 — 아래 목록에서 이어서 기록`
                    : "오늘 기록을 모두 마쳤어요 🎉"}
                </div>
              </>
            )}
          </div>
          <div className="metric">
            <div className="k">
              <Mail size={13} /> 미확정 알림장
            </div>
            {summaryQuery.isLoading || !summary ? (
              <Skeleton lines={2} />
            ) : (
              <>
                <div className="v">
                  {summary.pendingDocs}
                  <span className="text-base font-bold text-muted">건</span>
                </div>
                <div className="s">
                  {summary.pendingDocs > 0
                    ? "AI 초안이 검토를 기다립니다"
                    : "검토 대기 중인 초안이 없어요"}
                </div>
                <div className="btnrow mt-3">
                  <Link
                    className="btn px-3.5 py-1.5 text-[12.5px]"
                    href="/notices"
                  >
                    검토하기 <ArrowRight size={13} />
                  </Link>
                </div>
              </>
            )}
          </div>
          <div className="metric">
            <div className="k">
              <Camera size={13} /> 미분류 사진
            </div>
            {summaryQuery.isLoading || !summary ? (
              <Skeleton lines={2} />
            ) : (
              <>
                <div className="v">
                  {summary.unclassifiedPhotos}
                  <span className="text-base font-bold text-muted">장</span>
                </div>
                <div className="s">얼굴 유사도가 낮아 수동 지정이 필요해요</div>
                <div className="btnrow mt-3">
                  <Link
                    className="btn px-3.5 py-1.5 text-[12.5px]"
                    href="/photos"
                  >
                    정리하기 <ArrowRight size={13} />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <h2>
            <N n={2} />반 아동 목록
            <span className="hint">아이를 누르면 하루 기록 입력으로 이동</span>
          </h2>
          {childrenQuery.isLoading ? (
            <Skeleton lines={3} />
          ) : childrenQuery.isError ? (
            <QueryError onRetry={() => childrenQuery.refetch()} />
          ) : (
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              {kids.map((c) => (
                <button
                  key={c.id}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13.5px] font-medium transition-all hover:-translate-y-0.5 hover:shadow-card ${
                    isRecorded(c.id)
                      ? "border-line bg-surface"
                      : "border-dashed border-line-strong bg-paper"
                  }`}
                  onClick={() => router.push(`/records?child=${c.id}`)}
                >
                  <Avatar name={c.name} color={c.color} />
                  <span className="min-w-0">
                    <span className="block truncate">{c.name}</span>
                    <span
                      className={`block text-[11px] font-semibold ${
                        isRecorded(c.id)
                          ? "text-confirm"
                          : c.attending
                            ? "text-amber"
                            : "text-faint"
                      }`}
                    >
                      {!c.attending
                        ? "결석"
                        : isRecorded(c.id)
                          ? "기록 완료"
                          : "기록 전"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {remaining.length > 0 && !childrenQuery.isLoading && (
            <div className="mt-3.5 text-[12.5px] text-muted">
              아직 기록 전:{" "}
              {remaining.map((c) => (
                <button
                  key={c.id}
                  className="mr-1 font-semibold text-green-deep underline-offset-2 hover:underline"
                  onClick={() => router.push(`/records?child=${c.id}`)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2>
            <N n={3} />
            오늘의 흐름
            <span className="hint">기록 → 알림장 → 발송까지 한 번에</span>
          </h2>
          <div className="mb-4 flex items-center gap-3 text-[13px] text-muted">
            <span className="font-semibold text-ink">
              알림장{" "}
              {queueQuery.data
                ? `${queueQuery.data.confirmed}/${queueQuery.data.generated}`
                : "…"}
              건 확정
            </span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <span>
              발송 {queueQuery.data ? queueQuery.data.sent : "…"}건 완료
            </span>
          </div>
          <div className="btnrow mt-0">
            <Link className="btn" href="/records">
              <Pencil size={14} /> 하루 기록
            </Link>
            <Link className="btn" href="/photos">
              <Camera size={14} /> 사진 올리기
            </Link>
            <Link className="btn" href="/journal">
              <BookOpen size={14} /> 보육일지
            </Link>
            <Link className="btn primary" href="/notices">
              <Sparkles size={14} /> 오늘 알림장 검토하기
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
