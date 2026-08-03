"use client";

import { TODAY } from "@/lib/constants";
import { useApp } from "@/lib/store";
import { useChildren, useRecordSummary } from "@/lib/queries";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { PageHead, Skeleton, SpecBar } from "@/components/ui";

// SCR-006 보육일지 — 공식 문서 톤 · 발송 없이 확정으로 종료 (EP-015 없음)
export default function JournalPage() {
  const { auth } = useApp();
  const childrenQuery = useChildren();
  const summaryQuery = useRecordSummary();

  const kids = childrenQuery.data ?? [];
  const attending = kids.filter((c) => c.attending).length;
  const absent = kids.length - attending;

  return (
    <>
      <PageHead
        title="보육일지"
        sub={`${auth?.centerName ?? ""} ${TODAY} — 공식 문서 톤 · 발송 없이 확정으로 종료`.trim()}
      />
      <SpecBar
        scr="SCR-006"
        fn={["FN-003 파생", "FN-005 확정"]}
        ep={["EP-010 generate(journal)", "EP-013", "EP-014"]}
      />
      <DocumentWorkbench
        type="journal"
        source={
          childrenQuery.isLoading || summaryQuery.isLoading ? (
            <Skeleton lines={5} />
          ) : (
            <table className="tbl">
              <tbody>
                <tr>
                  <td className="w-20 text-muted">출결</td>
                  <td>
                    등원 {attending}명 / 결석 {absent}명
                  </td>
                </tr>
                <tr>
                  <td className="text-muted">하루 기록</td>
                  <td>
                    {summaryQuery.data?.done ?? 0}/{summaryQuery.data?.total}명
                    작성 — 오늘 기록 전체가 일지의 원천
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
