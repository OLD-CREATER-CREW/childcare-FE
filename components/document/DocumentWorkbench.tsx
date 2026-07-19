"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import {
  useConfirmDocument,
  useDocumentDraft,
  useSendDocument,
} from "@/lib/queries";
import { N, Notice, QueryError, Skeleton } from "@/components/ui";
import type { DocStatus, DocType } from "@/lib/types";

/**
 * DocumentWorkbench — 문서 4종 공용 골격 (FN-005 공통 워크플로)
 * 원천 패널 + AI 초안 에디터 + 확정 바.
 * 초안은 EP-010(useDocumentDraft), 확정은 EP-014, 발송은 EP-015 뮤테이션으로 연결.
 * allowSend: 알림장(SCR-004)만 true — 보육일지·계획안·발달평가서는 확정으로 종료.
 * 불변식: draft 상태에서는 「발송」 버튼이 렌더링되지 않는다.
 */
export function DocumentWorkbench({
  type,
  source,
  allowSend = false,
  sidePanel,
}: {
  type: DocType;
  source: React.ReactNode;
  allowSend?: boolean;
  sidePanel?: React.ReactNode;
}) {
  const { toast } = useApp();
  const draftQuery = useDocumentDraft(type);
  const confirmMutation = useConfirmDocument();
  const sendMutation = useSendDocument();

  const [status, setStatus] = useState<DocStatus>("draft");
  const [draft, setDraft] = useState("");

  // 초안 로드 시 에디터 초기화
  useEffect(() => {
    if (draftQuery.data) setDraft(draftQuery.data.content);
  }, [draftQuery.data]);

  const confirm = () => {
    if (!window.confirm("확정하면 수정할 수 없습니다. 계속할까요?")) return;
    confirmMutation.mutate(
      { type, content: draft },
      {
        onSuccess: () => {
          setStatus("confirmed");
          toast(
            allowSend
              ? "확정했습니다 — 작업본을 final로 저장, 편집거리 박제. 「발송」이 열렸습니다"
              : "확정했습니다 — 작업본을 final로 저장, 편집거리 박제",
          );
        },
      },
    );
  };

  const send = () => {
    sendMutation.mutate(type, {
      onSuccess: () => {
        setStatus("sent");
        toast("발송했습니다 — 학부모 화면 시뮬레이션에 노출됩니다");
      },
    });
  };

  const regen = () => toast("초안을 다시 만드는 중입니다…");

  return (
    <>
      <div className="flowrail">
        <span className="st done">초안 생성</span>
        <span className="ln" />
        <span className={`st ${status === "draft" ? "on" : "done"}`}>
          검토·수정
        </span>
        <span className="ln" />
        <span className={`st ${status !== "draft" ? "on" : ""}`}>확정</span>
        {allowSend && (
          <>
            <span className="ln" />
            <span className={`st ${status !== "draft" ? "on" : ""}`}>
              <span className="lock">{status === "draft" ? "🔒" : "🔓"}</span>{" "}
              발송
            </span>
          </>
        )}
      </div>

      <div className="grid2">
        <div className="card">
          <h2>
            <N n={1} />
            원천 기록{" "}
            <span className="text-xs font-normal text-muted">
              source_record_ids
            </span>
          </h2>
          {source}
          <Notice kind="soft">
            초안이 어떤 기록에서 나왔는지 나란히 두고 사실과 대조하세요.
          </Notice>
        </div>

        <div className="card">
          <div className="flex items-center gap-2">
            {status === "draft" ? (
              <span className="badge-ai">
                <N n={2} />
                🤖 AI 초안
              </span>
            ) : (
              <span className="badge-final">✅ 확정본</span>
            )}
            <span className="text-[12.5px] text-muted">
              {draftQuery.data?.label ?? ""}
            </span>
          </div>

          {draftQuery.isLoading ? (
            <div className="draftbox">
              <Skeleton lines={4} />
              <div className="hint">AI 초안을 불러오는 중…</div>
            </div>
          ) : draftQuery.isError ? (
            <div className="mt-2.5">
              <QueryError onRetry={() => draftQuery.refetch()} />
            </div>
          ) : status === "draft" ? (
            <div className="draftbox">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[120px] w-full resize-y border-0 bg-transparent leading-[1.7] [font:inherit] focus:outline-none"
              />
              <div className="hint">
                <N n={3} />이 영역에서 바로 수정 — 수정 내용은 원본 초안과
                분리된 작업본(working)으로 저장됩니다(EP-013)
              </div>
            </div>
          ) : (
            <div className="draftbox confirmed whitespace-pre-wrap">
              {draft}
            </div>
          )}

          <div className="btnrow">
            {status === "draft" && (
              <>
                <button
                  className="btn primary"
                  onClick={confirm}
                  disabled={draftQuery.isLoading || confirmMutation.isPending}
                >
                  <N n={4} />
                  {confirmMutation.isPending ? "확정 중…" : "확정"}
                </button>
                <button
                  className="btn"
                  onClick={regen}
                  disabled={draftQuery.isLoading}
                >
                  <N n={5} />
                  다시 생성
                </button>
              </>
            )}
            {allowSend && status === "confirmed" && (
              <button
                className="btn primary"
                onClick={send}
                disabled={sendMutation.isPending}
              >
                <N n={6} />
                {sendMutation.isPending ? "발송 중…" : "발송"}
              </button>
            )}
            {status === "sent" && (
              <span className="badge-final">📨 발송 완료</span>
            )}
          </div>

          {allowSend && status === "draft" && (
            <div className="mt-3">
              <Notice kind="info">
                🔒 「발송」 버튼은 <b>확정 후에만</b> 나타납니다.
              </Notice>
            </div>
          )}
        </div>
      </div>

      {sidePanel}
    </>
  );
}
