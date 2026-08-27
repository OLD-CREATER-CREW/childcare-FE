"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, FolderDown, FolderOpen, Loader2, Users } from "lucide-react";
import { MONTH_FROM, MONTH_LABEL } from "@/lib/constants";
import { useApp } from "@/lib/store";
import { useChildren, useDocumentDraft } from "@/lib/queries";
import {
  MAX_FOLDER_PHOTOS,
  WritePermissionDeniedError,
  draftDates,
  groupByDate,
  readDatedPhotos,
  recommendFolderName,
  revokeFolderPhotos,
  saveRecommended,
  usePhotoRoot,
} from "@/lib/face";
import type { FolderPhoto } from "@/lib/face";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { N, Notice, PageHead, Skeleton, SpecBar } from "@/components/ui";
import type { PhotoSuggestion } from "@/lib/types";

/**
 * SCR-0xx 놀이이야기 — 한 달의 놀이를 가정에 전하는 소식지.
 *
 * 계획안(SCR-007)과 흐름이 비슷하지만 **범위를 정하는 축이 다르다.** 알림장은
 * 아이 하나, 계획안은 반 전체를 뭉뚱그리는데, 놀이이야기는 **반 하나**다.
 * 서식이 제목에 반 이름을 요구하기 때문이다("[반이름] 놀이이야기"). 그래서
 * 이 화면에만 반 선택이 있고, 고르지 않으면 생성 버튼이 잠긴다(서버도 400으로
 * 막지만 누르기 전에 알려 주는 편이 낫다).
 */
export default function PlayStoryPage() {
  const [className, setClassName] = useState<string | null>(null);
  const [topic, setTopic] = useState("");

  const childrenQuery = useChildren();

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

  const draftQuery = useDocumentDraft("play_story", null);
  const suggestions = draftQuery.data?.photoSuggestions ?? [];

  return (
    <>
      <PageHead
        title="놀이이야기"
        sub="한 달의 놀이를 반별로 모아 가정에 전하는 소식지 — 사진 자리까지 함께"
      />
      <SpecBar
        scr="SCR-018"
        fn={["FN-004 놀이이야기+근거"]}
        ep={["EP-010 generate(play_story)", "EP-013", "EP-014"]}
      />

      <div className="card mb-4">
        <div className="field">
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

        <div className="field m-0">
          <label>
            <N n={2} />이 달의 놀이 주제
          </label>
          <input
            className="input w-full max-w-[520px]"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 가을 숲과 열매를 만나요 / 즐거운 여름 물놀이"
            maxLength={100}
          />
          <p className="mt-2 text-[12.5px] text-muted">
            비워 두면 이 달 기록에서 중심 놀이를 골라 AI가 주제를 정합니다.
          </p>
        </div>
      </div>

      <DocumentWorkbench
        key={className ?? "none"}
        type="play_story"
        className={className}
        topic={topic}
        canGenerate={!!className}
        generateLabel="놀이이야기 만들기"
        generateHint={
          !className ? (
            <>
              먼저 <b>반을 골라 주세요.</b> 놀이이야기는 반마다 따로 나가는
              소식지라, 반을 정해야 그 반의 기록만 모을 수 있습니다.
            </>
          ) : topic.trim() ? (
            <>
              <b>{className}</b>의 {MONTH_LABEL} 기록으로 주제{" "}
              <b>&ldquo;{topic.trim()}&rdquo;</b>의 놀이이야기를 만듭니다.
              20~40초쯤 걸립니다.
            </>
          ) : (
            <>
              <b>{className}</b>의 {MONTH_LABEL} 기록으로 놀이이야기를 만듭니다.
              주제를 적으면 그 주제로 묶어 드립니다. 20~40초쯤 걸립니다.
            </>
          )
        }
        emptyMessage={
          className
            ? `${className}의 ${MONTH_LABEL} 하루 기록이 없습니다. 기록을 먼저 남겨 주세요.`
            : "반을 먼저 골라 주세요."
        }
        source={<PlayStorySource className={className} topic={topic} />}
        sidePanel={
          <PhotoPanel
            suggestions={suggestions}
            draft={draftQuery.data?.working ?? draftQuery.data?.content ?? ""}
          />
        }
      />

      <div className="mt-4">
        <Notice kind="soft">
          말풍선 문구는 <b>AI가 제안한 초안</b>입니다. 하루 기록에는 아이가 한
          말이 담기지 않으므로, 실제로 아이가 한 말로 바꿔 넣어 주세요.
        </Notice>
      </div>
    </>
  );
}

