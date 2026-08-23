"use client";

/**
 * 폴더 보기 패널 (SCR-005 사진함 › 폴더 보기 탭).
 *
 * ■ 무엇을 하는 화면인가
 * **아무것도 하지 않는다.** 고른 폴더의 사진을 그냥 늘어놓고 보여 줄 뿐이다.
 * 분류도, 등록도, 내보내기도 없다.
 *
 * ■ 왜 따로 뒀나
 * 「사진 분류」 탭은 올린 사진을 곧바로 얼굴 대조에 태운다. 그래서 "내보낸
 * 폴더에 뭐가 들어 있더라" 를 확인하려면 분류를 거쳐야 했다 — 1장당 1초씩
 * 걸리고 화면도 분류 결과로 뒤덮인다. 보기만 하는 일에 그 비용을 치를 이유가
 * 없어 탭을 하나 더 뒀다.
 *
 * ■ 지키는 것
 * 읽기만 한다. 사진은 교사가 고른 폴더에 그대로 있고, 서버로 보내지 않으며
 * 브라우저 저장소에도 쓰지 않는다(`ml/pipeline/INTERFACE.md` 1절). 폴더 경로도
 * 기억하지 않는다 — 볼 때마다 교사가 직접 고른다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Images, Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";
import {
  FolderCancelledError,
  FolderUnsupportedError,
  MAX_FOLDER_PHOTOS,
  browsePhotoFolder,
  revokeBrowsedPhotos,
} from "@/lib/face";
import type { BrowsedPhoto } from "@/lib/face";
import { EmptyState, Modal } from "@/components/ui";

export function FolderPanel() {
  const { toast } = useApp();
  const [photos, setPhotos] = useState<BrowsedPhoto[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** 크게 볼 사진. 격자에서는 얼굴이 잘 안 보여 한 장씩 띄울 수 있게 한다 */
  const [preview, setPreview] = useState<BrowsedPhoto | null>(null);

  // 화면을 떠날 때 objectURL 을 반드시 해제한다. 지금 값을 ref 로 들고 있어야
  // cleanup 이 옛 배열을 잡지 않는다.
  const photosRef = useRef<BrowsedPhoto[]>([]);
  photosRef.current = photos;
  useEffect(() => () => revokeBrowsedPhotos(photosRef.current), []);

  const pick = async () => {
    setLoading(true);
    try {
      const found = await browsePhotoFolder();
      revokeBrowsedPhotos(photosRef.current); // 이전 선택분을 먼저 놓아준다
      setPhotos(found.photos);
      setFolderName(found.folderName);
      setPreview(null);
      if (found.photos.length === 0) {
        toast("그 폴더에서 사진을 찾지 못했습니다.");
      } else if (found.hitLimit) {
        toast(`사진이 많아 ${MAX_FOLDER_PHOTOS}장까지만 읽었습니다.`);
      } else {
        toast(`${found.photos.length}장을 읽었습니다.`);
      }
    } catch (e) {
      if (e instanceof FolderCancelledError) return; // 교사가 취소한 것
      if (e instanceof FolderUnsupportedError) {
        toast(
          "이 브라우저에서는 폴더 읽기를 지원하지 않습니다 — 데스크톱 앱에서 실행하세요.",
        );
        return;
      }
      console.error("[폴더 보기] 읽기 실패:", e);
      toast(
        `폴더를 읽지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  /** 하위 폴더별로 묶는다 — 내보내기 폴더는 `아이/날짜` 라 그 단위가 곧 의미다. */
  const groups = useMemo(() => {
    const map = new Map<string, BrowsedPhoto[]>();
    for (const p of photos) {
      const list = map.get(p.dir);
      if (list) list.push(p);
      else map.set(p.dir, [p]);
    }
    return Array.from(map, ([dir, list]) => ({ dir, photos: list })).sort((a, b) =>
      a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0,
    );
  }, [photos]);

  return (
    <>
      <div className="card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <button
            className="btn primary big"
            onClick={() => void pick()}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> 읽는 중…
              </>
            ) : (
              <>
                <FolderOpen size={16} />{" "}
                {folderName ? "폴더 다시 고르기" : "폴더 고르기"}
              </>
            )}
          </button>

          {folderName && (
            <span className="text-[13px] text-muted">
              <b className="text-ink">{folderName}</b> · 사진 {photos.length}장 ·
              폴더 {groups.length}개
            </span>
          )}
        </div>

        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          고른 폴더와 그 하위 폴더의 사진을 모두 보여 줍니다. 최대{" "}
          {MAX_FOLDER_PHOTOS}장이며, <b>분류하지 않고 보기만 합니다.</b> 사진은 이
          PC를 벗어나지 않습니다.
        </p>
      </div>

      {photos.length === 0 ? (
        <div className="card mt-4">
          <EmptyState
            icon={<Images size={22} />}
            title={folderName ? "이 폴더에는 사진이 없습니다" : "폴더를 골라 주세요"}
            desc="사진함에서 내보낸 폴더를 고르면 아이별·날짜별로 나눠 보여 드립니다."
          />
        </div>
      ) : (
        groups.map((g) => (
          <div className="card mt-4" key={g.dir || "__root__"}>
            <h2>
              <Images size={16} />
              {g.dir || "최상위 폴더"}
              <span className="hint">{g.photos.length}장</span>
            </h2>
            <div className="photogrid">
              {g.photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="photo"
                  onClick={() => setPreview(p)}
                  aria-label={`${p.name} 크게 보기`}
                  title={p.id}
                >
                  {/* 로컬 objectURL 이라 next/image 의 최적화 대상이 아니다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      <Modal
        open={!!preview}
        label={preview?.id ?? ""}
        onClose={() => setPreview(null)}
        wide
      >
        {preview && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt={preview.name}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
            <p className="mt-2 text-[12.5px] text-muted">
              {preview.dir ? `${preview.dir} / ` : ""}
              <b className="text-ink">{preview.name}</b> ·{" "}
              {Math.round(preview.file.size / 1024).toLocaleString()}KB
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
