"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { useReloadSeed, useSetReplayMode } from "@/lib/queries";
import { ConfirmDialog, N, Notice, PageHead, SpecBar } from "@/components/ui";

// SCR-014 설정 — 재생 모드 · 시드 (FN-017 · FN-016)
export default function SettingsPage() {
  const { replay, setReplay, toast } = useApp();
  const replayMutation = useSetReplayMode();
  const seedMutation = useReloadSeed();
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);

  const toggleReplay = () => {
    const next = !replay;
    setReplay(next);
    replayMutation.mutate(next);
    toast(
      next
        ? "재생 모드 켜짐 — LLM 호출이 저장된 응답으로 대체됩니다"
        : "재생 모드 꺼짐",
    );
  };

  const reloadSeed = () =>
    seedMutation.mutate(undefined, {
      onSuccess: () => {
        setSeedConfirmOpen(false);
        toast("시드를 다시 불러왔습니다 — 모든 데이터가 초기 상태입니다");
      },
    });

  return (
    <>
      <PageHead title="설정" sub="운영·시연 도구 — 재생 모드 · 시드" />
      <SpecBar
        scr="SCR-014"
        fn={["FN-017 재생", "FN-016 시드"]}
        ep={["EP-029 조회", "EP-030 replay", "EP-031 seed"]}
      />

      <div className="stack">
        <div className="card">
          <div className="setrow">
            <div>
              <div className="t">
                <N n={1} />
                재생 모드
              </div>
              <div className="d">
                켜면 LLM 호출이 미리 저장한 응답으로 대체됩니다(오프라인 시연
                대비). 켜짐 상태는 상단바에 「▶ 재생 모드」로 표시. 캐시에 없는
                시나리오는 조용히 실패하지 않고 안내합니다.
              </div>
            </div>
            <div className="act">
              <button
                className={`toggle ${replay ? "on" : ""}`}
                role="switch"
                aria-checked={replay}
                aria-label="재생 모드"
                onClick={toggleReplay}
              >
                <i />
              </button>
            </div>
          </div>
          <div className="setrow">
            <div>
              <div className="t">
                <N n={2} />
                사용 모델
              </div>
              <div className="d">현재 라우팅되는 모델 티어 표시(FN-018)</div>
            </div>
            <div className="act text-right font-mono text-[12.5px] leading-relaxed text-muted">
              생성: Sonnet 5
              <br />
              경량: Haiku 4.5
            </div>
          </div>
          <div className="setrow">
            <div>
              <div className="t">
                <N n={3} />
                연습용 데이터
              </div>
              <div className="d">
                기존 시드를 초기화하고 다시 적재합니다. 이 세션에서 저장·확정한
                모든 변경이 사라집니다. 시드 파일이 손상·누락이면 적재를
                중단하고 무엇이 없는지 안내합니다(부분 적재 금지).
              </div>
            </div>
            <div className="act">
              <button
                className="btn danger"
                onClick={() => setSeedConfirmOpen(true)}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? "적재 중…" : "시드 다시 불러오기"}
              </button>
            </div>
          </div>
        </div>

        <Notice kind="warn">
          ⚠{" "}
          <span>
            <N n={4} />이 서비스는 연습용입니다. 실제 아동 정보를 넣지 마세요.
          </span>
        </Notice>
      </div>

      <ConfirmDialog
        open={seedConfirmOpen}
        title="시드를 다시 불러올까요?"
        desc="기존 데이터가 초기화됩니다. 이 세션에서 저장한 기록·확정한 문서·분류한 사진이 모두 사라집니다."
        confirmLabel="초기화"
        danger
        pending={seedMutation.isPending}
        onConfirm={reloadSeed}
        onClose={() => setSeedConfirmOpen(false)}
      />
    </>
  );
}
