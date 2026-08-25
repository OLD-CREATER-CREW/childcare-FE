"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Sparkles } from "lucide-react";
import { ApiError } from "@/lib/api";
import { saveBlob } from "@/lib/download";
import {
  useActiveTemplate,
  useDocumentDraft,
  useDownloadDocumentFile,
  useGenerateJournalFile,
} from "@/lib/queries";
import { useApp } from "@/lib/store";
import { EmptyState, N, Notice, Skeleton } from "@/components/ui";

/**
 * 보육일지 만들기 — 버튼 하나로 완성 한글 파일까지(SCR-006 · EP-010).
 *
 * 다른 문서(`DocumentWorkbench`)와 달리 **화면 안의 검토·수정 단계가 없다.**
 * 이 문서의 산출물은 글이 아니라 원에 제출하는 한글 파일이고, 고칠 곳이 있으면
 * 받은 hwpx를 한글에서 직접 고치는 편이 칸을 하나씩 눌러 고치는 것보다 빠르다.
 * 그래서 예전의 다섯 단계(초안 → 칸 편집 → 확정 → 문서 만들기 → 내려받기)를
 * 한 번의 호출로 접었다 — 서버도 같은 요청 안에서 확정까지 끝낸다.
 *
 * 이미 만든 날의 일지는 **다시 만들지 않고 다시 받는다**(EP-036). 재생성은 칸마다
 * 모델을 다시 부르는 일이라 몇 분과 토큰을 새로 쓴다.
 */
