"use client";

import { useApp } from "@/lib/store";
import { useNoticeQueue } from "@/lib/queries";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { Notice, PageHead, Skeleton, SpecBar } from "@/components/ui";

// SCR-004 알림장 검토·확정 — 생성만 일괄, 검토·확정은 아이별
export default function NoticesPage() {
  const { toast } = useApp();
  const queueQuery = useNoticeQueue();
  const queue = queueQuery.data;

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

      <div className="card">
        <h2>오늘 알림장 전체 만들기 · 해님반 15명</h2>
        {queueQuery.isLoading || !queue ? (
          <Skeleton lines={3} />
        ) : (
          <>
            <div className="inline gap-3">
              <div className="min-w-[200px] flex-1">
                <div className="progress">
                  <i
                    style={{
                      width: `${(queue.generated / queue.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <span className="text-[13px] font-bold">
                {queue.generated}/{queue.total} 생성 완료
              </span>
            </div>
            <div className="mt-3 text-[13px]">
              검토 대기열 —{" "}
              {queue.queue.map((item) =>
                item.state === "reviewing" ? (
                  <button key={item.childId} className="chip on mr-1 px-3 py-1">
                    ● {item.name} 검토 중
                  </button>
                ) : (
                  <button
                    key={item.childId}
                    className="chip mr-1 px-3 py-1"
                    onClick={() =>
                      toast(`${item.name} 알림장으로 이동합니다 (목데이터)`)
                    }
                  >
                    ○ {item.name} 검토하기
                  </button>
                ),
              )}
            </div>
            <div className="mt-2.5">
              <Notice kind="warn">
                ⚠{" "}
                <span>
                  {queue.excluded.join(" · ")} — 하루 기록 없음(생성 제외).
                  성공분은 그대로 유지됩니다.{" "}
                  <b>일괄 확정 버튼은 제공하지 않습니다(불변 원칙).</b>
                </span>
              </Notice>
            </div>
          </>
        )}
      </div>

      <DocumentWorkbench
        type="notice"
        allowSend
        source={
          <table className="tbl">
            <tbody>
              <tr>
                <td className="w-[70px] text-muted">활동</td>
                <td>바깥놀이, 블록쌓기</td>
              </tr>
              <tr>
                <td className="text-muted">점심</td>
                <td>다 먹음</td>
              </tr>
              <tr>
                <td className="text-muted">낮잠</td>
                <td>12:40 ~ 14:10 · 잘 잤어요</td>
              </tr>
              <tr>
                <td className="text-muted">특이</td>
                <td>장난감 다툼 → 금방 화해</td>
              </tr>
            </tbody>
          </table>
        }
      />
    </>
  );
}
