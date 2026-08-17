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
  PageHead,
  Progress,
  Skeleton,
  SpecBar,
} from "@/components/ui";

function statusLabel(status: string | null) {
  if (status === null) return "생성 전";
  if (status === "sent") return "발송됨";
  if (status === "confirmed") return "확정됨";
  return "검토 대기";
}

function statusColor(status: string | null) {
  if (status === null) return "text-muted";
  if (status === "sent") return "text-confirm";
  if (status === "confirmed") return "text-blue";
  return "text-amber";
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

  // 선택이 없으면 손이 가야 할 아이를 먼저 고른다 — 아직 안 만든 아이 →
  // 만들었지만 검토 대기인 아이 → 그 외 순서.
  useEffect(() => {
    if (childId || !queue) return;
    const next =
      queue.queue.find((q) => q.status === null) ??
      queue.queue.find((q) => q.status === "draft") ??
      queue.queue[0];
    if (next) setChildId(next.childId);
  }, [queue, childId]);

  const recordQuery = useDailyRecord(childId, TODAY);
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
            className="btn ml-auto px-3 py-1.5"
            onClick={runGenerateAll}
            disabled={generateAll.isPending || !queue || queue.ready === 0}
            title="기록이 있는 아이 전원의 초안을 한 번에 만듭니다"
          >
            <Sparkles size={14} />
            {generateAll.isPending
              ? "생성 중…"
              : `전체 생성 (${queue ? queue.ready - queue.generated : 0}건)`}
          </button>
        </h2>
        {queueQuery.isLoading || !queue ? (
          <Skeleton lines={3} />
        ) : (
          <>
            <div className="inline gap-3.5">
              <div className="min-w-[200px] flex-1">
                <Progress value={queue.generated} max={queue.ready} />
              </div>
              <span className="text-[13px] font-bold">
                기록 {queue.ready}명 · 초안 {queue.generated}건 · 확정{" "}
                {queue.confirmed}건 · 발송 {queue.sent}건
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
                    className={`text-[11px] font-bold ${statusColor(item.status)}`}
                  >
                    {statusLabel(item.status)}
                  </span>
                </button>
              ))}
            </div>
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
                    <td className="w-[92px] whitespace-nowrap text-muted">
                      활동
                    </td>
                    <td>{record.activities.join(", ") || "—"}</td>
                  </tr>
                  {/* 파싱이 안 된 기록은 원문을 그대로 보여 준다 — 구조 필드는
                      기본값이라 사실이 아니다(decodeSpecRecord 주석 참조). */}
                  <tr>
                    <td className="whitespace-nowrap text-muted">
                      점심 · 간식
                    </td>
                    <td>
                      {record.mealParsed === false
                        ? record.rawMeal || "—"
                        : `${record.lunch} · ${record.snack}`}
                    </td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap text-muted">낮잠</td>
                    <td>
                      {record.napParsed === false
                        ? record.rawNap || "—"
                        : `${record.napFrom} ~ ${record.napTo} · ${record.napQuality}`}
                    </td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap text-muted">특이</td>
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
