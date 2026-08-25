"use client";

import { useState } from "react";
import { DATE_OPTIONS, TODAY, dateLabel } from "@/lib/constants";
import { useApp } from "@/lib/store";
import { useChildren, useDayRecordedIds } from "@/lib/queries";
import { JournalGenerator } from "@/components/document/JournalGenerator";
import { DocumentTemplateBar } from "@/components/document/DocumentTemplateBar";
import { PageHead, Select, Skeleton, SpecBar } from "@/components/ui";

/**
 * SCR-006 보육일지 — 버튼 하나로 완성 한글 파일까지.
 *
 * 이 화면의 산출물은 글이 아니라 **한글 파일**이다. 원에 제출하는 것은 원 서식에
 * 채워진 주간보육일지라, 화면 맨 위에 서식을 올리는 칸을 둔다
 * (`DocumentTemplateBar`).
 *
 * **다른 문서와 달리 화면 안의 검토·수정 단계를 두지 않는다.** 고칠 곳이 있으면
 * 받은 hwpx를 한글에서 직접 고치는 편이 칸을 하나씩 눌러 고치는 것보다 빠르다 —
 * 어차피 교사는 제출 전에 한글에서 파일을 연다. 그래서 워크벤치(초안 → 칸 편집 →
 * 확정 → 문서 만들기 → 내려받기) 대신 `JournalGenerator` 한 장을 쓴다.
 *
 * 일지는 **날짜 단위 문서**다(EP-010의 `date`). 오늘만 쓸 수 있으면 어제 못 쓴
 * 일지를 이 화면에서 만들 수 없어, 하루 기록(SCR-003)과 같은 날짜 선택을 둔다.
 * 고른 날짜는 조회·생성·내려받기까지 한 줄로 따라간다.
 */
export default function JournalPage() {
  const { auth } = useApp();
  const [date, setDate] = useState(TODAY);
  const childrenQuery = useChildren();
  const recordedQuery = useDayRecordedIds(date);

  const kids = childrenQuery.data ?? [];
  const attending = kids.filter((c) => c.attending).length;
  const absent = kids.length - attending;
  const recorded = recordedQuery.data?.length ?? 0;

  return (
    <>
      <PageHead
        title="보육일지"
        sub={`${auth?.centerName ?? ""} ${dateLabel(date)} — 우리 원 서식에 채워 한글 파일로 받습니다`.trim()}
        right={
          <Select
            className="w-fit"
            value={date}
            onChange={setDate}
            ariaLabel="일지 날짜"
            options={DATE_OPTIONS}
          />
        }
      />
      <SpecBar
        scr="SCR-006"
        fn={["FN-003 파생", "FN-019 양식", "FN-020 파일"]}
        ep={[
          "EP-010 generate(journal, date) → 한글 파일",
          "EP-012 date",
          "EP-032 서식 업로드",
          "EP-036 다시 받기",
        ]}
      />
      <DocumentTemplateBar type="journal" date={date} />
      <JournalGenerator
        date={date}
        source={
          childrenQuery.isLoading || recordedQuery.isLoading ? (
            <Skeleton lines={5} />
          ) : (
            <table className="tbl">
              <tbody>
                <tr>
                  <td className="w-20 text-muted">날짜</td>
                  <td>
                    {dateLabel(date)}
                    {date === TODAY ? "" : " — 지난 날짜의 일지입니다"}
                  </td>
                </tr>
                {/* 출결은 지금 등원 상태라 오늘에만 뜻이 있다. 지난 날짜에
                    오늘의 등원 수를 얹으면 사실이 아닌 숫자가 일지로 들어간다. */}
                {date === TODAY && (
                  <tr>
                    <td className="text-muted">출결</td>
                    <td>
                      등원 {attending}명 / 결석 {absent}명
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="text-muted">하루 기록</td>
                  <td>
                    {recorded}/{kids.length}명 작성 — 그날 기록 전체가 일지의
                    원천
                  </td>
                </tr>
                <tr>
                  <td className="text-muted">급식</td>
                  <td>정상 배식 · 알레르기 대체식 3건</td>
                </tr>
                <tr>
                  <td className="text-muted">낮잠</td>
                  <td>평균 1시간 20분</td>
                </tr>
                <tr>
                  <td className="text-muted">특이</td>
                  <td>또래 갈등 1건 (중재 후 해결)</td>
                </tr>
              </tbody>
            </table>
          )
        }
      />
    </>
  );
}
