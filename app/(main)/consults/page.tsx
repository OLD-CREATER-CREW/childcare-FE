"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Mic } from "lucide-react";
import { useApp } from "@/lib/store";
import { useChildren, useConfirmConsult, useConsults } from "@/lib/queries";
import {
  Avatar,
  ConfirmDialog,
  EmptyState,
  N,
  Notice,
  PageHead,
  QueryError,
  Skeleton,
  SpecBar,
} from "@/components/ui";

// SCR-010 상담일지 — 녹음/텍스트 → 3단 요약 → 히스토리 (FN-009)
export default function ConsultsPage() {
  const { toast } = useApp();
  const childrenQuery = useChildren();
  const [childId, setChildId] = useState("c01");
  const consultQuery = useConsults(childId);
  const confirmMutation = useConfirmConsult();

  const [draft, setDraft] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const data = consultQuery.data;
  const current = data?.current ?? null;
  const kids = childrenQuery.data ?? [];

  useEffect(() => {
    if (current) setDraft(current.summaryDraft || current.summaryFinal || "");
  }, [current]);

  const confirm = () => {
    if (!current) return;
    confirmMutation.mutate(
      { id: current.id, summary: draft },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          toast("확정 — 아이별 히스토리에 시간순으로 추가됩니다");
        },
      },
    );
  };

  return (
    <>
      <PageHead
        title="상담일지"
        sub="녹음/텍스트 → 3단 요약(핵심·요청사항·후속조치) → 히스토리"
      />
      <SpecBar
        scr="SCR-010"
        fn={["FN-009", "FN-005"]}
        ep={["EP-024 업로드", "EP-025 확정", "EP-006 히스토리"]}
      />

      <div className="mb-4">
        <Notice kind="warn">
          ⚠{" "}
          <span>
            <b>실제 상담 녹음을 올리지 마세요 — 연습용 녹음·텍스트만.</b> 상담
            녹음은 외부 음성 변환(STT)으로 전송되는 최고 민감 데이터입니다.
          </span>
        </Notice>
      </div>

      <div className="stack">
        <div className="card">
          <div className="inline">
            <div className="field m-0">
              <label>
                <N n={1} />
                아이
              </label>
              <select
                className="input"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
              >
                {(kids.length ? kids : [{ id: "c01", name: "김민준" }]).map(
                  (c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ),
                )}
              </select>
            </div>
            <button
              className="btn primary"
              onClick={() =>
                toast("업로드 즉시 응답 — 배경에서 STT 실행 후 요약을 만듭니다")
              }
            >
              <N n={2} />
              <Mic size={14} /> 녹음 파일 올리기
            </button>
            <button
              className="btn"
              onClick={() => toast("STT 건너뛰고 바로 3단 요약을 만듭니다")}
            >
              <N n={3} />
              <FileText size={14} /> 텍스트 붙여넣기
            </button>
            <span className="text-[12.5px] text-muted">
              m4a·mp3·wav · <b>25MB·약 20분까지</b>
            </span>
          </div>
        </div>

        {consultQuery.isError ? (
          <QueryError onRetry={() => consultQuery.refetch()} />
        ) : !consultQuery.isLoading && !current ? (
          <div className="card">
            <EmptyState
              icon="🎙️"
              title="아직 상담 기록이 없어요"
              desc="녹음 파일을 올리거나 텍스트를 붙여넣으면 3단 요약 초안이 만들어집니다."
            />
          </div>
        ) : (
          <div className="grid2">
            <div className="card">
              <h2>
                <N n={4} />
                변환된 글 (transcript)
                <span className="hint">
                  {current ? `${current.date} · ${current.topic}` : ""}
                </span>
              </h2>
              {consultQuery.isLoading ? (
                <Skeleton lines={4} />
              ) : (
                <div className="flex flex-col gap-2 rounded-xl bg-paper px-4 py-3.5 text-[13.5px] leading-[1.7]">
                  {current?.transcript.map((t, i) => (
                    <p key={i} className="m-0">
                      <b
                        className={
                          t.speaker === "교사" ? "text-green-deep" : "text-blue"
                        }
                      >
                        {t.speaker}
                      </b>{" "}
                      {t.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              {current?.status === "draft" ? (
                <span className="badge-ai">
                  <N n={5} />
                  🤖 3단 요약 초안
                </span>
              ) : (
                <span className="badge-final">
                  <CheckCircle2 size={13} /> 확정본
                </span>
              )}
              {consultQuery.isLoading ? (
                <div className="draftbox">
                  <Skeleton lines={3} />
                </div>
              ) : current?.status === "draft" ? (
                <div className="draftbox">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="min-h-[120px] w-full resize-y border-0 bg-transparent leading-[1.75] [font:inherit] focus:outline-none"
                    aria-label="3단 요약 편집"
                  />
                  <div className="hint">
                    <N n={6} />
                    눌러서 수정 — 핵심·요청사항·후속조치 3단 구조를 유지하세요
                  </div>
                </div>
              ) : (
                <div className="draftbox confirmed whitespace-pre-wrap leading-[1.75]">
                  {current?.summaryFinal}
                </div>
              )}
              {current?.status === "draft" && (
                <div className="btnrow">
                  <button
                    className="btn primary"
                    onClick={() => setConfirmOpen(true)}
                    disabled={
                      consultQuery.isLoading || confirmMutation.isPending
                    }
                  >
                    <N n={7} />
                    <CheckCircle2 size={14} /> 확정
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="card">
          <h2>
            <N n={8} />
            {kids.find((c) => c.id === childId)?.name ?? ""} · 상담 히스토리
          </h2>
          {consultQuery.isLoading ? (
            <Skeleton lines={2} />
          ) : (data?.history.length ?? 0) === 0 ? (
            <div className="py-2 text-[13px] text-muted">
              확정된 상담 기록이 아직 없습니다.
            </div>
          ) : (
            <table className="tbl rowhover">
              <thead>
                <tr>
                  <th className="w-24">날짜</th>
                  <th className="w-32">주제</th>
                  <th>요약</th>
                  <th className="w-20">상태</th>
                </tr>
              </thead>
              <tbody>
                {data?.history.map((h) => (
                  <tr key={h.id}>
                    <td className="font-mono text-[12.5px]">{h.date}</td>
                    <td className="font-semibold">{h.topic}</td>
                    <td className="text-[13px] text-muted">
                      {(h.summaryFinal ?? h.summaryDraft)
                        .split("\n")[0]
                        ?.replace("핵심 — ", "")}
                    </td>
                    <td>
                      {h.status === "confirmed" ? (
                        <span className="tag dom">확정</span>
                      ) : (
                        <span className="tag daily">초안</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="상담 요약을 확정할까요?"
        desc="확정하면 수정할 수 없고, 아이별 히스토리에 시간순으로 기록됩니다."
        confirmLabel="확정"
        pending={confirmMutation.isPending}
        onConfirm={confirm}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
