"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  Sparkles,
  Type,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useApp } from "@/lib/store";
import {
  useActiveTemplate,
  useConfirmDocument,
  useDocumentDraft,
  useRegenerateDraft,
  useSaveWorkingCopy,
  useSendDocument,
} from "@/lib/queries";
import { DocumentCells } from "@/components/document/DocumentCells";
import { DocumentFileBar } from "@/components/document/DocumentFileBar";
import {
  ConfirmDialog,
  EmptyState,
  N,
  Notice,
  QueryError,
  Skeleton,
} from "@/components/ui";
import type { DocType } from "@/lib/types";

/**
 * DocumentWorkbench — 문서 4종 공용 골격 (FN-005 공통 워크플로)
 * 원천 패널 + AI 초안 에디터 + 확정 바.
 * 상태는 서버(DocumentDraft.status)가 단일 원천 — 초안은 EP-010,
 * 작업본 자동 저장은 EP-013(디바운스), 확정은 EP-014, 발송은 EP-015.
 * allowSend: 알림장(SCR-004)만 true — 보육일지·계획안·발달평가서는 확정으로 종료.
 * 불변식: draft 상태에서는 「발송」 버튼이 렌더링되지 않는다.
 */
export function DocumentWorkbench({
  type,
  childId = null,
  className = null,
  date = null,
  source,
  allowSend = false,
  sidePanel,
  topSlot,
  emptyMessage,
  topic,
  generateLabel = "초안 만들기",
  generateHint,
  canGenerate = true,
}: {
  type: DocType;
  childId?: string | null;
  /**
   * 날짜 단위 문서(보육일지)에서 교사가 고른 날. 문서를 가르는 값이라
   * 조회·생성·저장·확정·파일이 **모두 같은 날짜를 들고 가야** 한다 —
   * 한 곳만 빠지면 8월 20일 화면에서 오늘 일지를 고치게 된다.
   */
  date?: string | null;
  /** 놀이이야기의 대상 반. 반 단위 문서라 이 값이 근거 기록의 범위를 정한다
   *  — 아이 단위 문서의 `childId`와 같은 자리다. */
  className?: string | null;
  source: React.ReactNode;
  allowSend?: boolean;
  sidePanel?: React.ReactNode;
  /**
   * 문서 위에 먼저 놓을 줄 — 보육일지의 서식 업로드·한글 파일 내려받기가 여기 온다.
   * 이 자리가 채워지면 아래 「서식 파일로 검토」 카드는 확정 전 갈래를 접는다
   * (같은 내려받기 버튼이 화면에 둘 있으면 어느 쪽이 최신인지 알 수 없다).
   */
  topSlot?: React.ReactNode;
  /** 초안 생성 불가(404) 시 안내 문구 — 알림장의 "하루 기록 없음" 등 */
  emptyMessage?: React.ReactNode;
  /** 계획안·놀이이야기에서 교사가 정한 놀이 주제. 생성 요청에 실려 간다. */
  topic?: string;
  generateLabel?: string;
  /** 「초안 만들기」 위에 띄울 안내 — 계획안의 "주제를 먼저 적으세요" 등 */
  generateHint?: React.ReactNode;
  /** false면 「초안 만들기」를 막는다 — 놀이이야기에서 반을 아직 안 고른 경우.
   *  서버도 400으로 막지만, 누르기 전에 알려 주는 편이 낫다. */
  canGenerate?: boolean;
}) {
  const { toast } = useApp();
  const draftQuery = useDocumentDraft(type, childId, date);
  const saveMutation = useSaveWorkingCopy();
  const confirmMutation = useConfirmDocument();
  const sendMutation = useSendDocument();
  const regenMutation = useRegenerateDraft();

  const doc = draftQuery.data;
  const status = doc?.status ?? "draft";

  const [working, setWorking] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  /** 원천 기록 패널을 접어 문서를 화면 폭 전체로 본다. 시연·긴 문서 검토용. */
  const [wide, setWide] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const editorRef = useRef<HTMLTextAreaElement>(null);

  /**
   * 활성 서식이 있으면 생성이 완전히 다른 작업이 된다 — 칸마다 모델을 불러
   * 실물 서식 11칸에 2~5분, 호출 8~12회다. 서식이 없으면 한 덩어리라 20~40초다.
   * 안내 문구와 진행 표시를 이 값으로 가른다.
   */
  const activeTemplateQuery = useActiveTemplate(type);
  const hasTemplate = activeTemplateQuery.data != null;

  /** 칸이 있는 문서는 칸별 보기가 기본이다. 평문 통편집도 계속 쓸 수 있다. */
  const hasCells = (doc?.cells.length ?? 0) > 0;
  const [cellView, setCellView] = useState(true);
  const showCells = hasCells && cellView;

  /** 생성 경과 — 몇 분짜리 작업이라 "돌고 있다"는 표시만으로는 부족하다 */
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!regenMutation.isPending) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [regenMutation.isPending]);

  // 초안 로드·아이 전환 시 에디터 동기화
  useEffect(() => {
    setWorking(doc ? doc.working : "");
  }, [doc]);

  /**
   * 내용 높이에 맞춰 편집창을 늘린다.
   *
   * 고정 높이(min-h-150px)로 두면 발달평가서처럼 긴 문서가 3~4줄 창에 갇혀
   * 안쪽 스크롤바가 생긴다. 페이지 스크롤과 따로 놀아서 읽기가 불편했다.
   * 창이 내용만큼 자라면 스크롤은 페이지 하나로 끝난다.
   */
  const autoGrow = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(autoGrow, [working, wide, autoGrow]);

  // 작업본 자동 저장 — 입력 멈춤 0.8초 후 EP-013
  useEffect(() => {
    if (!doc || doc.status !== "draft" || working === doc.working) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveMutation.mutate(
        { type, childId, content: working, date },
        {
          onSuccess: () => {
            setSavedTick(true);
            setTimeout(() => setSavedTick(false), 1600);
          },
        },
      );
    }, 800);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working]);

  const confirm = () =>
    confirmMutation.mutate(
      // 칸 단위 문서는 평문을 같이 보내지 않는다 — 칸 저장은 서버 쪽 working만
      // 갱신하므로, 화면이 들고 있던 옛 평문을 보내면 그게 확정본이 된다.
      { type, childId, content: hasCells ? null : working, date },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          toast(
            allowSend
              ? "확정했습니다 — 편집거리를 박제했고, 「발송」이 열렸습니다"
              : "확정했습니다 — 작업본을 final로 저장, 편집거리 박제",
          );
        },
      },
    );

  const send = () =>
    sendMutation.mutate(
      { type, childId, date },
      {
        onSuccess: () =>
          toast("발송했습니다 — 학부모 화면 시뮬레이션에 노출됩니다"),
      },
    );

  const regen = () =>
    regenMutation.mutate(
      { type, childId, topic, className, date },
      { onSuccess: () => toast("초안을 새로 만들었습니다") },
    );

  const notFound =
    draftQuery.isError &&
    (draftQuery.error as { status?: number }).status === 404;

  /**
   * LLM 장애(503)는 "원천 기록이 없다"와 전혀 다른 상황인데, 예전에는 생성
   * 실패가 전부 "아직 초안을 만들 수 없어요"로 뭉개져 교사가 하루 기록을 다시
   * 확인하러 갔다. 서버가 원인을 메시지에 담아 주므로 갈라서 보여 준다.
   */
  const llmUnavailable =
    regenMutation.error instanceof ApiError &&
    regenMutation.error.code === "LLM_UNAVAILABLE";

  return (
    <>
      {topSlot}

      <div className="flowrail">
        {/* 초안이 없으면 첫 단계가 아직 안 끝난 것이다 — 예전에는 늘 done이라
            버튼을 누르기도 전에 "생성 완료"로 보였다. */}
        <span className={`st ${doc ? "done" : "on"}`}>
          <Sparkles size={13} /> 초안 생성
        </span>
        <span className="ln" />
        <span
          className={`st ${!doc ? "" : status === "draft" ? "on" : "done"}`}
        >
          검토·수정
        </span>
        <span className="ln" />
        <span
          className={`st ${status === "confirmed" ? "on" : status === "sent" ? "done" : ""}`}
        >
          확정
        </span>
        {allowSend && (
          <>
            <span className="ln" />
            <span className={`st ${status === "sent" ? "on" : ""}`}>
              {status === "draft" ? "🔒" : ""} 발송
            </span>
          </>
        )}
      </div>

      <div className={wide ? "grid gap-5" : "grid-doc"}>
        {!wide && (
          <div className="card">
            <h2>
              <N n={1} />
              원천 기록 <span className="hint">source_record_ids</span>
            </h2>
            {source}
            <div className="mt-3">
              <Notice kind="soft">
                초안이 어떤 기록에서 나왔는지 나란히 두고 사실과 대조하세요.
              </Notice>
            </div>
          </div>
        )}

        <div className="card">
          <div className="flex min-h-[30px] flex-wrap items-center gap-2">
            {status === "draft" ? (
              <span className="badge-ai">
                <N n={2} />
                🤖 AI 초안
              </span>
            ) : (
              <span className="badge-final">
                <CheckCircle2 size={13} /> 확정본
              </span>
            )}
            <span className="text-[12.5px] text-muted">{doc?.label ?? ""}</span>
            <AnimatePresence>
              {savedTick && (
                <motion.span
                  className="ml-auto text-[11.5px] font-semibold text-confirm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  작업본 저장됨 ✓
                </motion.span>
              )}
            </AnimatePresence>
            {status !== "draft" && doc?.editDistance !== null && (
              <span className="ml-auto rounded-md bg-paper px-2 py-0.5 font-mono text-[11.5px] text-muted">
                편집거리 {doc?.editDistance}%
              </span>
            )}
            {/*
              칸별/평문 전환. 칸 단위 편집이 기본이지만 평문 통편집도 계속
              쓸 수 있어야 한다 — 문서 전체를 한 번에 훑어 고치는 편이 빠른
              경우가 있고, 서버도 두 경로를 모두 받는다(DraftUpdateIn).
            */}
            {hasCells && (
              <button
                className="btn ml-auto px-2.5 py-1 text-[12.5px]"
                onClick={() => setCellView((v) => !v)}
                title={
                  cellView
                    ? "문서 전체를 한 덩어리로 편집"
                    : "서식의 칸별로 나눠 보기"
                }
              >
                {cellView ? <Type size={13} /> : <LayoutGrid size={13} />}
                {cellView ? "평문으로 보기" : "칸별로 보기"}
              </button>
            )}
            {doc && (
              <button
                className={`btn px-2.5 py-1 text-[12.5px] ${hasCells ? "" : "ml-auto"}`}
                onClick={() => setWide((v) => !v)}
                title={wide ? "원천 기록을 다시 보기" : "문서를 넓게 보기"}
              >
                {wide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                {wide ? "나란히 보기" : "넓게 보기"}
              </button>
            )}
          </div>

          {draftQuery.isLoading || regenMutation.isPending ? (
            <div className="draftbox">
              <Skeleton lines={8} />
              <div className="hint">
                {regenMutation.isPending ? (
                  <>
                    {hasTemplate
                      ? "서식의 칸마다 내용을 쓰는 중… 칸이 많으면 2~5분쯤 걸립니다."
                      : "AI가 초안을 쓰는 중… 문서 한 건에 20~40초쯤 걸립니다."}
                    {elapsed > 0 && (
                      <span className="ml-1 font-mono">
                        ({Math.floor(elapsed / 60)}:
                        {String(elapsed % 60).padStart(2, "0")} 경과)
                      </span>
                    )}
                    {hasTemplate && elapsed > 20 && (
                      <div className="mt-1">
                        창을 닫지 말고 기다려 주세요 — 칸을 하나씩 채우고
                        있습니다.
                      </div>
                    )}
                  </>
                ) : (
                  "초안을 불러오는 중…"
                )}
              </div>
            </div>
          ) : llmUnavailable ? (
            /*
              503 LLM_UNAVAILABLE — 메시지에 원인이 담겨 온다("크레딧이
              소진되었습니다" 등). 그대로 보여 주고 **"다시 시도"를 권하지 않는다**:
              재시도해도 똑같이 실패하는 종류라, 버튼을 두면 교사가 원인을 모른 채
              반복해서 누르게 된다.
            */
            <div className="draftbox">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={17}
                  className="mt-0.5 flex-none text-warn"
                />
                <div>
                  <p className="m-0 text-[14px] font-semibold text-ink">
                    지금은 AI 초안을 만들 수 없습니다
                  </p>
                  <p className="mb-0 mt-1.5 text-[13px] leading-relaxed text-muted">
                    {(regenMutation.error as ApiError).message}
                  </p>
                  <p className="mb-0 mt-2 text-[12.5px] text-muted">
                    이 문제는 다시 눌러도 해결되지 않습니다 — 관리자에게 알려
                    주세요. 그동안 문서는 직접 작성해 저장하실 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          ) : notFound || regenMutation.isError ? (
            <EmptyState
              icon="📝"
              title="아직 초안을 만들 수 없어요"
              desc={
                (emptyMessage as string) ??
                "이 문서의 원천 기록이 없습니다. 하루 기록을 먼저 저장해 주세요."
              }
            />
          ) : draftQuery.isError ? (
            <div className="mt-3">
              <QueryError onRetry={() => draftQuery.refetch()} />
            </div>
          ) : !doc ? (
            /* 초안이 없는 상태 — 화면을 연 것만으로 만들지 않는다. 사람이 누른다. */
            <div className="draftbox flex flex-col items-center gap-3 py-10 text-center">
              <span className="text-[26px]">✨</span>
              <p className="m-0 text-[14px] font-semibold text-ink">
                아직 초안이 없습니다
              </p>
              <p className="m-0 max-w-[46ch] text-[13px] leading-relaxed text-muted">
                {generateHint ??
                  (hasTemplate ? (
                    <>
                      등록한 서식의 <b>칸마다</b> AI가 내용을 씁니다 — 칸이
                      많으면 <b>2~5분</b>쯤 걸립니다. 나온 초안은{" "}
                      <b>선생님이 검토·수정한 뒤에</b> 확정합니다.
                    </>
                  ) : (
                    <>
                      왼쪽 원천 기록을 바탕으로 AI가 초안을 씁니다. 20~40초쯤
                      걸리고, 나온 초안은 <b>선생님이 검토·수정한 뒤에</b>{" "}
                      확정합니다.
                    </>
                  ))}
              </p>
              <button
                className="btn primary mt-1"
                onClick={regen}
                disabled={regenMutation.isPending || !canGenerate}
              >
                <Sparkles size={15} />
                {generateLabel}
              </button>
            </div>
          ) : showCells ? (
            <DocumentCells
              type={type}
              childId={childId}
              date={date}
              cells={doc.cells}
              templateId={doc.templateId}
              editable={status === "draft"}
            />
          ) : status === "draft" ? (
            <div className="draftbox">
              <textarea
                ref={editorRef}
                value={working}
                onChange={(e) => setWorking(e.target.value)}
                onInput={autoGrow}
                rows={1}
                className="w-full resize-none overflow-hidden border-0 bg-transparent text-[15px] leading-[1.9] [font-family:inherit] focus:outline-none"
                aria-label="초안 편집"
              />
              <div className="hint">
                <N n={3} />이 영역에서 바로 수정 — 수정 내용은 원본 초안과
                분리된 작업본(working)으로 자동 저장됩니다(EP-013)
              </div>
            </div>
          ) : (
            <motion.div
              className="draftbox confirmed whitespace-pre-wrap text-[15px] leading-[1.9]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {doc?.working}
            </motion.div>
          )}

          {!notFound && doc && (
            <div className="btnrow">
              {status === "draft" && (
                <>
                  <button
                    className="btn primary"
                    onClick={() => setConfirmOpen(true)}
                    disabled={
                      draftQuery.isLoading ||
                      confirmMutation.isPending ||
                      regenMutation.isPending
                    }
                  >
                    <N n={4} />
                    <CheckCircle2 size={14} />
                    확정
                  </button>
                  <button
                    className="btn"
                    onClick={regen}
                    disabled={draftQuery.isLoading || regenMutation.isPending}
                  >
                    <N n={5} />
                    <RefreshCw
                      size={14}
                      className={regenMutation.isPending ? "animate-spin" : ""}
                    />
                    다시 생성
                  </button>
                </>
              )}
              {allowSend && status === "confirmed" && (
                <motion.button
                  className="btn primary"
                  onClick={send}
                  disabled={sendMutation.isPending}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <N n={6} />
                  <Send size={14} />
                  {sendMutation.isPending ? "발송 중…" : "발송"}
                </motion.button>
              )}
              {status === "sent" && (
                <span className="badge-final">📨 발송 완료</span>
              )}
            </div>
          )}

          {allowSend && status === "draft" && !notFound && doc && (
            <div className="mt-3.5">
              <Notice kind="info">
                🔒 「발송」 버튼은 <b>확정 후에만</b> 나타납니다.
              </Notice>
            </div>
          )}
        </div>
      </div>

      {/* 완성 문서 파일 — 확정 뒤에만 나타난다(FN-020). 확정 전에는 스스로 감춘다. */}
      {doc && !notFound && (
        <DocumentFileBar
          type={type}
          childId={childId}
          date={date}
          doc={doc}
          hideDraftCard={topSlot != null}
        />
      )}

      {sidePanel}

      <ConfirmDialog
        open={confirmOpen}
        title="문서를 확정할까요?"
        desc={
          <>
            확정하면 <b>더 이상 수정할 수 없고</b>, 원본 초안 대비 편집거리가
            지표로 박제됩니다.
            {allowSend && " 확정 후 「발송」 버튼이 열립니다."}
          </>
        }
        confirmLabel="확정"
        pending={confirmMutation.isPending}
        onConfirm={confirm}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
