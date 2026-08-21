"use client";

/**
 * 사진 분류 패널 (SCR-005 사진함 › 분류 탭).
 *
 * ■ v2에서 달라진 것: 분류를 **앱이 주도한다**
 * 예전 흐름은 "사진을 서버에 올리면 서버가 알아서 분류하고 앱은 폴링한다"였다.
 * 무상태 서버에는 임베딩도 사진도 없으므로, 이제 앱이 반 갤러리를 들고 사진을
 * 한 장씩 보내 결과를 받는다. 폴링할 대상이 없고 진행률은 앱이 직접 센다.
 *
 * ■ 한 장씩 보내는 이유
 * 한 요청에 다 담으면 타임아웃에 걸리고 중간에 실패하면 전부 다시 해야 한다.
 * 장 단위로 끊으면 실패한 장만 재시도하면 되고, 끝난 사진부터 화면에 뜬다.
 * 1장당 약 1초라 100장이면 100초 — 진행률과 취소가 없으면 못 쓴다.
 *
 * ■ 사진은 이 PC에만 있다
 * 서버는 추론 후 사진을 폐기하고 아무것도 저장하지 않는다. 학부모 공유는 교사가
 * 키즈노트에 직접 올리므로, 마지막 단계는 발송이 아니라 아이별 폴더로 내보내기다.
 *
 * 담당: 손승현(ml)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CircleSlash,
  FolderDown,
  Loader2,
  RotateCcw,
  UserRoundPlus,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useApp } from "@/lib/store";
import { classifyPhoto } from "@/lib/face";
import type { EmbeddingB64, UseGalleryResult } from "@/lib/face";
import type { Child } from "@/lib/types";
import {
  Avatar,
  EmptyState,
  Modal,
  N,
  Notice,
  Progress,
} from "@/components/ui";

type ShotStatus =
  | "pending"
  | "classifying"
  | "classified"
  | "unmatched"
  | "failed";

type Shot = {
  id: string;
  file: File;
  url: string;
  status: ShotStatus;
  /** 배정된 아이 — "사진 1장 = 여러 아이" 라 배열이다 */
  childIds: string[];
  /** child_id → 코사인 유사도. 수동 지정한 건 값이 없다 */
  similarity: Record<string, number>;
  facesDetected: number;
  /** 갤러리에서 못 찾은 얼굴 중 가장 높았던 점수 — 임계값 판단 근거 */
  bestUnmatched?: number;
  /** 미분류 얼굴의 임베딩. 교사가 아이를 지정하면 서버 왕복 없이 갤러리에 넣는다 */
  unmatchedEmbedding?: EmbeddingB64;
  /** 미분류 얼굴 수. 2개 이상이면 어느 얼굴이 누구인지 알 수 없어 자동 등록하지 않는다 */
  unmatchedCount: number;
  error?: string;
  exported?: boolean;
};

/**
 * ★ 분류 임계값 — 값을 바꾸려면 여기만 고치면 된다.
 *
 * 코사인 유사도가 이 값 이상일 때만 그 아이로 배정한다.
 *   - 낮추면  더 많이 배정된다. 대신 **오배정**이 늘어난다 (0.41에서 오배정 발생)
 *   - 올리면  오배정은 줄지만 **정상 매칭까지 잘려나간다** (0.60에서 검출 27 → 배정 4)
 *
 * 서버 기본값은 0.35(`DEFAULT_THRESHOLD`)지만 여기서 명시적으로 덮어쓴다.
 * 아직 확정값이 아니다 — answers.csv(정답표)로 정확도를 수치화한 뒤 다시 정한다.
 */
const CLASSIFY_THRESHOLD = 0.50;