export function JournalGenerator({
  date,
  source,
}: {
  /** 교사가 고른 날. 조회·생성·내려받기가 모두 이 날짜를 들고 간다. */
  date: string;
  source: React.ReactNode;
}) {
  const { toast } = useApp();
  const generateMutation = useGenerateJournalFile();
  const downloadMutation = useDownloadDocumentFile();
  const activeTemplateQuery = useActiveTemplate("journal");
  /** 이 날 일지를 전에 만들었는지 — 「다시 받기」를 띄울지 정한다. */
  const draftQuery = useDocumentDraft("journal", null, date);

  const hasTemplate = activeTemplateQuery.data != null;
  const existing = draftQuery.data ?? null;
  const hasFile =
    existing?.fileKey != null && existing.fileRenderStatus === "ok";

  /** 생성 경과 — 칸마다 모델을 부르므로 몇 분짜리 작업이다. */
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!generateMutation.isPending) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [generateMutation.isPending]);

  const generate = () =>
    generateMutation.mutate(
      { date },
      {
        onSuccess: ({ blob, filename }) => {
          saveBlob(blob, filename);
          toast(`${filename} 을(를) 저장했습니다`);
        },
      },
    );

  const downloadAgain = () =>
    downloadMutation.mutate(
      { type: "journal", childId: null, date },
      {
        onSuccess: ({ blob, filename }) => {
          saveBlob(blob, filename);
          toast(`${filename} 을(를) 저장했습니다`);
        },
      },
    );

  const error = generateMutation.error;
  /** 서식이 없다 — 오류 응답이지만 비정상은 아니다. 서식을 올리면 풀린다. */
  const noTemplate =
    error instanceof ApiError && error.code === "NO_ACTIVE_TEMPLATE";
  /** 원천이 없다 — 하루 기록을 먼저 써야 한다. */
  const noRecords =
    error instanceof ApiError && error.code === "RECORD_NOT_FOUND";
  /**
   * LLM 장애(503)·서식 채우기 실패(422)는 다시 눌러도 같은 결과다. 원인을 그대로
   * 보여 주고 "다시 시도"를 권하지 않는다 — 교사가 영문 모른 채 반복해 누르게 된다.
   */
  const hardFailure =
    error instanceof ApiError &&
    (error.code === "LLM_UNAVAILABLE" || error.code === "RENDER_FAILED");

  return (
    <>
      <div className="flowrail">
        <span className={`st ${generateMutation.isPending ? "on" : "done"}`}>
          <Sparkles size={13} /> 하루 기록
        </span>
        <span className="ln" />
        <span className={`st ${generateMutation.isPending ? "on" : ""}`}>
          서식 칸 채우기
        </span>
        <span className="ln" />
        <span className={`st ${hasFile ? "done" : ""}`}>한글 파일</span>
      </div>

      <div className="grid-doc">
        <div className="card">
          <h2>
            <N n={1} />
            원천 기록 <span className="hint">source_record_ids</span>
          </h2>
          {source}
          <div className="mt-3">
            <Notice kind="soft">
              이 날의 하루 기록 전체가 일지의 원천입니다.
            </Notice>
          </div>
        </div>

        <div className="card">
          <div className="flex min-h-[30px] flex-wrap items-center gap-2">
            <span className="badge-ai">
              <N n={2} />
              🤖 보육일지 만들기
            </span>
            {hasFile && !generateMutation.isPending && (
              <span className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-confirm">
                <CheckCircle2 size={13} />이 날 일지를 만들었습니다
              </span>
            )}
          </div>

          {generateMutation.isPending ? (
            <div className="draftbox">
              <Skeleton lines={8} />
              <div className="hint">
                서식의 칸마다 내용을 쓰는 중… 칸이 많으면 2~5분쯤 걸립니다.
                {elapsed > 0 && (
                  <span className="ml-1 font-mono">
                    ({Math.floor(elapsed / 60)}:
                    {String(elapsed % 60).padStart(2, "0")} 경과)
                  </span>
                )}
                {elapsed > 20 && (
                  <div className="mt-1">
                    창을 닫지 말고 기다려 주세요 — 다 되면 한글 파일이 자동으로
                    저장됩니다.
                  </div>
                )}
              </div>
            </div>
          ) : noTemplate ? (
            <EmptyState
              icon="📄"
              title="먼저 우리 원 서식을 올려 주세요"
              desc="보육일지는 원 서식의 칸을 채워 만듭니다. 위 「서식 파일 올리기」로 한글 서식을 등록하고 「이 서식 쓰기」를 눌러 주세요."
            />
          ) : noRecords ? (
            <EmptyState
              icon="📝"
              title="이 날의 하루 기록이 없어요"
              desc="일지는 그날 하루 기록에서 나옵니다. 하루 기록을 먼저 저장해 주세요."
            />
          ) : hardFailure ? (
            <div className="draftbox">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={17}
                  className="mt-0.5 flex-none text-warn"
                />
                <div>
                  <p className="m-0 text-[14px] font-semibold text-ink">
                    지금은 일지를 만들 수 없습니다
                  </p>
                  <p className="mb-0 mt-1.5 text-[13px] leading-relaxed text-muted">
                    {(error as ApiError).message}
                  </p>
                  <p className="mb-0 mt-2 text-[12.5px] text-muted">
                    이 문제는 다시 눌러도 해결되지 않습니다 — 관리자에게 알려
                    주세요.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="draftbox flex flex-col items-center gap-3 py-10 text-center">
              <span className="text-[26px]">✨</span>
              <p className="m-0 text-[14px] font-semibold text-ink">
                {hasFile
                  ? "이 날 일지를 다시 만들 수 있습니다"
                  : "아직 이 날 일지를 만들지 않았습니다"}
              </p>
              <p className="m-0 max-w-[48ch] text-[13px] leading-relaxed text-muted">
                등록한 서식의 <b>칸마다</b> AI가 내용을 씁니다 — 칸이 많으면{" "}
                <b>2~5분</b>쯤 걸리고, 다 되면 <b>한글 파일이 바로 저장</b>
                됩니다. 고칠 곳은 <b>한글에서 직접</b> 수정하세요.
              </p>
              <div className="btnrow justify-center">
                <button
                  className="btn primary"
                  onClick={generate}
                  disabled={generateMutation.isPending || !hasTemplate}
                >
                  <Sparkles size={15} />
                  {hasFile ? "다시 만들기" : "보육일지 만들기"}
                </button>
                {/* 이미 만든 파일은 모델을 다시 부르지 않고 그대로 다시 받는다. */}
                {hasFile && (
                  <button
                    className="btn"
                    onClick={downloadAgain}
                    disabled={downloadMutation.isPending}
                  >
                    <Download size={15} />
                    {downloadMutation.isPending
                      ? "내려받는 중…"
                      : "만든 파일 다시 받기"}
                  </button>
                )}
              </div>
              {!hasTemplate && !activeTemplateQuery.isLoading && (
                <div className="mt-1 w-full">
                  <Notice kind="info">
                    위에서 <b>서식을 먼저 올려</b> 주세요 — 서식의 칸에 채워
                    만듭니다.
                  </Notice>
                </div>
              )}
            </div>
          )}

          {downloadMutation.error instanceof ApiError && (
            <div className="mt-3">
              <Notice kind="warn">
                <div>{downloadMutation.error.message}</div>
              </Notice>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
