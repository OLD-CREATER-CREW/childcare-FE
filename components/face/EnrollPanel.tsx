"use client";

/**
 * 얼굴 등록 패널 (SCR-005 사진함 › 등록 탭).
 *
 * 아이 1명당 사진 3~5장 → 서버가 대표 임베딩 1개를 만들어 돌려주고, 그것을 반
 * 갤러리에 넣는다. 서버는 사진도 임베딩도 저장하지 않으므로 **갤러리에 넣는 것은
 * 이 화면의 책임**이다.
 *
 * 반 선택·갤러리 상태·서버 연결 경고는 부모(사진함 페이지)가 갖고 있다 —
 * 분류 탭과 같은 갤러리를 봐야 하기 때문이다.
 *
 * 담당: 손승현(ml)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ImagePlus, Loader2, Trash2, UserRoundPlus, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useApp } from "@/lib/store";
import { MAX_ENROLL_FILES, enrollChild } from "@/lib/face";
import type { UseGalleryResult } from "@/lib/face";
import type { Child } from "@/lib/types";
import { ConfirmDialog, EmptyState, N, Notice, Progress } from "@/components/ui";

/** 실측에서 1~2장만 등록한 아이는 유사도가 눈에 띄게 낮았다 */
const RECOMMENDED_MIN = 3;
const RECOMMENDED_MAX = 5;

type Pick = { file: File; url: string };

/** 같은 사진을 두 번 고르는 실수를 막는다 — 이름+크기면 충분하다 */
const pickId = (f: File) => `${f.name}:${f.size}`;