/** 원천 패널 — 무엇을 근거로 만드는지 생성 전에 보여 준다. */
function PlayStorySource({
  className,
  topic,
}: {
  className: string | null;
  topic: string;
}) {
  return (
    <table className="tbl">
      <tbody>
        <tr>
          <td className="w-[92px] whitespace-nowrap text-muted">반</td>
          <td>
            {className ? (
              <b>{className}</b>
            ) : (
              <span className="text-muted">미선택 — 먼저 골라 주세요</span>
            )}
          </td>
        </tr>
        <tr>
          <td className="whitespace-nowrap text-muted">기간</td>
          <td className="font-mono">{MONTH_LABEL}</td>
        </tr>
        <tr>
          <td className="whitespace-nowrap text-muted">주제</td>
          <td>
            {topic.trim() ? (
              <b>{topic.trim()}</b>
            ) : (
              <span className="text-muted">미지정 — 기록에서 AI가 정합니다</span>
            )}
          </td>
        </tr>
        <tr>
          <td className="whitespace-nowrap text-muted">기록</td>
          <td>이 반, 이 기간의 하루 기록 — 같은 날 같은 놀이는 하나로 묶임</td>
        </tr>
        <tr>
          <td className="whitespace-nowrap text-muted">근거</td>
          <td>누리과정 5영역 + 어린이집 평가지표(놀이 공간·상호작용)</td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * 사진 후보 패널 — 소주제 날짜에 맞는 사진을 **한 표에** 모은다.
 *
 * ■ 출처가 둘이다
 *   서버 : 교사가 하루 기록에 붙여 둔 사진(`photos.record_id`). 개수만 안다.
 *   이 PC: 사진함 내보내기가 만든 폴더(`lib/face/photoFolder`). 실물이 보인다.
 *
 * 교사가 묻는 것은 "이 소주제에 쓸 사진이 뭐가 있나" 하나뿐이라, 날짜를 축으로
 * 한 표에 놓는다. 다만 **출처는 행마다 분명히 적는다** — 어느 쪽이 서버에 남는
 * 사진인지 구분되지 않으면 안 된다. 폴더 사진은 교사 PC 를 벗어나지 않으며
 * (`ml/pipeline/INTERFACE.md` 1절), 그 차이가 교사의 판단을 바꾼다.
 *
 * ■ 고른 사진을 한 폴더로 모아 준다
 * 소식지에 넣을 사진은 결국 한 곳에 모아야 한다. 날짜 폴더 여기저기서 손으로
 * 복사하는 대신, 고른 것을 원본 폴더 안 `{N}월 놀이이야기 사진 추천` 에 써 준다.
 *
 * ■ 왜 폴더를 매번 고르게 하나
 * 폴더 핸들을 브라우저 저장소에 넣어 두면 다음부터 자동으로 읽을 수 있지만,
 * 아동 사진이 든 폴더를 앱이 조용히 계속 들여다보는 모양이 된다. 교사가 볼
 * 때마다 직접 고르는 편이 낫다.
 *
 * ■ 비어 있는 것이 정상 상태다
 * 서버는 사진의 날짜를 `record_id` 로만 안다 — 업로드 시각은 촬영일이 아니라서
 * 쓸 수 없다. 붙여 둔 사진도 지정한 폴더도 없으면 초안 본문의 '추천 사진
 * 가이드'가 그 자리를 대신한다.
 */
function PhotoPanel({
  suggestions,
  draft,
}: {
  suggestions: PhotoSuggestion[];
  draft: string;
}) {
  const { toast } = useApp();
  // 사진 폴더는 사진함에서 한 번 정해 두면 여기서도 그대로 쓴다
  // (`lib/face/photoRoot.ts`). 예전에는 이 화면에서 또 골라야 했다.
  const photoRoot = usePhotoRoot();
  const [photos, setPhotos] = useState<FolderPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // 화면을 떠날 때 썸네일 objectURL 을 반드시 해제한다. 지금 값을 ref 로 들고
  // 있어야 cleanup 이 옛 배열을 잡지 않는다.
  const photosRef = useRef<FolderPhoto[]>([]);
  photosRef.current = photos;
  useEffect(() => () => revokeFolderPhotos(photosRef.current), []);

  const month = Number(MONTH_FROM.slice(5, 7));
  const outName = recommendFolderName(month);

  const rootHandle = photoRoot.handle;
  const rootReady = photoRoot.ready;

  /**
   * 정해 둔 사진 폴더에서 후보를 읽는다.
   *
   * 예전에는 이 화면에서 폴더를 따로 골랐다. 사진함에서 방금 내보낸 그 폴더를
   * 다시 찾아 주는 셈이라, 이제는 앱이 기억한 폴더를 그대로 읽는다.
   */
  const load = async () => {
    if (!rootHandle) return;
    setLoading(true);
    try {
      const found = await readDatedPhotos(rootHandle);
      revokeFolderPhotos(photosRef.current); // 이전 것을 먼저 놓아준다
      setPhotos(found.photos);
      setSel([]);
      if (found.photos.length === 0) {
        toast("날짜 폴더(YYYY-MM-DD) 안에서 사진을 찾지 못했습니다.");
      } else if (found.hitLimit) {
        toast(`사진이 많아 ${MAX_FOLDER_PHOTOS}장까지만 읽었습니다.`);
      }
    } catch (e) {
      // 실패 원인을 삼키지 않는다. "권한을 확인하세요"만 띄웠다가 정작 원인이
      // 코드 버그였던 적이 있다 — 무엇이 터졌는지 화면과 콘솔 양쪽에 남긴다.
      console.error("[사진 폴더] 읽기 실패:", e);
      toast(
        `폴더를 읽지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  // 폴더가 준비되면(또는 바뀌면) 알아서 읽는다.
  useEffect(() => {
    if (rootReady) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootReady, rootHandle]);

  const save = async () => {
    if (!rootHandle || sel.length === 0) return;
    const chosen = photos.filter((p) => sel.indexOf(p.id) >= 0);
    setSaving(true);
    try {
      const { written } = await saveRecommended(rootHandle, chosen, outName);
      toast(`${written}장을 「${outName}」 폴더에 모았습니다.`);
      setSel([]);
    } catch (e) {
      if (e instanceof WritePermissionDeniedError) {
        toast("폴더에 쓸 권한이 없어 저장하지 못했습니다.");
        return;
      }
      console.error("[사진 폴더] 저장 실패:", e);
      toast(
        `저장하지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) =>
    setSel((prev) =>
      prev.indexOf(id) >= 0 ? prev.filter((x) => x !== id) : prev.concat(id),
    );

  // 초안 소주제의 날짜는 `(8/16, 8/19)`처럼 연도가 없다. 놀이이야기는 한 달짜리
  // 문서라 대상 기간의 연도를 붙이면 된다.
  const wanted = useMemo(
    () => draftDates(draft, Number(MONTH_FROM.slice(0, 4))),
    [draft],
  );

  /** 두 출처를 날짜로 합친다. 같은 날 서버·폴더가 다 있으면 한 행에 들어간다. */
  const rows = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        activity: string | null;
        server: number;
        local: FolderPhoto[];
      }
    >();
    const at = (date: string) => {
      const hit = map.get(date);
      if (hit) return hit;
      const made = {
        date,
        activity: null as string | null,
        server: 0,
        local: [] as FolderPhoto[],
      };
      map.set(date, made);
      return made;
    };

    for (const s of suggestions) {
      const row = at(s.date);
      row.activity = row.activity ?? s.activity;
      row.server += s.photos.length;
    }
    for (const g of groupByDate(photos)) at(g.date).local.push(...g.photos);

    return Array.from(map.values()).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
  }, [suggestions, photos]);

  /** 초안 소주제 날짜와 맞는 사진 수 — 교사가 먼저 알고 싶어 하는 값이다. */
  const matchedTotal = useMemo(
    () => photos.filter((p) => wanted.has(p.date)).length,
    [photos, wanted],
  );

  /** 초안 소주제와 날짜가 맞는 사진만 한 번에 고른다 — 손이 가장 많이 가는 일이다. */
  const selectMatched = () => {
    const ids = photos.filter((p) => wanted.has(p.date)).map((p) => p.id);
    setSel(ids);
    if (ids.length === 0) toast("초안 소주제 날짜와 맞는 사진이 없습니다.");
  };

  return (
    <div className="card">
      <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Camera size={14} className="text-muted" />
        사진 후보
        <span className="font-normal text-muted">
          — 소주제 옆 날짜와 맞춰 보세요
        </span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        {photoRoot.label && (
          <span className="text-[12.5px] text-muted">
            <code className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-[11.5px] text-ink">
              {photoRoot.label}
            </code>{" "}
            · {photos.length}장
            {matchedTotal > 0 && (
              <>
                {" · "}
                <b className="text-green-deep">소주제 날짜 {matchedTotal}장</b>
              </>
            )}
          </span>
        )}
        {photoRoot.needsPermission ? (
          <button
            className="btn"
            onClick={() => void photoRoot.reconnect()}
            disabled={loading || saving}
          >
            <FolderOpen size={14} /> 폴더 다시 연결
          </button>
        ) : photoRoot.label ? (
          <button
            className="btn"
            onClick={() => void load()}
            disabled={loading || saving || !photoRoot.ready}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> 읽는 중…
              </>
            ) : (
              <>
                <FolderOpen size={14} /> 새로 읽기
              </>
            )}
          </button>
        ) : (
          <button
            className="btn"
            onClick={() => void photoRoot.choose()}
            disabled={loading || saving || !photoRoot.supported}
          >
            <FolderOpen size={14} /> 사진 폴더 지정
          </button>
        )}
      </div>

      {!photoRoot.label && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          사진함에서 정한 <b>사진 폴더</b>를 그대로 씁니다. 아직 안 정했다면 위
          버튼으로 한 번만 정해 주세요 — 그 안의 <code>아이이름/날짜</code>{" "}
          구조를 읽어 소주제 날짜와 맞춰 드립니다. 사진은 이 PC를 벗어나지
          않습니다.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          이 기간에 쓸 사진이 없습니다. 초안의 <b>추천 사진 가이드</b>를 보고 어떤
          장면을 담을지 정한 뒤, 사진함에서 분류·내보내기 하거나 하루 기록에
          사진을 붙이면 여기에 날짜별로 모입니다.
        </p>
      ) : (
        <div className="mt-3">
          {rows.map((r) => (
            <PhotoDateRow
              key={r.date}
              row={r}
              matched={wanted.has(r.date)}
              sel={sel}
              onToggle={toggle}
            />
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div className="btnrow mt-3">
          <button
            className="btn primary"
            onClick={() => void save()}
            disabled={saving || sel.length === 0}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> 모으는 중…
              </>
            ) : (
              <>
                <FolderDown size={14} /> 고른 사진 모으기
                {sel.length > 0 ? ` (${sel.length})` : ""}
              </>
            )}
          </button>
          <button
            className="btn ghost"
            onClick={selectMatched}
            disabled={saving}
          >
            소주제 날짜만 고르기
          </button>
          {sel.length > 0 && (
            <button
              className="btn ghost"
              onClick={() => setSel([])}
              disabled={saving}
            >
              선택 비우기
            </button>
          )}
        </div>
      )}

      <p className="mt-3 text-[12.5px] text-muted">
        고르는 것은 선생님입니다 — AI는 그날 찍힌 사진을 모아 둘 뿐입니다.
      </p>
      {photos.length > 0 && (
        <p className="mt-1 text-[12.5px] text-muted">
          고른 사진은 <b>{photoRoot.label}</b> 안에 <b>{outName}</b> 폴더를 만들어
          복사합니다. 원본은 그대로 두고, 서버에는 올라가지 않습니다.
        </p>
      )}
    </div>
  );
}

