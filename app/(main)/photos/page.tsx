"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Loader2, Send, UserRoundPlus } from "lucide-react";
import { useApp } from "@/lib/store";
import {
  useAssignPhoto,
  useChildren,
  usePhotoInbox,
  useSendPhotos,
  useUploadPhotos,
} from "@/lib/queries";
import {
  Avatar,
  Modal,
  N,
  Notice,
  PageHead,
  Progress,
  QueryError,
  Skeleton,
  SpecBar,
} from "@/components/ui";
import type { Photo } from "@/lib/types";

function simLabel(p: Photo) {
  if (p.status === "classifying") return "분류 중…";
  if (p.status === "unmatched") return "미분류";
  return p.similarity === null ? "수동 지정" : `${p.similarity}%`;
}

// SCR-005 사진함 — 업로드 → 자동 분류(비동기) → 선택 발송 (FN-006)
export default function PhotosPage() {
  const { toast } = useApp();
  const inboxQuery = usePhotoInbox();
  const childrenQuery = useChildren();
  const uploadMutation = useUploadPhotos();
  const sendMutation = useSendPhotos();
  const assignMutation = useAssignPhoto();

  const [sel, setSel] = useState<number[]>([]);
  const [tab, setTab] = useState<string>("all");
  const [assignTarget, setAssignTarget] = useState<Photo | null>(null);

  const inbox = inboxQuery.data;
  const kids = useMemo(() => childrenQuery.data ?? [], [childrenQuery.data]);
  const childName = (id: string | null) =>
    kids.find((c) => c.id === id)?.name ?? "";

  // 사진이 있는 아이만 탭으로
  const childTabs = useMemo(() => {
    if (!inbox) return [];
    const ids = new Set(
      inbox.photos.filter((p) => p.childId).map((p) => p.childId as string),
    );
    return kids.filter((c) => ids.has(c.id));
  }, [inbox, kids]);

  const visible = (inbox?.photos ?? []).filter((p) => {
    if (tab === "all") return true;
    if (tab === "unmatched") return p.status === "unmatched";
    return p.childId === tab;
  });

  const toggle = (p: Photo) => {
    if (p.status === "unmatched") {
      setAssignTarget(p);
      return;
    }
    if (p.status === "classifying" || p.sent) return;
    setSel((prev) =>
      prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id],
    );
  };

  const upload = () =>
    uploadMutation.mutate(undefined, {
      onSuccess: ({ added }) =>
        toast(`${added}장 업로드 — 배경에서 얼굴 분류를 시작합니다`),
    });

  const sendSelected = () =>
    sendMutation.mutate(sel, {
      onSuccess: ({ sent }) => {
        toast(`선택한 사진 ${sent}장을 발송했습니다`);
        setSel([]);
      },
    });

  const assign = (childId: string) => {
    if (!assignTarget) return;
    assignMutation.mutate(
      { photoId: assignTarget.id, childId },
      {
        onSuccess: () => {
          toast(`${childName(childId)}에게 배정했습니다 (matched_child_id)`);
          setAssignTarget(null);
        },
      },
    );
  };

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

      <div className="stack">
        <div className="card">
          <div className="inline">
            <button
              className="btn primary big"
              onClick={upload}
              disabled={uploadMutation.isPending}
            >
              <N n={1} />
              <Camera size={16} /> 사진 올리기
            </button>
            <div className="min-w-[180px] flex-1">
              <Progress
                value={inbox?.classified ?? 0}
                max={inbox?.total ?? 1}
              />
            </div>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold">
              <N n={2} />
              {inbox
                ? `분류 ${inbox.classified}/${inbox.total}장`
                : "불러오는 중…"}
              {(inbox?.classifying ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber">
                  <Loader2 size={13} className="animate-spin" />
                  {inbox?.classifying}장 분류 중
                </span>
              )}
            </span>
          </div>
          <div className="mt-3">
            <Notice kind="soft">
              분류는 비동기로 진행됩니다 — 화면을 떠나도 계속되고, 10분 넘게
              멈춘 사진은 사진함을 열 때 자동으로 다시 분류됩니다.
            </Notice>
          </div>
        </div>

        <div className="card">
          <div className="phototabs">
            <button
              className={`chip ${tab === "all" ? "on" : ""}`}
              onClick={() => setTab("all")}
            >
              전체 {inbox ? `(${inbox.total})` : ""}
            </button>
            {childTabs.map((c) => (
              <button
                key={c.id}
                className={`chip ${tab === c.id ? "on" : ""}`}
                onClick={() => setTab(c.id)}
              >
                <Avatar name={c.name} color={c.color} size="sm" />
                {c.name}
              </button>
            ))}
            {(inbox?.unmatched ?? 0) > 0 && (
              <button
                className={`chip ${tab === "unmatched" ? "on" : ""} border-[#e9c4bd] text-coral`}
                onClick={() => setTab("unmatched")}
              >
                ⚠ 미분류 ({inbox?.unmatched})
              </button>
            )}
          </div>

          {inboxQuery.isLoading || !inbox ? (
            <Skeleton lines={4} />
          ) : inboxQuery.isError ? (
            <QueryError onRetry={() => inboxQuery.refetch()} />
          ) : (
            <div className="photogrid">
              <AnimatePresence initial={false}>
                {visible.map((p) => (
                  <motion.button
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className={`photo ${sel.includes(p.id) ? "sel" : ""} ${
                      p.status === "unmatched" ? "border-dashed" : ""
                    } ${p.sent ? "dim" : ""}`}
                    onClick={() => toggle(p)}
                    aria-label={`사진 ${p.id} — ${simLabel(p)}`}
                  >
                    <span className="icon">{p.icon}</span>
                    {p.status === "classified" && !p.sent && (
                      <span className="ck">
                        {sel.includes(p.id) ? "✓" : ""}
                      </span>
                    )}
                    {p.sent && (
                      <span className="absolute right-2 top-2 rounded-md bg-confirm-soft px-1.5 py-0.5 text-[10.5px] font-bold text-confirm">
                        발송됨
                      </span>
                    )}
                    <span className="sim">
                      <span>
                        {p.status === "classifying" && (
                          <Loader2
                            size={11}
                            className="mr-1 inline animate-spin"
                          />
                        )}
                        {simLabel(p)}
                      </span>
                      <span>{childName(p.childId)}</span>
                    </span>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}

          <div className="mt-4">
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
              disabled={sendMutation.isPending || sel.length === 0}
            >
              <N n={5} />
              <Send size={14} />
              {sendMutation.isPending
                ? "발송 중…"
                : `선택한 사진 발송${sel.length ? ` (${sel.length})` : ""}`}
            </button>
            <span className="text-[12.5px] text-muted">
              <N n={6} />
              미분류 사진을 누르면 아이를 직접 배정할 수 있어요
            </span>
          </div>
        </div>
      </div>

      <Modal
        open={assignTarget !== null}
        label="아이 수동 지정"
        onClose={() => setAssignTarget(null)}
        wide
      >
        <h3>
          <UserRoundPlus size={16} className="mr-1 inline" />
          아이 수동 지정
        </h3>
        <div className="desc">
          유사도가 낮아 자동 분류되지 못한 사진입니다. 아이를 선택하면{" "}
          <b>matched_child_id</b>로 저장되고, 이후 자동 분류가 덮어쓰지
          않습니다.
        </div>
        <div className="mt-4 grid max-h-[300px] gap-1.5 overflow-y-auto [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
          {kids.map((c) => (
            <button
              key={c.id}
              className="rail-item border border-line"
              onClick={() => assign(c.id)}
              disabled={assignMutation.isPending}
            >
              <Avatar name={c.name} color={c.color} size="sm" />
              {c.name}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
