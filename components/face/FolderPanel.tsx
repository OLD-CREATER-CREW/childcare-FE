"use client";

/**
 * 폴더 보기 패널 (SCR-005 사진함 › 폴더 보기 탭).
 *
 * ■ 무엇을 하는 화면인가
 * **아무것도 하지 않는다.** 정해 둔 사진 폴더의 사진을 늘어놓고 보여 줄 뿐이다.
 * 분류도, 등록도, 내보내기도 없다.
 *
 * ■ 왜 따로 뒀나
 * 「사진 분류」 탭은 올린 사진을 곧바로 얼굴 대조에 태운다. 그래서 "내보낸
 * 폴더에 뭐가 들어 있더라" 를 확인하려면 분류를 거쳐야 했다 — 1장당 1초씩
 * 걸리고 화면도 분류 결과로 뒤덮인다. 보기만 하는 일에 그 비용을 치를 이유가
 * 없어 탭을 하나 더 뒀다.
 *
 * ■ 아이·날짜로 거른다 (2026-08 추가)
 * 내보내기가 `아이 이름/촬영일자/파일명` 으로 저장하므로, **폴더 이름이 곧
 * 메타데이터다.** 파일을 열지 않고도 누구의 언제 사진인지 알 수 있어서, 아이
 * 하나만 보거나 날짜 구간을 잘라 보는 일이 폴더 이름 비교만으로 된다.
 * 한 학기치가 쌓이면 그냥 늘어놓는 것만으로는 찾을 수 없다.
 *
 * ■ 지키는 것
 * 읽기만 한다. 사진은 교사가 정한 폴더에 그대로 있고, 서버로 보내지 않으며
 * 브라우저 저장소에도 쓰지 않는다(`ml/pipeline/INTERFACE.md` 1절).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Images, Loader2, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/store";
import { MAX_FOLDER_PHOTOS, readAllPhotos, revokeBrowsedPhotos } from "@/lib/face";
import type { BrowsedPhoto, PhotoRootState } from "@/lib/face";
import { EmptyState, Modal, Select } from "@/components/ui";

/** 날짜 폴더 이름. 내보내기가 `아이/YYYY-MM-DD/파일` 로 쓴다. */
const DATE_DIR = /(\d{4}-\d{2}-\d{2})/;

const ALL = "__all__";

type DateMode = "all" | "one" | "range";

const DATE_MODES: { value: DateMode; label: string }[] = [
  { value: "all", label: "전체 기간" },
  { value: "one", label: "하루" },
  { value: "range", label: "기간 지정" },
];

/**
 * 폴더 경로에서 아이 이름과 날짜를 읽는다.
 *
 * `p.dir` 은 사진 폴더 안의 상대 경로다("가상아동_민준/2026-08-16"). 날짜처럼
 * 생긴 조각을 찾아 촬영일로 삼고, **그 바로 앞 조각**을 아이 이름으로 본다 —
 * 내보내기가 만든 구조가 그것이기 때문이다.
 *
 * 구조가 다르면(교사가 손으로 만든 폴더 등) 날짜도 이름도 비운다. 추측하지
 * 않는다 — 틀린 날짜로 걸러 사진이 사라지는 편이 안 걸러지는 것보다 나쁘다.
 */
function readMeta(dir: string): { child: string; date: string } {
  const parts = dir.split("/").filter(Boolean);
  const at = parts.findIndex((seg) => DATE_DIR.test(seg));
  if (at < 0) return { child: "", date: "" };
  return {
    date: DATE_DIR.exec(parts[at])?.[1] ?? "",
    child: at > 0 ? parts[at - 1] : "",
  };
}

