"use client";

import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { PageHead, SpecBar } from "@/components/ui";

// SCR-006 보육일지 — 공식 문서 톤 · 발송 없이 확정으로 종료 (EP-015 없음)
export default function JournalPage() {
  return (
    <>
      <PageHead
        title="보육일지"
        sub="해님반 · 2026-07-16 — 공식 문서 톤 · 발송 없이 확정으로 종료"
      />
      <SpecBar
        scr="SCR-006"
        fn={["FN-003 파생", "FN-005 확정"]}
        ep={["EP-010 generate(journal)", "EP-013", "EP-014"]}
      />
      <DocumentWorkbench
        type="journal"
        source={
          <table className="tbl">
            <tbody>
              <tr>
                <td className="w-16 text-muted">출결</td>
                <td>등원 14 / 결석 1</td>
              </tr>
              <tr>
                <td className="text-muted">오전</td>
                <td>바깥놀이 (대근육)</td>
              </tr>
              <tr>
                <td className="text-muted">점심</td>
                <td>정상 배식</td>
              </tr>
              <tr>
                <td className="text-muted">낮잠</td>
                <td>평균 1시간 20분</td>
              </tr>
              <tr>
                <td className="text-muted">특이</td>
                <td>다툼 1건 (해결)</td>
              </tr>
            </tbody>
          </table>
        }
      />
    </>
  );
}
