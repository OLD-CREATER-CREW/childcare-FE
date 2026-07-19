"use client";

import { useObservations } from "@/lib/queries";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { Notice, PageHead, Skeleton, SpecBar } from "@/components/ui";

// SCR-011 발달평가서 — 누적 관찰 종합 (컷 시 목업 시연)
export default function EvaluationsPage() {
  const obsQuery = useObservations("c01");

  return (
    <>
      <PageHead
        title="발달평가서"
        sub="김민준 · 2026 — 누적 관찰 종합 (컷 시 목업 시연)"
      />
      <SpecBar
        scr="SCR-011"
        fn={["FN-011", "FN-005"]}
        ep={["EP-010 generate(dev_eval)", "EP-013", "EP-014"]}
      />
      <DocumentWorkbench
        type="evaluation"
        source={
          <>
            {obsQuery.isLoading ? (
              <Skeleton lines={5} />
            ) : (
              <table className="tbl">
                <tbody>
                  {obsQuery.data?.domains.map((d) => (
                    <tr key={d.name}>
                      <td>{d.name}</td>
                      <td className="text-right font-bold">관찰 {d.count}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-2.5">
              <Notice kind="soft">
                입력이 상한(8K)을 넘으면 최근·대표 기록 위주로 추려 생성하고,
                근거로 남긴 기록을 표시합니다.
              </Notice>
            </div>
          </>
        }
      />
    </>
  );
}