/**
 * 날짜 한 줄. 소주제 날짜와 맞으면 왼쪽에 선을 그어 눈에 띄게 한다 —
 * 초안과 짝이 맞는 날을 교사가 먼저 보게 하려는 것이다.
 *
 * 사진은 사진함 분류 탭과 **같은 `.photogrid`·`.photo` 를 쓴다.** 얼굴이 보일
 * 만큼 커야 고를 수 있고, 두 화면에서 고르는 동작이 같아야 헷갈리지 않는다.
 */
function PhotoDateRow({
  row,
  matched,
  sel,
  onToggle,
}: {
  row: {
    date: string;
    activity: string | null;
    server: number;
    local: FolderPhoto[];
  };
  matched: boolean;
  sel: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className={
        matched
          ? // 초안이 실제로 쓴 날짜다. 가는 선 하나로는 눈에 안 들어와서
            // 바탕색·굵은 날짜·배지까지 함께 준다 — 교사가 이 줄부터 본다.
            "my-1.5 rounded-lg border-l-[3px] border-l-green-deep bg-green-ghost px-2.5 py-2.5"
          : "border-line border-t py-2.5 first:border-t-0"
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={`font-mono text-[12.5px] ${
            matched ? "font-bold text-green-deep" : "text-muted"
          }`}
        >
          {row.date.slice(5).replace("-", "/")}
        </span>
        {matched && (
          <span className="rounded-md bg-green-soft px-1.5 py-0.5 text-[10.5px] font-bold text-green-deep">
            소주제 날짜
          </span>
        )}
        {/* 활동명은 서버 기록에만 있다. 폴더에서만 온 날짜는 비워 둔다 —
            "활동 미기재" 같은 빈자리 표시는 알려 주는 것 없이 줄만 어지럽힌다. */}
        {row.activity && <span className="text-[13px]">{row.activity}</span>}
        <span className="ml-auto whitespace-nowrap text-[12.5px] text-muted">
          {row.server > 0 && <>서버 {row.server}장</>}
          {row.server > 0 && row.local.length > 0 && " · "}
          {row.local.length > 0 && (
            <b className="text-ink">이 PC {row.local.length}장</b>
          )}
        </span>
      </div>

      {row.local.length > 0 && (
        <div className="photogrid">
          {row.local.map((p) => {
            const on = sel.indexOf(p.id) >= 0;
            return (
              <button
                key={p.id}
                type="button"
                className={`photo ${on ? "sel" : ""}`}
                onClick={() => onToggle(p.id)}
                aria-pressed={on}
                aria-label={`${p.date} ${p.childName} ${p.name}`}
                title={p.id}
              >
                {/* 로컬 objectURL 이라 next/image 의 최적화 대상이 아니다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`${row.date} ${p.childName}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span className="ck">{on ? "✓" : ""}</span>
                {p.childName && <span className="sim">{p.childName}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
