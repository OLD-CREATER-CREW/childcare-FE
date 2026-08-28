"use client";

/**
 * 놀이이야기 한눈에 보기 + 내보내기 (SCR-018 마무리).
 *
 * ■ 무엇을 위한 화면인가
 * 블록을 다 확정하면 **선생님이 배치만 생각하면 되도록** 글과 사진을 나란히
 * 보여 준다. 편집 화면은 한 놀이에 집중하는 자리라 전체 흐름이 보이지 않는데,
 * 소식지는 결국 한 장에 놓이는 문서다.
 *
 * ■ 내보내기
 * 지금 있는 사진 모으기(`saveRecommended`가 하던 일)를 그대로 쓰되, **확정 본문
 * `.txt`를 함께 넣는다.** 그래야 폴더 하나만 열면 글과 사진이 다 있다.
 *
 *     8월 놀이이야기/
 *     ├─ 놀이이야기.txt
 *     ├─ 1_모래로 두꺼비집을 지어요/
 *     │   └─ 2026-08-03_IMG_0421.jpg
 *     └─ 2_…/
 *
 * 놀이마다 폴더를 나누는 이유: 한 폴더에 다 넣으면 어느 사진이 어느 놀이 것인지
 * 파일명만으로는 알 수 없다. 폴더 이름 앞의 번호가 소식지의 순서다.
 */

