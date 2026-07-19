"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { useApp } from "@/lib/store";
import { usePhotoInbox, useSendPhotos, useUploadPhotos } from "@/lib/queries";
import {
  N,
  Notice,
  PageHead,
  QueryError,
  Skeleton,
  SpecBar,
} from "@/components/ui";

// SCR-005 사진함 — 업로드 → 자동 분류(비동기) → 선택 발송 (FN-006)
export default function PhotosPage() {
  const { toast } = useApp();
  const inboxQuery = usePhotoInbox();
  const uploadMutation = useUploadPhotos();
  const sendMutation = useSendPhotos();

  const [sel, setSel] = useState<number[]>([1, 3]);
  const [tab, setTab] = useState("전체");
  const toggle = (id: number) =>
    setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const inbox = inboxQuery.data;

  const upload = () =>
    uploadMutation.mutate(undefined, {
      onSuccess: () =>
        toast("업로드 즉시 응답 — 배경에서 얼굴 분류를 시작합니다"),
    });

  const sendSelected = () =>
    sendMutation.mutate(sel, {
      onSuccess: ({ sent }) => toast(`선택한 사진 ${sent}장을 발송했습니다`),
    });

  return (
    <>
      <PageHead
        title="사진함"
        sub="업로드 → 아이별 자동 분류(비동기) → 선택 발송"
      />
      <SpecBar
        scr="SCR-005"
        fn={["FN-006"]}
        ep={[
          "EP-016 업로드·재분류",
          "EP-017 조회·폴링",
          "EP-018 수동 지정",
          "EP-019 발송",
        ]}
      />

      <div className="card">
        <div className="inline">
          <button
            className="btn primary big inline-flex items-center gap-2"
            onClick={upload}
            disabled={uploadMutation.isPending}
          >
            <N n={1} />
            <Camera size={16} /> 사진 올리기
          </button>
          <div className="min-w-[180px] flex-1">
            <div className="progress">
              <i
                style={{
                  width: inbox
                    ? `${(inbox.classified / inbox.total) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>
          <span className="text-[13px] font-bold">
            <N n={2} />
            분류 진행 {inbox ? `${inbox.classified}/${inbox.total}` : "…"}장
          </span>
          <button
            className="btn"
            onClick={() => toast("멈춘 사진을 다시 분류 큐에 넣었습니다")}
          >
            분류 다시 시도
          </button>
        </div>
        <div className="mt-2.5">
          <Notice kind="soft">
            10분 넘게 멈춘 사진은 사진함을 열 때 자동으로 다시 분류됩니다.
          </Notice>
        </div>
      </div>

      <div className="card">
        <div className="mb-1">
          <N n={3} />
          <span className="text-xs text-muted">
            아이별 탭 — 유사도 낮은 사진은 미분류로
          </span>
        </div>
        {inboxQuery.isLoading || !inbox ? (
          <Skeleton lines={4} />
        ) : inboxQuery.isError ? (
          <QueryError onRetry={() => inboxQuery.refetch()} />
        ) : (
          <>
            <div className="phototabs">
              {inbox.tabs.map((t) => (
                <button
                  key={t}
                  className={`chip ${tab === t ? "on" : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
              <button
                className={`chip ${tab === "미분류" ? "on" : ""} border-[#E9C4BD] text-coral`}
                onClick={() => setTab("미분류")}
              >
                ⚠ 미분류 (3)
              </button>
            </div>

            <div className="mb-0.5 mt-2.5">
              <N n={4} />
              <span className="text-xs text-muted">
                사진 격자 — 체크박스 + 유사도(%)
              </span>
            </div>
            <div className="photogrid">
              {inbox.photos
                .filter((p) => tab !== "미분류" || p.unmatched)
                .map((p) => (
                  <button
                    key={p.id}
                    className={`photo ${sel.includes(p.id) ? "sel" : ""} ${p.unmatched ? "border-dashed" : ""}`}
                    onClick={() => toggle(p.id)}
                  >
                    <span className="icon">{p.icon}</span>
                    <span className="ck">{sel.includes(p.id) ? "✓" : ""}</span>
                    <span className="sim">{p.similarity}</span>
                  </button>
                ))}
            </div>
          </>
        )}

        <div className="mt-3">
          <Notice kind="warn">
            ⚠{" "}
            <span>
              얼굴 임베딩은 생체인식정보(민감정보)입니다. 연습용 사진만
              올리세요.
            </span>
          </Notice>
        </div>
        <div className="btnrow">
          <button
            className="btn primary"
            onClick={sendSelected}
            disabled={sendMutation.isPending}
          >
            <N n={5} />
            {sendMutation.isPending ? "발송 중…" : "선택한 사진 발송"}
          </button>
          <button
            className="btn"
            onClick={() =>
              toast("아이를 골라 직접 배정하세요 (matched_child_id)")
            }
          >
            <N n={6} />
            아이 수동 지정
          </button>
        </div>
      </div>
    </>
  );
}
