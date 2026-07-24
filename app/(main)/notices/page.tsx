"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import {
  useDailyRecord,
  useGenerateAllNotices,
  useNoticeQueue,
} from "@/lib/queries";
import { TODAY } from "@/lib/constants";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import {
  Avatar,
  N,
  Notice,
  PageHead,
  Progress,
  Skeleton,
  SpecBar,
} from "@/components/ui";

function statusLabel(status: string) {
  if (status === "sent") return "발송됨";
  if (status === "confirmed") return "확정됨";
  return "검토 대기";
}

// SCR-004 알림장 검토·확정 — 생성만 일괄, 검토·확정은 아이별
function NoticesContent() {
  const params = useSearchParams();
  const { toast } = useApp();
  const queueQuery = useNoticeQueue();
  const generateAll = useGenerateAllNotices();
  const queue = queueQuery.data;

  const runGenerateAll = () =>
    generateAll.mutate(undefined, {
      onSuccess: ({ created, total }) =>
        toast(
          created > 0
            ? `초안 ${created}건을 한 번에 생성했습니다 (기록 있는 ${total}명 기준)`
            : `이미 ${total}명 초안이 모두 준비돼 있습니다`,
        ),
    });

  const [childId, setChildId] = useState(params.get("child") ?? "");

  // 선택이 없으면 첫 번째 검토 대기 아이를 자동 선택
  useEffect(() => {
    if (childId || !queue) return;
    const firstDraft =
      queue.queue.find((q) => q.status === "draft") ?? queue.queue[0];
    if (firstDraft) setChildId(firstDraft.childId);
  }, [queue, childId]);

  const recordQuery = useDailyRecord(childId || "c01", TODAY);
  const record = recordQuery.data?.record;
  const selected = queue?.queue.find((q) => q.childId === childId);

  return (
    <>
      <PageHead
        title="알림장 검토·확정"
        sub={'"AI는 초안, 사람이 확정" — 생성만 일괄, 검토·확정은 아이별'}
      />
      <SpecBar
        scr="SCR-004"
        fn={["FN-002 생성", "FN-005 검토·확정"]}
        ep={[
          "EP-010 generate",
          "EP-013 작업본",
          "EP-014 confirm",
          "EP-015 send",
        ]}
      />

      <div className="card mb-4">
        <h2>
          <N n={1} />
          오늘 알림장 진행 현황
          <button
            className="btn primary ml-auto px-3 py-1.5"
            onClick={runGenerateAll}
            disabled={generateAll.isPending || !queue || queue.generated === 0}
          >
            <Sparkles size={14} />
            {generateAll.isPending ? "생성 중…" : "전체 생성"}
          </button>
        </h2>
        {queueQuery.isLoading || !queue ? (
          <Skeleton lines={3} />
        ) : (
          <>
            <div className="inline gap-3.5">
              <div className="min-w-[200px] flex-1">
                <Progress value={queue.confirmed} max={queue.generated} />
              </div>
              <span className="text-[13px] font-bold">
                초안 {queue.generated}건 · 확정 {queue.confirmed}건 · 발송{" "}
                {queue.sent}건
              </span>
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {queue.queue.map((item) => (
                <button
                  key={item.childId}
                  className={`chip ${item.childId === childId ? "on" : ""}`}
                  onClick={() => setChildId(item.childId)}
                >
                  <Avatar name={item.name} color={item.color} size="sm" />
                  {item.name}
                  <span
                    className={`text-[11px] font-bold ${
                      item.status === "sent"
                        ? "text-confirm"
                        : item.status === "confirmed"
                          ? "text-blue"
                          : "text-amber"
                    }`}
                  >
                    {statusLabel(item.status)}
                  </span>
                </button>
              ))}
            </div>
            {queue.excluded.length > 0 && (
              <div className="mt-3">
                <Notice kind="warn">
                  ⚠{" "}
                  <span>
                    {queue.excluded.join(" · ")} — 하루 기록 없음(생성 제외).
                    성공분은 그대로 유지됩니다.{" "}
                    <b>일괄 확정 버튼은 제공하지 않습니다(불변 원칙).</b>
                  </span>
                </Notice>
              </div>
            )}
          </>
        )}
      </div>

      {childId && (
        <DocumentWorkbench
          key={childId}
          type="notice"
          childId={childId}
          allowSend
          emptyMessage={`${selected?.name ?? "이 아이"}의 오늘 하루 기록이 없어 초안을 만들 수 없습니다. 하루 기록을 먼저 저장해 주세요.`}
          source={
            recordQuery.isLoading ? (
              <Skeleton lines={4} />
            ) : record ? (
              <table className="tbl">
                <tbody>
                  <tr>
                    <td className="w-[72px] text-muted">활동</td>
                    <td>{record.activities.join(", ") || "—"}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">점심 · 간식</td>
                    <td>
                      {record.lunch} · {record.snack}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted">낮잠</td>
                    <td>
                      {record.napFrom} ~ {record.napTo} · {record.napQuality}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted">특이</td>
                    <td>{record.memo || "—"}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="py-2 text-[13px] text-muted">
                오늘 하루 기록이 없습니다.
              </div>
            )
          }
        />
      )}
    </>
  );
}

export default function NoticesPage() {
  return (
    <Suspense>
      <NoticesContent />
    </Suspense>
  );
}