import { useMemo, useState } from "react";
import { FolderDown, Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { WritePermissionDeniedError } from "@/lib/face";
import type { FolderPhoto, RootDirHandle } from "@/lib/face";
import { blockLabel, serialize } from "@/lib/blocks/playStory";
import type { PlayBlock } from "@/lib/blocks/playStory";
import type { BlockPhotos } from "@/components/play-story/PlayBlockEditor";
import { EmptyState, Notice } from "@/components/ui";

/** 파일·폴더 이름에 못 쓰는 문자를 걷어낸다(`ClassifyPanel.safeName`과 같은 규칙). */
const safeName = (s: string) =>
  s.replace(/[\\/:*?"<>|]/g, "_").trim() || "이름없음";

export function PlayStoryPreview({
  blocks,
  confirmed,
  photos,
  blockPhotos,
  root,
  folderName,
  monthLabel,
}: {
  blocks: PlayBlock[];
  confirmed: string[];
  photos: FolderPhoto[];
  blockPhotos: BlockPhotos;
  root: RootDirHandle | null;
  /** 만들 폴더 이름 — `8월 놀이이야기` */
  folderName: string;
  monthLabel: string;
}) {
  const { toast } = useApp();
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => {
    const map = new Map<string, FolderPhoto>();
    photos.forEach((p) => map.set(p.id, p));
    return map;
  }, [photos]);

  const plays = blocks.filter(
    (b): b is Extract<PlayBlock, { kind: "play" }> => b.kind === "play",
  );
  const topic = blocks.find((b) => b.kind === "topic");
  const allDone = blocks.length > 0 && blocks.every((b) => confirmed.includes(blockLabel(b)));
  const photoTotal = Object.values(blockPhotos).reduce((s, ids) => s + ids.length, 0);

  /**
   * 확정 본문과 사진을 폴더 하나에 담는다.
   *
   * 쓰기 권한은 **쓰기 직전에** 묻는다 — 폴더를 정할 때 읽기만 허락했을 수 있고,
   * 무엇에 동의하는지 그 순간에 알아야 한다(`saveRecommended`와 같은 규칙).
   */
  const runExport = async () => {
    if (!root) {
      toast("먼저 사진 폴더를 정해 주세요 — 그 안에 만들어 담습니다.");
      return;
    }

    setSaving(true);
    try {
      const state =
        (await root.queryPermission?.({ mode: "readwrite" })) ?? "prompt";
      if (state !== "granted") {
        const asked = await root.requestPermission?.({ mode: "readwrite" });
        if (asked !== "granted") throw new WritePermissionDeniedError();
      }

      const dir = await root.getDirectoryHandle(safeName(folderName), {
        create: true,
      });

      // 본문 — 확정한 블록만 넣는다. 확정하지 않은 것은 아직 초안이다.
      const done = blocks.filter((b) => confirmed.includes(blockLabel(b)));
      const handle = await dir.getFileHandle("놀이이야기.txt", { create: true });
      const writable = await handle.createWritable();
      await writable.write(
        new Blob([serialize(done)], { type: "text/plain;charset=utf-8" }),
      );
      await writable.close();

      // 사진 — 놀이마다 폴더 하나.
      let written = 0;
      // `entries()` 순회는 이 tsconfig에서 downlevelIteration이 필요하다.
      // 인덱스를 손으로 세면 설정을 건드리지 않아도 된다.
      for (let at = 0; at < plays.length; at += 1) {
        const play = plays[at];
        const label = blockLabel(play);
        if (!confirmed.includes(label)) continue;
        const ids = blockPhotos[label] ?? [];
        if (ids.length === 0) continue;

        const sub = await dir.getDirectoryHandle(
          safeName(`${at + 1}_${play.title}`),
          { create: true },
        );
        const used = new Set<string>();
        for (const id of ids) {
          const photo = byId.get(id);
          if (!photo) continue;
          // 원본이 `아이/날짜/파일`로 나뉘어 있어 같은 파일명이 겹칠 수 있다.
          // 날짜를 앞에 붙여 겹침을 막고 날짜도 남긴다(`saveRecommended`와 같다).
          let name = safeName(`${photo.date}_${photo.name}`);
          if (used.has(name)) {
            const dot = name.lastIndexOf(".");
            const stem = dot > 0 ? name.slice(0, dot) : name;
            const ext = dot > 0 ? name.slice(dot) : "";
            let i = 2;
            while (used.has(`${stem}_${i}${ext}`)) i += 1;
            name = `${stem}_${i}${ext}`;
          }
          used.add(name);

          const fh = await sub.getFileHandle(name, { create: true });
          const w = await fh.createWritable();
          await w.write(photo.file);
          await w.close();
          written += 1;
        }
      }

      toast(`「${folderName}」에 본문과 사진 ${written}장을 담았습니다.`);
    } catch (e) {
      if (e instanceof WritePermissionDeniedError) {
        toast("폴더에 쓸 권한이 없어 저장하지 못했습니다.");
        return;
      }
      console.error("[놀이이야기] 내보내기 실패:", e);
      toast(
        `내보내지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2>
        {monthLabel} 놀이이야기
        <span className="hint">
          확정 {confirmed.length} / {blocks.length} · 사진 {photoTotal}장
        </span>
      </h2>

      {topic && topic.kind === "topic" && topic.text && (
        <div className="mb-3.5">
          <div className="mb-1 text-[12.5px] font-bold text-muted">놀이 주제</div>
          <div className="text-[15px] font-bold">{topic.text}</div>
        </div>
      )}

      {plays.length === 0 ? (
        <EmptyState
          icon={<FolderDown size={22} />}
          title="아직 보여 드릴 놀이가 없습니다"
          desc="초안을 만들면 놀이마다 글과 사진을 나란히 놓아 드립니다."
        />
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          {plays.map((play, at) => {
            const label = blockLabel(play);
            const ids = blockPhotos[label] ?? [];
            const done = confirmed.includes(label);
            return (
              <div
                key={label}
                className={`overflow-hidden rounded-xl border bg-surface ${
                  done ? "border-[#b9e0c7]" : "border-line"
                }`}
              >
                <div className="grid grid-cols-2 gap-0.5 bg-line">
                  {ids.slice(0, 4).map((id) => {
                    const photo = byId.get(id);
                    if (!photo) return null;
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={id}
                        src={photo.url}
                        alt={photo.name}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    );
                  })}
                  {ids.length === 0 && (
                    <div className="col-span-2 grid aspect-[8/3] place-items-center bg-paper text-[12px] text-faint">
                      고른 사진 없음
                    </div>
                  )}
                </div>
                <div className="px-3.5 py-3">
                  <h4 className="m-0 mb-1.5 text-[13px] font-bold">
                    {at + 1}. {play.title || "제목 없음"}{" "}
                    <span className="font-mono text-[11.5px] font-normal text-muted">
                      {play.date}
                    </span>
                    {!done && (
                      <span className="ml-1.5 text-[11px] font-semibold text-amber">
                        미확정
                      </span>
                    )}
                  </h4>
                  <p className="m-0 text-[12px] leading-relaxed text-muted">
                    {play.story}
                  </p>
                  {play.quote && (
                    <div className="mt-1.5 text-[12px] font-semibold text-green-deep">
                      {play.quote}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!allDone && plays.length > 0 && (
        <div className="mt-4">
          <Notice kind="soft">
            <span>
              아직 확정하지 않은 블록이 있습니다. <b>확정한 것만</b> 내보냅니다 —
              나머지는 위에서 마저 확정해 주세요.
            </span>
          </Notice>
        </div>
      )}

      <div className="btnrow">
        <button
          className="btn primary"
          onClick={() => void runExport()}
          disabled={saving || confirmed.length === 0 || !root}
          title={root ? undefined : "사진 폴더를 먼저 정해 주세요"}
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> 내보내는 중…
            </>
          ) : (
            <>
              <FolderDown size={14} /> 확정 내용·사진 내보내기
            </>
          )}
        </button>
        <span className="text-[12.5px] text-muted">
          사진 폴더 안에 <b>{folderName}</b> 폴더를 만들어{" "}
          <b>놀이이야기.txt</b>와 고른 사진을 놀이별로 담습니다.
        </span>
      </div>
    </div>
  );
}