export function FolderPanel({ photoRoot }: { photoRoot: PhotoRootState }) {
  const { toast } = useApp();
  const [photos, setPhotos] = useState<BrowsedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  /** 크게 볼 사진. 격자에서는 얼굴이 잘 안 보여 한 장씩 띄울 수 있게 한다 */
  const [preview, setPreview] = useState<BrowsedPhoto | null>(null);

  const [child, setChild] = useState<string>(ALL);
  const [mode, setMode] = useState<DateMode>("all");
  const [day, setDay] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // 화면을 떠날 때 objectURL 을 반드시 해제한다. 지금 값을 ref 로 들고 있어야
  // cleanup 이 옛 배열을 잡지 않는다.
  const photosRef = useRef<BrowsedPhoto[]>([]);
  photosRef.current = photos;
  useEffect(() => () => revokeBrowsedPhotos(photosRef.current), []);

  const rootHandle = photoRoot.handle;
  const rootReady = photoRoot.ready;

  const load = useCallback(async () => {
    if (!rootHandle) return;
    setLoading(true);
    try {
      const found = await readAllPhotos(rootHandle);
      revokeBrowsedPhotos(photosRef.current); // 이전 것을 먼저 놓아준다
      setPhotos(found.photos);
      setPreview(null);
      if (found.photos.length === 0) {
        toast("이 폴더에서 사진을 찾지 못했습니다.");
      } else if (found.hitLimit) {
        toast(`사진이 많아 ${MAX_FOLDER_PHOTOS}장까지만 읽었습니다.`);
      }
    } catch (e) {
      console.error("[폴더 보기] 읽기 실패:", e);
      toast(
        `폴더를 읽지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setLoading(false);
    }
  }, [rootHandle, toast]);

  // 폴더가 정해지면(또는 바뀌면) 알아서 읽는다. 탭을 열 때마다 「폴더 고르기」를
  // 누르게 하던 예전 흐름이 없어진 자리다.
  useEffect(() => {
    if (rootReady) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootReady, rootHandle]);

  /** 사진마다 아이·날짜를 붙여 둔다 — 거르기와 묶기가 같은 값을 쓴다. */
  const tagged = useMemo(
    () => photos.map((p) => ({ photo: p, ...readMeta(p.dir) })),
    [photos],
  );

  const childOptions = useMemo(() => {
    const names = Array.from(
      new Set(tagged.map((t) => t.child).filter(Boolean)),
    ).sort();
    return [{ value: ALL, label: "전체 아이" }].concat(
      names.map((n) => ({ value: n, label: n })),
    );
  }, [tagged]);

  const dateRange = useMemo(() => {
    const dates = tagged.map((t) => t.date).filter(Boolean).sort();
    return { min: dates[0] ?? "", max: dates[dates.length - 1] ?? "" };
  }, [tagged]);

  // 기간 칸을 폴더에 실제로 있는 날짜로 채워 둔다. 빈 칸으로 두면 교사가 무엇을
  // 넣어야 할지 모르고, 아무 날짜나 넣으면 결과가 0장이 된다.
  useEffect(() => {
    if (!dateRange.min) return;
    setDay((v) => v || dateRange.max);
    setFrom((v) => v || dateRange.min);
    setTo((v) => v || dateRange.max);
  }, [dateRange.min, dateRange.max]);

  const visible = useMemo(
    () =>
      tagged.filter((t) => {
        if (child !== ALL && t.child !== child) return false;
        if (mode === "one") return t.date === day;
        if (mode === "range") {
          // 날짜를 못 읽은 사진은 기간으로 거를 수 없다 — 넣지 않는다.
          if (!t.date) return false;
          if (from && t.date < from) return false;
          if (to && t.date > to) return false;
        }
        return true;
      }),
    [tagged, child, mode, day, from, to],
  );

  /** 하위 폴더별로 묶는다 — 사진 폴더는 `아이/날짜` 라 그 단위가 곧 의미다. */
  const groups = useMemo(() => {
    const map = new Map<string, BrowsedPhoto[]>();
    for (const t of visible) {
      const list = map.get(t.photo.dir);
      if (list) list.push(t.photo);
      else map.set(t.photo.dir, [t.photo]);
    }
    return Array.from(map, ([dir, list]) => ({ dir, photos: list })).sort((a, b) =>
      a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0,
    );
  }, [visible]);

  if (!photoRoot.loading && !rootHandle) {
    return (
      <div className="card">
        <EmptyState
          icon={<Images size={22} />}
          title="사진 폴더를 먼저 정해 주세요"
          desc="위쪽의 「사진 폴더 지정」을 누르면, 그 폴더의 사진을 아이별·날짜별로 나눠 보여 드립니다."
        />
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="w-[150px]">
            <div className="mb-2 text-[12.5px] font-bold text-muted">아이</div>
            <Select
              value={child}
              onChange={setChild}
              options={childOptions}
              ariaLabel="아이 고르기"
            />
          </div>

          <div className="w-[128px]">
            <div className="mb-2 text-[12.5px] font-bold text-muted">
              <CalendarDays size={13} className="mr-1 inline" />
              날짜
            </div>
            <Select
              value={mode}
              onChange={(v) => setMode(v as DateMode)}
              options={DATE_MODES}
              ariaLabel="날짜 방식"
            />
          </div>

          {mode === "one" && (
            <div>
              <div className="mb-2 text-[12.5px] font-bold text-muted">
                날짜 고르기
              </div>
              <input
                type="date"
                className="input w-[164px]"
                value={day}
                min={dateRange.min || undefined}
                max={dateRange.max || undefined}
                onChange={(e) => setDay(e.target.value)}
                aria-label="날짜"
              />
            </div>
          )}

          {mode === "range" && (
            <div>
              <div className="mb-2 text-[12.5px] font-bold text-muted">
                시작 ~ 끝
              </div>
              {/* 두 날짜는 한 줄에 붙어 있어야 "언제부터 언제까지"로 읽힌다 */}
              <span className="flex flex-nowrap items-center gap-2">
                <input
                  type="date"
                  className="input w-[164px] shrink-0"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label="시작 날짜"
                />
                <span className="shrink-0 text-muted">~</span>
                <input
                  type="date"
                  className="input w-[164px] shrink-0"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label="끝 날짜"
                />
              </span>
            </div>
          )}

          <button
            className="btn ml-auto"
            onClick={() => void load()}
            disabled={loading || !rootReady}
            title="폴더를 다시 읽습니다"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> 읽는 중…
              </>
            ) : (
              <>
                <RefreshCw size={14} /> 새로 읽기
              </>
            )}
          </button>
        </div>

        <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted">
          사진 <b className="text-ink">{visible.length}</b>장 · 폴더{" "}
          <b className="text-ink">{groups.length}</b>개
          {visible.length !== photos.length && (
            <> (전체 {photos.length}장 중)</>
          )}
          {" · "}최대 {MAX_FOLDER_PHOTOS}장까지 읽으며,{" "}
          <b>분류하지 않고 보기만 합니다.</b> 사진은 이 PC를 벗어나지 않습니다.
        </p>
      </div>

      {loading && photos.length === 0 ? (
        <div className="card mt-4">
          <EmptyState
            icon={<Loader2 size={22} className="animate-spin" />}
            title="폴더를 읽는 중입니다"
            desc="사진이 많으면 몇 초 걸립니다."
          />
        </div>
      ) : groups.length === 0 ? (
        <div className="card mt-4">
          <EmptyState
            icon={<Images size={22} />}
            title={
              photos.length === 0
                ? "이 폴더에는 사진이 없습니다"
                : "고른 조건에 맞는 사진이 없습니다"
            }
            desc={
              photos.length === 0
                ? "사진 분류에서 내보내면 아이별·날짜별 폴더가 여기에 쌓입니다."
                : "아이를 「전체 아이」로 두거나 날짜 범위를 넓혀 보세요."
            }
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
