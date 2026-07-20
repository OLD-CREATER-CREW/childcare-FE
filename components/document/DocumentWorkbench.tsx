"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, RefreshCw, Send, Sparkles } from "lucide-react";
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
  source,
  allowSend = false,
  sidePanel,
  emptyMessage,
}: {
  type: DocType;
  childId?: string | null;
  source: React.ReactNode;
  allowSend?: boolean;
  sidePanel?: React.ReactNode;
  /** 초안 생성 불가(404) 시 안내 문구 — 알림장의 "하루 기록 없음" 등 */
  emptyMessage?: React.ReactNode;
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 초안 로드·아이 전환 시 에디터 동기화
  useEffect(() => {
    if (doc) setWorking(doc.working);
  }, [doc]);

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
      { type, childId },
      { onSuccess: () => toast("초안을 새로 만들었습니다") },
    );

  const notFound =
    draftQuery.isError &&
    (draftQuery.error as { status?: number }).status === 404;

  return (
    <>
      <div className="flowrail">
        <span className="st done">
          <Sparkles size={13} /> 초안 생성
        </span>
        <span className="ln" />
        <span className={`st ${status === "draft" ? "on" : "done"}`}>
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

      <div className="grid2">
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
          </div>

          {draftQuery.isLoading || regenMutation.isPending ? (
            <div className="draftbox">
              <Skeleton lines={4} />
              <div className="hint">
                {regenMutation.isPending
                  ? "AI가 초안을 다시 쓰는 중…"
                  : "AI 초안을 불러오는 중…"}
              </div>
            </div>
          ) : notFound ? (
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
          ) : status === "draft" ? (
            <div className="draftbox">
              <textarea
                value={working}
                onChange={(e) => setWorking(e.target.value)}
                className="min-h-[150px] w-full resize-y border-0 bg-transparent leading-[1.75] [font:inherit] focus:outline-none"
                aria-label="초안 편집"
              />
              <div className="hint">
                <N n={3} />이 영역에서 바로 수정 — 수정 내용은 원본 초안과
                분리된 작업본(working)으로 자동 저장됩니다(EP-013)
              </div>
            </div>
          ) : (
            <motion.div
              className="draftbox confirmed whitespace-pre-wrap leading-[1.75]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {doc?.working}
            </motion.div>
          )}

          {!notFound && (
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

          {allowSend && status === "draft" && !notFound && (
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
