"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/store";
import {
  useConfirmDocument,
  useDocumentDraft,
  useRegenerateDraft,
  useSaveWorkingCopy,
  useSendDocument,
} from "@/lib/queries";
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
  source,
  allowSend = false,
  sidePanel,
  emptyMessage,
  topic,
  generateLabel = "초안 만들기",
  generateHint,
  canGenerate = true,
}: {
  type: DocType;
  childId?: string | null;
  /** 놀이이야기의 대상 반. 반 단위 문서라 이 값이 근거 기록의 범위를 정한다
   *  — 아이 단위 문서의 `childId`와 같은 자리다. */
  className?: string | null;
  source: React.ReactNode;
  allowSend?: boolean;
  sidePanel?: React.ReactNode;
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
  const draftQuery = useDocumentDraft(type, childId);
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
        { type, childId, content: working },
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
      { type, childId, content: working },
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
      { type, childId },
      {
        onSuccess: () =>
          toast("발송했습니다 — 학부모 화면 시뮬레이션에 노출됩니다"),
      },
    );

  const regen = () =>
    regenMutation.mutate(
      { type, childId, topic, className },
      { onSuccess: () => toast("초안을 새로 만들었습니다") },
    );

  const notFound =
    draftQuery.isError &&
    (draftQuery.error as { status?: number }).status === 404;

  return (
    <>
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
            {doc && (
              <button
                className="btn ml-auto px-2.5 py-1 text-[12.5px]"
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
                {regenMutation.isPending
                  ? "AI가 초안을 쓰는 중… 문서 한 건에 20~40초쯤 걸립니다."
                  : "초안을 불러오는 중…"}
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
                {generateHint ?? (
                  <>
                    왼쪽 원천 기록을 바탕으로 AI가 초안을 씁니다. 20~40초쯤
                    걸리고, 나온 초안은 <b>선생님이 검토·수정한 뒤에</b>{" "}
                    확정합니다.
                  </>
                )}
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