const shotId = (f: File) => `${f.name}:${f.size}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** 폴더·파일 이름에 못 쓰는 문자를 걷어낸다 */
const safeName = (s: string) =>
  s.replace(/[\\/:*?"<>|]/g, "_").trim() || "이름없음";

// File System Access API — Chromium(Electron 포함)에만 있다. 표준 타입에 아직 없어 직접 좁게 선언한다.
type FileWriter = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};
type FileHandle = { createWritable: () => Promise<FileWriter> };
type DirHandle = {
  getDirectoryHandle: (
    name: string,
    o?: { create?: boolean },
  ) => Promise<DirHandle>;
  getFileHandle: (name: string, o?: { create?: boolean }) => Promise<FileHandle>;
};
type PickerWindow = Window & { showDirectoryPicker?: () => Promise<DirHandle> };

const TAB_ALL = "__all__";
const TAB_UNMATCHED = "__unmatched__";

export function ClassifyPanel({
  kids,
  gallery,
}: {
  kids: Child[];
  gallery: UseGalleryResult;
}) {
  const { toast } = useApp();
  const [shots, setShots] = useState<Shot[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [tab, setTab] = useState<string>(TAB_ALL);
  const [running, setRunning] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Shot | null>(null);
  const [assignSel, setAssignSel] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const childName = useCallback(
    (id: string) => kids.find((c) => c.id === id)?.name ?? id,
    [kids],
  );

  useEffect(
    () => () => {
      cancelRef.current = true;
      setShots((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.url));
        return [];
      });
    },
    [],
  );

  const patch = useCallback((id: string, next: Partial<Shot>) => {
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...next } : s)));
  }, []);

  /**
   * 대기 중인 사진을 한 장씩 분류한다.
   *
   * 갤러리는 루프 밖에서 한 번만 스냅숏으로 뜬다 — 도는 도중 교사가 미분류 얼굴을
   * 지정해 갤러리가 바뀌어도 이번 회차의 조건은 흔들리지 않아야 하기 때문이다.
   */
  const classifyQueue = useCallback(
    async (queue: Shot[]) => {
      const entries = gallery.entries();
      if (entries.length === 0) {
        toast("이 반에 등록된 아이가 없습니다 — 등록 탭에서 먼저 등록하세요.");
        setShots((prev) =>
          prev.map((s) =>
            s.status === "pending"
              ? { ...s, status: "failed", error: "갤러리가 비어 있습니다" }
              : s,
          ),
        );
        return;
      }

      cancelRef.current = false;
      setRunning(true);
      try {
        for (const shot of queue) {
          if (cancelRef.current) break;
          patch(shot.id, { status: "classifying", error: undefined });
          try {
            // maxSide를 주지 않으면 원본을 보낸다. 줄이면 유사도가 미세하게 낮아져
            // 임계값 경계의 사진이 뒤집힌 적이 있다(실측).
            const r = await classifyPhoto(shot.file, entries, {
              thresh: CLASSIFY_THRESHOLD,
            });
            const similarity: Record<string, number> = {};
            r.matched.forEach((m) => {
              similarity[m.child_id] = m.similarity;
            });
            const best = r.unmatched.reduce(
              (acc, u) => (u.best_similarity > acc ? u.best_similarity : acc),
              0,
            );
            patch(shot.id, {
              status: r.matched.length > 0 ? "classified" : "unmatched",
              childIds: r.matched.map((m) => m.child_id),
              similarity,
              facesDetected: r.faces_detected,
              bestUnmatched: r.unmatched.length > 0 ? best : undefined,
              unmatchedEmbedding: r.unmatched[0]?.embedding,
              unmatchedCount: r.unmatched.length,
            });
          } catch (e) {
            patch(shot.id, {
              status: "failed",
              error: e instanceof ApiError ? e.message : "분류에 실패했습니다.",
            });
          }
        }
      } finally {
        setRunning(false);
      }
    },
    [gallery, patch, toast],
  );

  const upload = (incoming: File[]) => {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    // 새 사진 목록은 **updater 밖에서** 만든다.
    // setShots(updater)의 updater는 다음 렌더에서 실행되므로, 그 안에서 배열을
    // 채우면 바로 다음 줄에서는 아직 비어 있다 — 그래서 분류가 시작되지 않고
    // 사진이 "대기"에 멈춰 있었다.
    const seen = new Set(shots.map((s) => s.id));
    const fresh: Shot[] = [];
    images.forEach((f) => {
      const id = shotId(f);
      if (seen.has(id)) return;
      seen.add(id);
      fresh.push({
        id,
        file: f,
        url: URL.createObjectURL(f),
        status: "pending",
        childIds: [],
        similarity: {},
        facesDetected: 0,
        unmatchedCount: 0,
      });
    });
    if (fresh.length === 0) return;

    setShots((prev) => prev.concat(fresh));
    toast(`${fresh.length}장 올렸습니다 — 얼굴 분류를 시작합니다`);
    void classifyQueue(fresh);
  };

  /** 자동 시작이 막혔거나 분류 중에 더 올린 사진을 다시 굴린다 */
  const startPending = () => {
    const queue = shots.filter((s) => s.status === "pending");
    if (queue.length > 0) void classifyQueue(queue);
  };

  const retryFailed = () => {
    const failed = shots.filter((s) => s.status === "failed");
    if (failed.length > 0) void classifyQueue(failed);
  };

  const toggle = (s: Shot) => {
    if (s.status === "unmatched") {
      openAssign(s);
      return;
    }
    if (s.status !== "classified") return;
    setSel((prev) =>
      prev.includes(s.id) ? prev.filter((x) => x !== s.id) : prev.concat(s.id),
    );
  };

  /** 이미 배정된 사진에도 연다 — EP-018은 "지정"이 아니라 "아이 추가·제거"다 */
  const openAssign = (s: Shot) => {
    setAssignTarget(s);
    setAssignSel(s.childIds);
  };

  const toggleAssign = (childId: string) =>
    setAssignSel((prev) =>
      prev.includes(childId)
        ? prev.filter((x) => x !== childId)
        : prev.concat(childId),
    );

  /**
   * EP-018 수동 지정 + 점진적 등록.
   *
   * 미등록 아이일 때만 이 얼굴을 갤러리에 넣는다. 이미 등록된 아이에게 덮어쓰면
   * 잘 나온 등록 사진이 흐릿한 행사 사진 얼굴로 교체돼 정확도가 오히려 떨어진다.
   */
  const confirmAssign = async () => {
    if (!assignTarget) return;
    const target = assignTarget;
    const chosen = assignSel;

    // 자동 배정으로 받은 유사도는 남아 있는 아이 것만 유지한다
    const similarity: Record<string, number> = {};
    chosen.forEach((id) => {
      const s = target.similarity[id];
      if (typeof s === "number") similarity[id] = s;
    });

    patch(target.id, {
      status: chosen.length > 0 ? "classified" : "unmatched",
      childIds: chosen,
      similarity,
    });
    setAssignTarget(null);
    if (chosen.length === 0) setSel((prev) => prev.filter((x) => x !== target.id));

    // 점진적 등록은 **누구 얼굴인지 확실할 때만** 한다.
    // 미분류 얼굴이 1개이고 새로 추가된 아이도 1명일 때만 그 둘이 짝이라고 볼 수 있다.
    const added = chosen.filter((id) => !target.childIds.includes(id));
    const embedding = target.unmatchedEmbedding;
    if (
      embedding &&
      target.unmatchedCount === 1 &&
      added.length === 1 &&
      !gallery.isEnrolled(added[0])
    ) {
      await gallery.enroll(added[0], embedding);
      toast(`${childName(added[0])}에게 배정하고 얼굴도 등록했습니다`);
      return;
    }
    toast(
      chosen.length === 0
        ? "배정을 모두 해제했습니다"
        : `${chosen.map(childName).join(", ")} — ${chosen.length}명 배정했습니다`,
    );
  };

  /** EP-019 대체 — 아이 이름 폴더를 만들어 원본 사진을 복사한다 */
  const exportSelected = async () => {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) {
      toast(
        "이 브라우저에서는 폴더 저장을 지원하지 않습니다 — 데스크톱 앱에서 실행하세요.",
      );
      return;
    }
    const targets = shots.filter((s) => sel.includes(s.id));
    if (targets.length === 0) return;

    let root: DirHandle;
    try {
      root = await picker();
    } catch {
      return; // 사용자가 폴더 선택을 취소한 것 — 조용히 끝낸다
    }

    setExporting(true);
    const used = new Map<string, Set<string>>();
    let written = 0;
    try {
      for (const shot of targets) {
        const folders = shot.childIds.length > 0 ? shot.childIds : ["미분류"];
        for (const key of folders) {
          const folder = safeName(key === "미분류" ? "미분류" : childName(key));
          const dir = await root.getDirectoryHandle(folder, { create: true });

          // 같은 폴더에 같은 파일명이 겹치면 뒤엣것이 앞엣것을 지운다 — 번호를 붙인다
          const taken = used.get(folder) ?? new Set<string>();
          let name = safeName(shot.file.name);
          if (taken.has(name)) {
            const dot = name.lastIndexOf(".");
            const stem = dot > 0 ? name.slice(0, dot) : name;
            const ext = dot > 0 ? name.slice(dot) : "";
            let i = 2;
            while (taken.has(`${stem}_${i}${ext}`)) i += 1;
            name = `${stem}_${i}${ext}`;
          }
          taken.add(name);
          used.set(folder, taken);

          const handle = await dir.getFileHandle(name, { create: true });
          const writable = await handle.createWritable();
          await writable.write(shot.file);
          await writable.close();
          written += 1;
        }
      }
      setShots((prev) =>
        prev.map((s) => (sel.includes(s.id) ? { ...s, exported: true } : s)),
      );
      setSel([]);
      toast(`${written}개 파일을 아이별 폴더로 내보냈습니다`);
    } catch {
      toast("내보내기에 실패했습니다. 폴더 쓰기 권한을 확인하세요.");
    } finally {
      setExporting(false);
    }
  };

  // ---------- 집계 ----------
  const totals = useMemo(() => {
    const total = shots.length;
    const classified = shots.filter((s) => s.status === "classified").length;
    const classifying = shots.filter(
      (s) => s.status === "classifying" || s.status === "pending",
    ).length;
    const pending = shots.filter((s) => s.status === "pending").length;
    const unmatched = shots.filter((s) => s.status === "unmatched").length;
    const failed = shots.filter((s) => s.status === "failed").length;
    // 진단용 — "왜 한 명만 잡혔나"는 이 세 숫자로 갈린다.
    // 얼굴이 애초에 1개면 검출 문제, 얼굴은 여러 개인데 배정이 1이면 임계값·1:1 할당 문제다.
    let faces = 0;
    let assigned = 0;
    let unmatchedFaces = 0;
    shots.forEach((s) => {
      faces += s.facesDetected;
      assigned += s.childIds.length;
      unmatchedFaces += s.unmatchedCount;
    });
    return {
      total,
      classified,
      classifying,
      pending,
      unmatched,
      failed,
      faces,
      assigned,
      unmatchedFaces,
    };
  }, [shots]);

  const childTabs = useMemo(() => {
    const ids = new Set<string>();
    shots.forEach((s) => s.childIds.forEach((id) => ids.add(id)));
    return kids.filter((c) => ids.has(c.id));
  }, [shots, kids]);

  const visible = shots.filter((s) => {
    if (tab === TAB_ALL) return true;
    if (tab === TAB_UNMATCHED)
      return s.status === "unmatched" || s.status === "failed";
    return s.childIds.includes(tab);
  });

  /** 마우스를 올리면 뜨는 한 줄 진단 — 얼굴 몇 개를 찾았고 몇 명에게 갔는지 */
  const detail = (s: Shot) => {
    if (s.error) return `${s.file.name} — 실패: ${s.error}`;
    if (!s.facesDetected && s.status !== "classified")
      return `${s.file.name} — 아직 분류 전`;
    const names = s.childIds
      .map((id) => {
        const v = s.similarity[id];
        return typeof v === "number"
          ? `${childName(id)} ${pct(v)}`
          : `${childName(id)} (수동)`;
      })
      .join(", ");
    const parts = [
      `${s.file.name}`,
      `얼굴 ${s.facesDetected}개 검출`,
      `배정 ${s.childIds.length}명${names ? ` (${names})` : ""}`,
    ];
    if (s.unmatchedCount > 0) {
      parts.push(
        `못 찾음 ${s.unmatchedCount}개${
          s.bestUnmatched ? ` (최고 ${pct(s.bestUnmatched)})` : ""
        }`,
      );
    }
    return parts.join(" · ");
  };

  const simLabel = (s: Shot) => {
    if (s.status === "classifying") return "분류 중…";
    if (s.status === "pending") return "대기";
    if (s.status === "failed") return "실패";
    if (s.status === "unmatched")
      return s.bestUnmatched ? `최고 ${pct(s.bestUnmatched)}` : "미분류";
    const sims = s.childIds
      .map((id) => s.similarity[id])
      .filter((v): v is number => typeof v === "number");
    return sims.length > 0 ? sims.map(pct).join(" ") : "수동 지정";
  };

  return (
    <>
      <div className="stack">
        <div className="card">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                upload(Array.from(e.target.files ?? []));
                e.target.value = ""; // 같은 파일을 다시 골라도 change가 뜨도록
              }}
            />
            <button
              className="btn primary big"
              onClick={() => fileInputRef.current?.click()}
              disabled={running || gallery.size === 0}
            >
              <N n={2} />
              <Camera size={16} /> {running ? "분류 중…" : "사진 올리기"}
            </button>

            <div className="min-w-[220px] flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold">
                <span className="inline-flex items-center gap-1.5">
                  <N n={3} />
                  분류 {totals.classified}/{totals.total}장
                </span>
                {running && totals.classifying > 0 && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber">
                    <Loader2 size={13} className="animate-spin" />
                    {totals.classifying}장 남음
                  </span>
                )}
                {!running && totals.pending > 0 && (
                  <span className="text-[12px] font-semibold text-muted">
                    대기 {totals.pending}장
                  </span>
                )}
                {totals.failed > 0 && (
                  <span className="text-[12px] font-semibold text-coral">
                    실패 {totals.failed}장
                  </span>
                )}
              </div>
              <Progress value={totals.classified} max={totals.total || 1} />
            </div>
          </div>

          {(running || totals.failed > 0 || totals.pending > 0) && (
            <div className="btnrow">
              {running && (
                <button
                  className="btn danger"
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                >
                  <CircleSlash size={14} /> 멈추기
                </button>
              )}
              {!running && totals.pending > 0 && (
                <button className="btn primary" onClick={startPending}>
                  <Camera size={14} /> 분류 시작 ({totals.pending}장)
                </button>
              )}
              {!running && totals.failed > 0 && (
                <button className="btn" onClick={retryFailed}>
                  <RotateCcw size={14} /> 실패한 {totals.failed}장 다시
                </button>
              )}
            </div>
          )}

          <div className="mt-4">
            <Notice kind="soft">
              <span>
                갤러리 <b>{gallery.size}명</b>을 임계값{" "}
                <b>{CLASSIFY_THRESHOLD.toFixed(2)}</b>로 대조합니다. 사진 1장당 약
                1초 걸리고, 서버는 추론이 끝나면 사진과 임베딩을 즉시 폐기합니다.
              </span>
            </Notice>
          </div>
        </div>

        <div className="card">
          <div className="phototabs">
            <button
              className={`chip ${tab === TAB_ALL ? "on" : ""}`}
              onClick={() => setTab(TAB_ALL)}
            >
              전체 ({totals.total})
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
            {totals.unmatched + totals.failed > 0 && (
              <button
                className={`chip ${tab === TAB_UNMATCHED ? "on" : ""} border-[#e9c4bd] text-coral`}
                onClick={() => setTab(TAB_UNMATCHED)}
              >
                ⚠ 미분류 ({totals.unmatched + totals.failed})
              </button>
            )}
          </div>

          {totals.faces > 0 && (
            <div className="mt-2 text-[12.5px] text-muted">
              얼굴 <b className="text-ink">{totals.faces}개</b> 검출 · 배정{" "}
              <b className="text-ink">{totals.assigned}건</b> · 못 찾은 얼굴{" "}
              <b className="text-ink">{totals.unmatchedFaces}개</b>
              {" — "}사진에 마우스를 올리면 장별 내역이 보입니다.
            </div>
          )}

          {shots.length === 0 ? (
            <EmptyState
              icon={<Camera size={22} />}
              title="올린 사진이 없습니다"
              desc="사진을 올리면 반 갤러리와 대조해 아이별로 나눠 줍니다. 사진은 이 PC에만 남습니다."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Camera size={22} />}
              title="이 탭에 사진이 없습니다"
            />
          ) : (
            <div className="photogrid">
              <AnimatePresence initial={false}>
                {visible.map((s) => (
                  <motion.button
                    key={s.id}
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className={`photo ${sel.includes(s.id) ? "sel" : ""} ${
                      s.status === "unmatched" || s.status === "failed"
                        ? "border-dashed"
                        : ""
                    } ${s.exported ? "dim" : ""}`}
                    onClick={() => toggle(s)}
                    aria-label={detail(s)}
                    title={detail(s)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.url}
                      alt={s.file.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {(s.status === "classified" || s.status === "unmatched") && (
                      <span
                        role="button"
                        tabIndex={-1}
                        className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md border border-line-strong bg-white/90 text-ink"
                        aria-label="아이 지정"
                        title="아이 추가·제거"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAssign(s);
                        }}
                      >
                        <UserRoundPlus size={13} />
                      </span>
                    )}
                    {s.status === "classified" && !s.exported && (
                      <span className="ck">{sel.includes(s.id) ? "✓" : ""}</span>
                    )}
                    {s.exported && (
                      <span className="absolute right-2 top-2 rounded-md bg-confirm-soft px-1.5 py-0.5 text-[10.5px] font-bold text-confirm">
                        내보냄
                      </span>
                    )}
                    {/*
                      한 줄에 아이 한 명씩. 유사도와 이름을 좌우 끝으로 벌려 놓으면
                      두 명 이상일 때 줄바꿈되며 서로 어긋난다 — "60% 손승현" 처럼
                      붙여서 행 단위로 쌓는다.
                    */}
                    <span className="sim flex-col items-stretch justify-end gap-0.5">
                      {s.childIds.length > 0 ? (
                        s.childIds.map((id) => {
                          const score = s.similarity[id];
                          return (
                            <span
                              key={id}
                              className="flex items-center gap-1.5 leading-tight"
                            >
                              <span className="tabular-nums">
                                {typeof score === "number" ? pct(score) : "수동"}
                              </span>
                              <span className="truncate">{childName(id)}</span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="flex items-center gap-1.5 leading-tight">
                          {s.status === "classifying" && (
                            <Loader2 size={11} className="animate-spin" />
                          )}
                          {simLabel(s)}
                        </span>
                      )}
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
              onClick={exportSelected}
              disabled={exporting || sel.length === 0}
            >
              <N n={4} />
              <FolderDown size={14} />
              {exporting
                ? "내보내는 중…"
                : `선택한 사진 내보내기${sel.length ? ` (${sel.length})` : ""}`}
            </button>
            <span className="text-[12.5px] text-muted">
              <N n={5} />
              미분류 사진을 누르면 아이를 직접 지정할 수 있어요 · 아이 이름 폴더로
              저장됩니다
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
          이 사진에 나온 아이를 <b>모두</b> 고르세요 — 한 장에 여러 명을 배정할 수
          있습니다. 이미 배정된 아이를 다시 누르면 해제됩니다.
          {assignTarget ? (
            <>
              {" "}
              얼굴 {assignTarget.facesDetected}개 검출
              {assignTarget.unmatchedCount > 0
                ? ` · 못 찾은 얼굴 ${assignTarget.unmatchedCount}개`
                : ""}
              {assignTarget.bestUnmatched
                ? ` (최고 ${pct(assignTarget.bestUnmatched)})`
                : ""}
              .
            </>
          ) : null}
          {assignTarget?.unmatchedCount === 1 && (
            <>
              {" "}
              <b>미등록</b> 아이 한 명을 새로 고르면 그 얼굴이 갤러리에 함께
              등록되어 다음 분류부터 자동으로 잡힙니다.
            </>
          )}
        </div>
        <div className="mt-4 grid max-h-[300px] gap-1.5 overflow-y-auto [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
          {kids.map((k) => {
            const on = assignSel.includes(k.id);
            return (
              <button
                key={k.id}
                className={`rail-item border ${on ? "on border-green" : "border-line"}`}
                onClick={() => toggleAssign(k.id)}
                aria-pressed={on}
              >
                <Avatar name={k.name} color={k.color} size="sm" />
                {k.name}
                <span className="meta">
                  {on ? "✓" : gallery.isEnrolled(k.id) ? "등록됨" : "미등록"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <span className="mr-auto text-[12.5px] text-muted">
            {assignSel.length}명 선택
          </span>
          <button className="btn ghost" onClick={() => setAssignTarget(null)}>
            취소
          </button>
          <button
            className="btn primary"
            onClick={() => void confirmAssign()}
            disabled={gallery.saving}
          >
            확인
          </button>
        </div>
      </Modal>
    </>
  );
}
