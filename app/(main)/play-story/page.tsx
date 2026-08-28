"use client";

/**
 * SCR-018 놀이이야기 — 한 달의 놀이를 가정에 전하는 소식지.
 *
 * ■ 범위를 정하는 축이 다르다
 * 알림장은 아이 하나, 계획안은 반 전체를 뭉뚱그리는데 놀이이야기는 **반 하나**다.
 * 서식이 제목에 반 이름을 요구하기 때문이다("[반이름] 놀이이야기"). 그래서 이
 * 화면에만 반 선택이 있고, 고르지 않으면 생성이 잠긴다.
 *
 * ■ 흐름 (2026-08 개편)
 *   ① 이 달에 한 놀이에서 고른다 — 주관식 대신 하루 기록의 활동 태그
 *   ② 초안을 **놀이별 블록**으로 나눠 편집한다 — 블록마다 다시 생성·확정
 *   ③ 블록 안에서 그 날짜의 사진을 고른다
 *   ④ 확정한 것만 폴더 하나에 본문·사진으로 내보낸다
 *
 * 원천 기록 패널은 없앴다. 좌우를 넓게 쓰기 위해서이고, 어느 기록에서 나왔는지는
 * 소주제에 붙은 날짜가 이미 말해 준다.
 *
 * ■ 블록으로 나누지 못하면
 * 모델이 쓰는 글이라 모양이 어긋날 때가 있다. 그때는 **나누지 못했다고 알리고**
 * 예전처럼 통짜 편집기(`DocumentWorkbench`)를 보여 준다 — 초안은 멀쩡히 있는데
 * 화면만 비는 일이 없어야 한다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, Users } from "lucide-react";
import { MONTH_FROM, MONTH_LABEL, MONTH_TO } from "@/lib/constants";
import { useApp } from "@/lib/store";
import {
  useChildren,
  useDocumentDraft,
  useMonthActivities,
  useRegenerateDraft,
  useSaveWorkingCopy,
} from "@/lib/queries";
import {
  MAX_FOLDER_PHOTOS,
  readDatedPhotos,
  revokeFolderPhotos,
  usePhotoRoot,
} from "@/lib/face";
import type { FolderPhoto } from "@/lib/face";
import { blockLabel, parse, serialize } from "@/lib/blocks/playStory";
import type { PlayBlock } from "@/lib/blocks/playStory";
import type { PlayPick } from "@/lib/api";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { PhotoFolderBar } from "@/components/face/PhotoFolderBar";
import { PlayPicker } from "@/components/play-story/PlayPicker";
import { PlayBlockEditor } from "@/components/play-story/PlayBlockEditor";
import type { BlockPhotos } from "@/components/play-story/PlayBlockEditor";
import { PlayStoryPreview } from "@/components/play-story/PlayStoryPreview";
import {
  N,
  Notice,
  PageHead,
  Skeleton,
  SpecBar,
} from "@/components/ui";

/** 작업본 자동 저장 간격. 타이핑마다 보내면 서버가 쉼 없이 맞는다. */
const SAVE_DEBOUNCE_MS = 900;

