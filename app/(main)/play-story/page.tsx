"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Users } from "lucide-react";
import { MONTH_LABEL } from "@/lib/constants";
import { useChildren, useDocumentDraft } from "@/lib/queries";
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
        sidePanel={<PhotoPanel suggestions={suggestions} />}
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
 * 사진 패널 — 소주제 날짜에 맞는 사진 후보를 옆에 둔다.
 *
 * 초안의 소주제가 `1. 낙엽 밟기 산책해요 (10/6)`처럼 날짜를 달고 나오고,
 * 후보도 같은 기준(날짜 + 활동)으로 묶여 오므로 날짜로 짝이 맞는다.
 *
 * **비어 있는 것이 정상 상태다.** 서버는 사진의 날짜를 교사가 일지에 붙여 둔
 * 것(`record_id`)으로만 안다 — 업로드 시각은 촬영일이 아니라서 쓸 수 없다.
 * 아직 붙인 사진이 없으면 초안 본문의 '추천 사진 가이드'가 그 자리를 대신한다.
 */
function PhotoPanel({ suggestions }: { suggestions: PhotoSuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <div className="card">
        <p className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Camera size={14} className="text-muted" />
          사진 후보
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          이 기간의 하루 기록에 붙여 둔 사진이 없습니다. 초안의{" "}
          <b>추천 사진 가이드</b>를 보고 어떤 장면을 담으면 좋을지 정한 뒤,
          하루 기록에 사진을 붙이면 여기에 날짜별로 모입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Camera size={14} className="text-muted" />
        사진 후보
        <span className="font-normal text-muted">
          — 소주제 옆 날짜와 맞춰 보세요
        </span>
      </p>
      <table className="tbl mt-2">
        <tbody>
          {suggestions.map((s) => (
            <tr key={`${s.date}-${s.activity ?? ""}`}>
              <td className="w-[76px] whitespace-nowrap font-mono text-muted">
                {s.date.slice(5).replace("-", "/")}
              </td>
              <td>
                {s.activity ?? <span className="text-muted">활동 미기재</span>}
              </td>
              <td className="w-[64px] whitespace-nowrap text-right">
                {s.photos.length}장
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12.5px] text-muted">
        고르는 것은 선생님입니다 — AI는 그날 찍힌 사진을 모아 둘 뿐입니다.
      </p>
    </div>
  );
}
