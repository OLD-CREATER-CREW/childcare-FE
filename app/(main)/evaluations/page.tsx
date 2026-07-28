"use client";

import { useState } from "react";
import { useChildren, useObservations } from "@/lib/queries";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import {
  Avatar,
  N,
  Notice,
  PageHead,
  Select,
  Skeleton,
  SpecBar,
} from "@/components/ui";

// SCR-011 발달평가서 — 누적 관찰 종합 (아동 단위 문서)
export default function EvaluationsPage() {
  const childrenQuery = useChildren();
  const kids = childrenQuery.data ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const childId = picked ?? kids[0]?.id ?? "";
  const obsQuery = useObservations(childId);

  const child = kids.find((c) => c.id === childId);
  const totalObs =
    obsQuery.data?.domains.reduce((sum, d) => sum + d.count, 0) ?? 0;

  return (
    <>
      <PageHead
        title="발달평가서"
        sub={`${child?.name ?? "…"} · 2026 — 누적 관찰 종합`}
        right={
          <Select
            className="w-[180px]"
            ariaLabel="아이 선택"
            value={childId}
            onChange={setPicked}
            options={kids.map((c) => ({ value: c.id, label: c.name }))}
          />
        }
      />
      <SpecBar
        scr="SCR-011"
        fn={["FN-011", "FN-005"]}
        ep={["EP-010 generate(dev_eval)", "EP-013", "EP-014"]}
      />

      <DocumentWorkbench
        key={childId}
        type="evaluation"
        childId={childId}
        source={
          <>
            {child && (
              <div className="mb-3 flex items-center gap-2.5">
                <Avatar name={child.name} color={child.color} size="lg" />
                <div>
                  <div className="font-bold">{child.name}</div>
                  <div className="text-[12px] text-muted">
                    {child.birthDate} · 누적 관찰 {totalObs}건
                  </div>
                </div>
              </div>
            )}
            {obsQuery.isLoading ? (
              <Skeleton lines={5} />
            ) : (
              <table className="tbl">
                <tbody>
                  {obsQuery.data?.domains.map((d) => (
                    <tr key={d.name}>
                      <td>
                        <N n={2} />
                        {d.name}
                      </td>
                      <td className="text-right font-bold">관찰 {d.count}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3">
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
