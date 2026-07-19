"use client";

import { useEffect, useState } from "react";
import { FileText, Mic } from "lucide-react";
import { useApp } from "@/lib/store";
import { useConfirmConsult, useConsultData } from "@/lib/queries";
import {
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
  const consultQuery = useConsultData();
  const confirmMutation = useConfirmConsult();

  const [status, setStatus] = useState<"draft" | "confirmed">("draft");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (consultQuery.data) setDraft(consultQuery.data.summaryDraft);
  }, [consultQuery.data]);

  const confirm = () => {
    if (!window.confirm("확정하면 수정할 수 없습니다. 계속할까요?")) return;
    confirmMutation.mutate(draft, {
      onSuccess: () => {
        setStatus("confirmed");
        toast("확정 — 아이별 히스토리에 시간순으로 추가됩니다");
      },
    });
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

      <div className="mb-3.5">
        <Notice kind="warn">
          ⚠{" "}
          <span>
            <b>실제 상담 녹음을 올리지 마세요 — 연습용 녹음·텍스트만.</b> 상담
            녹음은 외부 음성 변환(STT)으로 전송되는 최고 민감 데이터입니다.
            (화면 최상단 상시 고정)
          </span>
        </Notice>
      </div>

      <div className="card">
        <div className="inline">
          <div className="field m-0">
            <label>
              <N n={1} />
              아이
            </label>
            <select className="input">
              <option>김민준</option>
            </select>
          </div>
          <button
            className="btn primary inline-flex items-center gap-1.5"
            onClick={() =>
              toast("업로드 즉시 응답 — 배경에서 STT 실행 후 요약을 만듭니다")
            }
          >
            <N n={2} />
            <Mic size={14} /> 녹음 파일 올리기
          </button>
          <button
            className="btn inline-flex items-center gap-1.5"
            onClick={() => toast("STT 건너뛰고 바로 3단 요약을 만듭니다")}
          >
            <N n={3} />
            <FileText size={14} /> 텍스트 붙여넣기
          </button>
          <span className="text-[12.5px] text-muted">
            m4a·mp3·wav · <b>25MB·약 20분까지</b> — 초과 시 나눠 올리거나
            텍스트로
          </span>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>
            <N n={4} />
            변환된 글 (transcript)
          </h2>
          {consultQuery.isLoading ? (
            <Skeleton lines={3} />
          ) : consultQuery.isError ? (
            <QueryError onRetry={() => consultQuery.refetch()} />
          ) : (
            <div className="rounded-[10px] bg-paper px-3.5 py-3 text-[13.5px] leading-[1.75] text-[#3d4a42]">
              {consultQuery.data?.transcript.map((t, i) => (
                <p key={i} className="m-0">
                  <b>{t.speaker}:</b> {t.text}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          {status === "draft" ? (
            <span className="badge-ai">
              <N n={5} />
              🤖 3단 요약 초안
            </span>
          ) : (
            <span className="badge-final">✅ 확정본</span>
          )}
          {consultQuery.isLoading ? (
            <div className="draftbox">
              <Skeleton lines={3} />
            </div>
          ) : status === "draft" ? (
            <div className="draftbox">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[110px] w-full resize-y border-0 bg-transparent leading-[1.7] [font:inherit] focus:outline-none"
              />
              <div className="hint">
                <N n={6} />
                눌러서 수정
              </div>
            </div>
          ) : (
            <div className="draftbox confirmed whitespace-pre-wrap">
              {draft}
            </div>
          )}
          <div className="btnrow">
            {status === "draft" && (
              <button
                className="btn primary"
                onClick={confirm}
                disabled={consultQuery.isLoading || confirmMutation.isPending}
              >
                <N n={7} />
                {confirmMutation.isPending ? "확정 중…" : "확정"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>
          <N n={8} />
          김민준 · 상담 히스토리
        </h2>
        {consultQuery.isLoading ? (
          <Skeleton lines={1} />
        ) : (
          <div className="chiprow">
            {consultQuery.data?.history.map((h) => (
              <span key={h.date} className={`chip ${h.active ? "on" : ""}`}>
                {h.date} {h.topic}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