export function EnrollPanel({
  kids,
  gallery,
}: {
  kids: Child[];
  gallery: UseGalleryResult;
}) {
  const { toast } = useApp();
  const [childId, setChildId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enrolledCount = kids.filter((k) => gallery.isEnrolled(k.id)).length;
  const child = kids.find((c) => c.id === childId) ?? null;
  const alreadyEnrolled = child ? gallery.isEnrolled(child.id) : false;

  // 미리보기 URL은 만든 쪽이 되돌린다. 안 그러면 사진을 고를 때마다 메모리가 샌다.
  const clearPicks = useCallback((next: Pick[] = []) => {
    setPicks((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return next;
    });
  }, []);

  // 다른 아이로 옮기면 고른 사진은 의미가 없다
  useEffect(() => {
    clearPicks();
  }, [childId, clearPicks]);

  useEffect(() => () => clearPicks(), [clearPicks]);

  // 반이 바뀌어 선택한 아이가 목록에서 사라지면 선택을 놓는다
  useEffect(() => {
    if (childId && !kids.some((c) => c.id === childId)) setChildId(null);
  }, [kids, childId]);

  const addFiles = (incoming: File[]) => {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    // updater 안에서 부수효과(objectURL 생성·토스트)를 내지 않는다 —
    // StrictMode에서 두 번 실행돼 URL이 새고, 결과를 바깥에서 바로 읽을 수도 없다.
    const seen = new Set(picks.map((p) => pickId(p.file)));
    const added: Pick[] = [];
    let dropped = 0;
    images.forEach((f) => {
      if (seen.has(pickId(f))) return;
      if (picks.length + added.length >= MAX_ENROLL_FILES) {
        dropped += 1;
        return;
      }
      seen.add(pickId(f));
      added.push({ file: f, url: URL.createObjectURL(f) });
    });
    if (dropped > 0) toast(`등록 사진은 최대 ${MAX_ENROLL_FILES}장입니다`);
    if (added.length === 0) return;
    setPicks((prev) => prev.concat(added));
  };

  const removePick = (id: string) =>
    setPicks((prev) =>
      prev.filter((p) => {
        if (pickId(p.file) !== id) return true;
        URL.revokeObjectURL(p.url);
        return false;
      }),
    );

  const submit = async () => {
    if (!child || picks.length === 0) return;
    setEnrolling(true);
    try {
      // maxSide를 주지 않으면 원본을 보낸다 — 임계값이 확정되기 전까지의 기본값이다
      const res = await enrollChild(picks.map((p) => p.file));

      if (res.status === "no_face" || !res.embedding) {
        toast(
          `${child.name} — 고른 사진 ${picks.length}장에서 얼굴을 찾지 못했습니다. 얼굴이 크고 정면에 가까운 사진으로 바꿔 보세요.`,
        );
        return;
      }

      await gallery.enroll(child.id, res.embedding);
      clearPicks();
      toast(
        res.skipped > 0
          ? `${child.name} 등록 완료 — ${res.used}장 사용, ${res.skipped}장은 얼굴을 못 찾아 건너뜀`
          : `${child.name} 등록 완료 — 사진 ${res.used}장 사용`,
      );
    } catch (e) {
      toast(
        e instanceof ApiError
          ? e.message
          : "등록에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setEnrolling(false);
    }
  };

  const doForget = async () => {
    if (!child) return;
    await gallery.forget(child.id);
    setConfirmForget(false);
    toast(`${child.name}의 얼굴 정보를 파기했습니다`);
  };

  return (
    <>
      <div className="grid2">
        {/* ---------------- 왼쪽: 아이 목록 ---------------- */}
        <div className="card">
          <h2>
            <UserRoundPlus size={16} /> 아이 목록
            <span className="hint">등록 {enrolledCount}/{kids.length}명</span>
          </h2>

          <div className="mb-3">
            <Progress value={enrolledCount} max={kids.length || 1} />
          </div>

          {kids.length === 0 ? (
            <EmptyState
              icon={<UserRoundPlus size={22} />}
              title="이 반에 아이가 없습니다"
              desc="아동 관리(SCR-016)에서 아이를 등록하고 반을 지정하세요."
            />
          ) : (
            <div className="rail">
              {kids.map((c) => {
                const done = gallery.isEnrolled(c.id);
                return (
                  <button
                    key={c.id}
                    className={`rail-item ${childId === c.id ? "on" : ""}`}
                    onClick={() => setChildId(c.id)}
                  >
                    <span
                      className="avatar"
                      style={{ background: c.color }}
                      aria-hidden
                    >
                      {c.name.slice(-2, -1) || c.name.slice(0, 1)}
                    </span>
                    {c.name}
                    <span className="meta">
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-green-deep">
                          <Check size={13} /> 등록됨
                        </span>
                      ) : (
                        "미등록"
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ---------------- 오른쪽: 등록 패널 ---------------- */}
        <div className="card">
          <h2>
            <ImagePlus size={16} />
            {child ? `${child.name} 등록 사진` : "아이를 고르세요"}
            {alreadyEnrolled && (
              <span className="hint">이미 등록됨 — 다시 등록하면 덮어씁니다</span>
            )}
          </h2>

          {!child ? (
            <EmptyState
              icon={<UserRoundPlus size={22} />}
              title="왼쪽에서 아이를 선택하세요"
              desc="아이 한 명당 사진 3~5장을 올리면 대표 얼굴 하나가 만들어집니다."
            />
          ) : (
            <>
              <div
                className="rounded-xl border border-dashed border-line-strong bg-paper px-5 py-7 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(Array.from(e.dataTransfer.files));
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []));
                    e.target.value = ""; // 같은 파일을 다시 골라도 change가 뜨도록
                  }}
                />
                <button
                  className="btn primary big"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={picks.length >= MAX_ENROLL_FILES}
                >
                  <ImagePlus size={16} /> 사진 고르기
                </button>
                <div className="mt-3 text-[12.5px] text-muted">
                  끌어다 놓아도 됩니다 · 권장 {RECOMMENDED_MIN}~{RECOMMENDED_MAX}장,
                  최대 {MAX_ENROLL_FILES}장
                </div>
              </div>

              {picks.length > 0 && (
                <div className="photogrid">
                  <AnimatePresence initial={false}>
                    {picks.map((p) => (
                      <motion.div
                        key={pickId(p.file)}
                        layout
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="photo cursor-default"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.file.name}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md border border-line-strong bg-white/90 text-ink"
                          aria-label={`${p.file.name} 빼기`}
                          onClick={() => removePick(pickId(p.file))}
                        >
                          <X size={13} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              <div className="mt-4">
                <Notice kind="soft">
                  <N n={3} />
                  <span>
                    사진마다 <b>가장 큰 얼굴</b>을 이 아이로 봅니다 — 여러 명이
                    나온 사진은 피하고, 아이가 크고 정면에 가깝게 나온 사진을
                    고르세요. 표정·각도·날짜가 다양할수록 좋습니다.
                  </span>
                </Notice>
              </div>

              {picks.length > 0 && picks.length < RECOMMENDED_MIN && (
                <div className="mt-2">
                  <Notice kind="warn">
                    ⚠{" "}
                    <span>
                      {picks.length}장만으로도 등록은 되지만, 실측에서 1~2장만
                      등록한 아이는 유사도가 눈에 띄게 낮았습니다 —{" "}
                      {RECOMMENDED_MIN}장 이상을 권합니다.
                    </span>
                  </Notice>
                </div>
              )}

              <div className="btnrow">
                <button
                  className="btn primary"
                  onClick={submit}
                  disabled={enrolling || picks.length === 0 || gallery.saving}
                >
                  <N n={4} />
                  {enrolling ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> 등록 중…
                    </>
                  ) : (
                    `${alreadyEnrolled ? "다시 등록" : "등록"} (${picks.length}장)`
                  )}
                </button>
                {picks.length > 0 && (
                  <button className="btn ghost" onClick={() => clearPicks()}>
                    선택 비우기
                  </button>
                )}
                {alreadyEnrolled && (
                  <button
                    className="btn danger"
                    onClick={() => setConfirmForget(true)}
                  >
                    <Trash2 size={14} /> 얼굴 정보 파기
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmForget}
        title="얼굴 정보를 파기할까요?"
        desc={
          <>
            {child?.name}의 얼굴 임베딩을 갤러리에서 지웁니다. 이후 이 아이는 사진
            자동 분류에서 빠지며, 되돌리려면 사진을 다시 등록해야 합니다.
          </>
        }
        confirmLabel="파기"
        danger
        pending={gallery.saving}
        onConfirm={doForget}
        onClose={() => setConfirmForget(false)}
      />
    </>
  );
}
