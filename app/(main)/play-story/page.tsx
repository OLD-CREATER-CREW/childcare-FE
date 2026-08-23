"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Users } from "lucide-react";
import { MONTH_FROM, MONTH_LABEL } from "@/lib/constants";
import { useChildren, useDocumentDraft } from "@/lib/queries";
import { draftDates, groupByDate, useSessionShots } from "@/lib/face";
import type { SessionShot } from "@/lib/face";
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
            className={className}
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
 *   이 PC: 사진함에서 방금 분류한 사진(`lib/face/sessionShots`). 썸네일까지 있다.
 *
 * 교사가 묻는 것은 "이 소주제에 쓸 사진이 뭐가 있나" 하나뿐이라, 날짜를 축으로
 * 한 표에 놓는다. 다만 **출처는 행마다 분명히 적는다** — 어느 쪽이 서버에 남는
 * 사진인지 구분되지 않으면 안 된다. 로컬 사진은 서버로 가지 않고 새로고침하면
 * 사라지며(`ml/pipeline/INTERFACE.md` 1절), 그 차이가 교사의 판단을 바꾼다.
 *
 * ■ 비어 있는 것이 정상 상태다
 * 서버는 사진의 날짜를 `record_id`로만 안다 — 업로드 시각은 촬영일이 아니라서
 * 쓸 수 없다. 붙여 둔 사진도 분류한 사진도 없으면 초안 본문의 '추천 사진
 * 가이드'가 그 자리를 대신한다.
 */
function PhotoPanel({
  suggestions,
  className,
  draft,
}: {
  suggestions: PhotoSuggestion[];
  className: string | null;
  draft: string;
}) {
  const shots = useSessionShots(className);

  // 초안 소주제의 날짜는 `(8/16, 8/19)`처럼 연도가 없다. 놀이이야기는 한 달짜리
  // 문서라 대상 기간의 연도를 붙이면 된다.
  const wanted = useMemo(
    () => draftDates(draft, Number(MONTH_FROM.slice(0, 4))),
    [draft],
  );

  /** 두 출처를 날짜로 합친다. 같은 날 서버·로컬이 다 있으면 한 행에 들어간다. */
  const rows = useMemo(() => {
    const map = new Map<
      string,
      { date: string; activity: string | null; server: number; local: SessionShot[] }
    >();
    const at = (date: string) => {
      const hit = map.get(date);
      if (hit) return hit;
      const made = { date, activity: null as string | null, server: 0, local: [] as SessionShot[] };
      map.set(date, made);
      return made;
    };

    for (const s of suggestions) {
      const row = at(s.date);
      row.activity = row.activity ?? s.activity;
      row.server += s.photos.length;
    }
    for (const g of groupByDate(shots)) at(g.date).local.push(...g.shots);

    return Array.from(map.values()).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
  }, [suggestions, shots]);

  if (rows.length === 0) {
    return (
      <div className="card">
        <p className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Camera size={14} className="text-muted" />
          사진 후보
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          이 기간에 쓸 사진이 없습니다. 초안의 <b>추천 사진 가이드</b>를 보고 어떤
          장면을 담을지 정한 뒤, 사진함에서 분류하거나 하루 기록에 사진을 붙이면
          여기에 날짜별로 모입니다.
        </p>
      </div>
    );
  }

  const localTotal = rows.reduce((n, r) => n + r.local.length, 0);

  return (
    <div className="card">
      <p className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Camera size={14} className="text-muted" />
        사진 후보
        <span className="font-normal text-muted">
          — 소주제 옆 날짜와 맞춰 보세요
        </span>
      </p>

      <div className="mt-2">
        {rows.map((r) => (
          <PhotoDateRow key={r.date} row={r} matched={wanted.has(r.date)} />
        ))}
      </div>

      <p className="mt-3 text-[12.5px] text-muted">
        고르는 것은 선생님입니다 — AI는 그날 찍힌 사진을 모아 둘 뿐입니다.
      </p>
      {localTotal > 0 && (
        <p className="mt-1 text-[12.5px] text-muted">
          <b>이 PC</b> 표시가 붙은 {localTotal}장은 서버에 올라가지 않으며,
          새로고침하면 목록에서 사라집니다.
        </p>
      )}
    </div>
  );
}

/**
 * 날짜 한 줄. 소주제 날짜와 맞으면 왼쪽에 선을 그어 눈에 띄게 한다 —
 * 초안과 짝이 맞는 날을 교사가 먼저 보게 하려는 것이다.
 */
function PhotoDateRow({
  row,
  matched,
}: {
  row: { date: string; activity: string | null; server: number; local: SessionShot[] };
  matched: boolean;
}) {
  const names = Array.from(new Set(row.local.flatMap((s) => s.childNames)));

  return (
    <div
      className={`border-line border-t py-2 first:border-t-0 ${
        matched ? "border-l-2 border-l-green-deep pl-2.5" : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[12.5px] text-muted">
          {row.date.slice(5).replace("-", "/")}
        </span>
        <span className="text-[13px]">
          {row.activity ?? <span className="text-muted">활동 미기재</span>}
        </span>
        <span className="ml-auto whitespace-nowrap text-[12.5px] text-muted">
          {row.server > 0 && <>서버 {row.server}장</>}
          {row.server > 0 && row.local.length > 0 && " · "}
          {row.local.length > 0 && (
            <b className="text-ink">이 PC {row.local.length}장</b>
          )}
        </span>
      </div>

      {row.local.length > 0 && (
        <>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {row.local.map((s) => (
              // 로컬 objectURL이라 next/image의 최적화 대상이 아니다 — 그대로 쓴다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={s.id}
                src={s.url}
                alt={`${row.date} ${s.childNames.join(", ")}`}
                title={s.file.name}
                className="h-14 w-14 rounded-md object-cover"
              />
            ))}
          </div>
          {names.length > 0 && (
            <p className="mt-1 text-[12.5px] text-muted">{names.join(", ")}</p>
          )}
        </>
      )}
    </div>
  );
}