export default function PlayStoryPage() {
  const { toast } = useApp();
  const [className, setClassName] = useState<string | null>(null);
  const [picks, setPicks] = useState<PlayPick[]>([]);
  const [playCount, setPlayCount] = useState(5);

  const childrenQuery = useChildren();
  const photoRoot = usePhotoRoot();

  // 반은 별도 표가 없다 — 아동의 class_name을 모아 중복을 없앤 것이 반 목록이다.
  const classNames = useMemo(() => {
    const names: string[] = [];
    for (const c of childrenQuery.data ?? []) {
      if (c.className && !names.includes(c.className)) names.push(c.className);
    }
    return names.sort();
  }, [childrenQuery.data]);

  // 반이 하나뿐이면 고를 것이 없다. 굳이 한 번 더 누르게 하지 않는다.
  useEffect(() => {
    if (className == null && classNames.length === 1) setClassName(classNames[0]);
  }, [classNames, className]);

  const childCount = useMemo(
    () =>
      (childrenQuery.data ?? []).filter((c) => c.className === className).length,
    [childrenQuery.data, className],
  );

  const activitiesQuery = useMonthActivities(className, MONTH_FROM, MONTH_TO);
  const activities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);

  const draftQuery = useDocumentDraft("play_story", null);
  const draft = draftQuery.data;
  const generate = useRegenerateDraft();
  const saveWorking = useSaveWorkingCopy();

  // ---------------- 블록 상태 ----------------
  //
  // 서버가 주는 것은 텍스트 하나뿐이다. 그것을 블록으로 나눠 여기서 들고,
  // 고칠 때마다 다시 합쳐 작업본으로 저장한다(`serialize` ↔ `parse`).
  const [blocks, setBlocks] = useState<PlayBlock[]>([]);
  const [parseFailed, setParseFailed] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [blockPhotos, setBlockPhotos] = useState<BlockPhotos>({});
  /** 마지막으로 서버에 보낸 본문 — 같은 것을 두 번 보내지 않는다. */
  const savedRef = useRef<string>("");

  /**
   * 초안을 블록으로 나눈다 — **문서가 바뀔 때만.**
   *
   * 본문이 바뀔 때마다 다시 나누면 안 된다. 우리가 저장한 작업본이 그대로
   * 돌아오는 것이라(자동 저장 → 배경 refetch) 그때마다 블록을 새로 만들면
   * **교사가 눌러 둔 확정과 골라 둔 사진이 통째로 날아간다.** 한 번 나눈 뒤로는
   * 여기 블록이 원본이고, 서버에는 합친 텍스트를 보낼 뿐이다.
   */
  const loadedRef = useRef<number>(0);
  useEffect(() => {
    const id = draft?.documentId ?? 0;
    if (!id || loadedRef.current === id) return;
    const source = draft?.working || draft?.content || "";
    if (!source) return;
    loadedRef.current = id;

    const got = parse(source);
    if (got.ok) {
      setBlocks(got.blocks);
      setParseFailed(null);
    } else {
      setBlocks([]);
      setParseFailed(got.reason);
    }
    // 다른 문서다 — 확정과 사진 선택은 그 문서의 것이므로 함께 비운다.
    setConfirmed([]);
    setBlockPhotos({});
    savedRef.current = source;
  }, [draft?.documentId, draft?.working, draft?.content]);

  /**
   * 고친 블록을 작업본으로 저장한다.
   *
   * 저장하는 것은 **합친 텍스트**다 — 서버의 계약이 텍스트 한 덩어리이고,
   * 채택률·수정률 지표도 텍스트 쌍 기준이라 그 형태를 지켜야 한다.
   */
  useEffect(() => {
    if (blocks.length === 0) return;
    const text = serialize(blocks);
    if (text === savedRef.current) return;

    const timer = setTimeout(() => {
      savedRef.current = text;
      saveWorking.mutate({ type: "play_story", childId: null, content: text });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  // ---------------- 사진 ----------------
  const [photos, setPhotos] = useState<FolderPhoto[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const photosRef = useRef<FolderPhoto[]>([]);
  photosRef.current = photos;
  useEffect(() => () => revokeFolderPhotos(photosRef.current), []);

  const rootHandle = photoRoot.handle;
  const rootReady = photoRoot.ready;

  useEffect(() => {
    if (!rootReady || !rootHandle) return;
    let cancelled = false;
    setPhotoLoading(true);
    void readDatedPhotos(rootHandle)
      .then((found) => {
        if (cancelled) {
          revokeFolderPhotos(found.photos);
          return;
        }
        revokeFolderPhotos(photosRef.current);
        setPhotos(found.photos);
        if (found.hitLimit) {
          toast(`사진이 많아 ${MAX_FOLDER_PHOTOS}장까지만 읽었습니다.`);
        }
      })
      .catch((e) => {
        console.error("[놀이이야기] 사진 읽기 실패:", e);
        toast(
          `사진 폴더를 읽지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`,
        );
      })
      .finally(() => {
        if (!cancelled) setPhotoLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootReady, rootHandle]);

  // ---------------- 생성 ----------------
  const runGenerate = () => {
    if (!className) return;
    generate.mutate(
      { type: "play_story", childId: null, className, picks, playCount },
      {
        onSuccess: () => toast("놀이이야기 초안을 만들었습니다"),
        onError: (e) =>
          toast(e instanceof Error ? e.message : "초안을 만들지 못했습니다."),
      },
    );
  };

  const month = Number(MONTH_FROM.slice(5, 7));
  const hasBlocks = blocks.length > 0;

  return (
    <>
      <PageHead
        title="놀이이야기"
        sub="한 달의 놀이를 반별로 모아 가정에 전하는 소식지 — 놀이마다 글과 사진을 함께"
      />
      <SpecBar
        scr="SCR-018"
        fn={["FN-004 놀이이야기+근거"]}
        ep={[
          "EP-054 이 달의 놀이",
          "EP-010 generate",
          "EP-055 칸 재생성",
          "EP-013 작업본",
        ]}
      />

      <div className="stack">
        {/* ---------------- 반 ---------------- */}
        <div className="card">
          <div className="field m-0">
            <label>
              <N n={1} />
              <Users size={14} className="text-muted" />반
            </label>
            {childrenQuery.isLoading ? (
              <Skeleton lines={1} />
            ) : classNames.length === 0 ? (
              <p className="m-0 text-[13px] text-muted">
                반이 지정된 원아가 없습니다. 아동 관리에서 반을 먼저 지정해 주세요.
              </p>
            ) : (
              <>
                <div className="chiprow">
                  {classNames.map((name) => (
                    <button
                      key={name}
                      className={`chip${className === name ? " on" : ""}`}
                      onClick={() => setClassName(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12.5px] text-muted">
                  고른 반의 {MONTH_LABEL} 하루 기록만 근거로 씁니다
                  {className ? ` — 현재 ${childCount}명` : ""}.
                </p>
              </>
            )}
          </div>
        </div>

        {/* ---------------- 사진 폴더 ---------------- */}
        <PhotoFolderBar
          root={photoRoot}
          hint="사진함에서 정한 폴더를 그대로 씁니다. 블록마다 그 날짜의 사진을 골라 넣습니다."
          summary={
            photoLoading ? (
              <>
                <Loader2 size={13} className="mr-1 inline animate-spin" />
                사진 읽는 중…
              </>
            ) : photos.length > 0 ? (
              <>
                사진 <b className="text-ink">{photos.length}</b>장
              </>
            ) : undefined
          }
        />

        {/* ---------------- 이 달의 놀이 고르기 ---------------- */}
        {className && (
          <>
            <div className="text-[12.5px] font-bold text-muted">
              <N n={2} />이 달의 놀이 고르기
            </div>
            <PlayPicker
              activities={activities}
              loading={activitiesQuery.isLoading}
              picks={picks}
              onPicksChange={setPicks}
              playCount={playCount}
              onPlayCountChange={setPlayCount}
              periodLabel={MONTH_LABEL}
              disabled={generate.isPending}
            />

            <div className="btnrow mt-0">
              <button
                className="btn primary big"
                onClick={runGenerate}
                disabled={generate.isPending || draftQuery.isLoading}
              >
                <N n={3} />
                {generate.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> 만드는 중…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    {hasBlocks ? "놀이이야기 다시 만들기" : "놀이이야기 만들기"}
                  </>
                )}
              </button>
              <span className="text-[12.5px] text-muted">
                <b>{className}</b>의 {MONTH_LABEL} 기록으로 소주제 {playCount}개를
                만듭니다. 20~40초쯤 걸립니다.
                {hasBlocks && (
                  <>
                    {" "}
                    <b>다시 만들면 지금 블록이 새로 만들어집니다</b> — 고쳐 둔 내용은
                    사라집니다.
                  </>
                )}
              </span>
            </div>
          </>
        )}

        {!className && (
          <Notice kind="soft">
            <span>
              먼저 <b>반을 골라 주세요.</b> 놀이이야기는 반마다 따로 나가는
              소식지라, 반을 정해야 그 반의 기록만 모을 수 있습니다.
            </span>
          </Notice>
        )}

        {/* ---------------- 블록 편집 ---------------- */}
        {draftQuery.isLoading ? (
          <div className="card">
            <Skeleton lines={6} />
          </div>
        ) : hasBlocks && draft ? (
          <>
            <div className="card" style={{ padding: "13px 16px" }}>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="badge-final">
                  ✓ 확정 {confirmed.length} / {blocks.length}
                </span>
                <span className="text-[12.5px] text-muted">
                  {className} · {MONTH_LABEL} · 사진{" "}
                  {Object.values(blockPhotos).reduce((s, v) => s + v.length, 0)}장
                  선택됨
                </span>
                <span className="flex-1" />
                {confirmed.length > 0 && (
                  <button
                    className="btn px-3 py-1.5 text-[12.5px]"
                    onClick={() => setConfirmed([])}
                  >
                    확정 모두 풀기
                  </button>
                )}
              </div>
            </div>

            <PlayBlockEditor
              documentId={draft.documentId}
              blocks={blocks}
              onBlocksChange={setBlocks}
              confirmed={confirmed}
              onConfirmedChange={setConfirmed}
              photos={photos}
              blockPhotos={blockPhotos}
              onBlockPhotosChange={setBlockPhotos}
              activities={activities}
              disabled={generate.isPending}
            />

            <PlayStoryPreview
              blocks={blocks}
              confirmed={confirmed}
              photos={photos}
              blockPhotos={blockPhotos}
              root={photoRoot.handle}
              folderName={`${month}월 놀이이야기`}
              monthLabel={`${month}월`}
            />
          </>
        ) : parseFailed ? (
          <>
            <Notice kind="warn">
              ⚠{" "}
              <span>
                초안을 놀이별로 나누지 못했습니다({parseFailed}). 아래에서 지금까지처럼
                통째로 고칠 수 있습니다 — <b>초안은 그대로 있습니다.</b>
              </span>
            </Notice>
            <DocumentWorkbench
              type="play_story"
              className={className}
              canGenerate={!!className}
              generateLabel="놀이이야기 다시 만들기"
              source={
                <p className="m-0 py-2 text-[13px] text-muted">
                  {className} · {MONTH_LABEL}
                </p>
              }
              emptyMessage={
                className
                  ? `${className}의 ${MONTH_LABEL} 하루 기록이 없습니다.`
                  : "반을 먼저 골라 주세요."
              }
            />
          </>
        ) : null}

        <Notice kind="soft">
          <span>
            말풍선 문구는 <b>AI가 제안한 초안</b>입니다. 하루 기록에는 아이가 한
            말이 담기지 않으므로, 실제로 아이가 한 말로 바꿔 넣어 주세요.
          </span>
        </Notice>
      </div>
    </>
  );
}
