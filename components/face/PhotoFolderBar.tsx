"use client";

/**
 * 사진 폴더 표시·설정 바.
 *
 * 사진을 다루는 화면이 여럿이지만(사진함의 분류·폴더 보기, 놀이이야기) 교사의
 * 사진은 한 자리에 있다. 그래서 폴더는 **한 번만 정하고 앱이 기억한다**
 * (`lib/face/photoRoot.ts`). 이 바가 그 설정을 보여 주고 바꾸는 유일한 자리다.
 *
 * 상태는 네 가지뿐이고, 각각 다음에 할 일이 하나씩 정해져 있다.
 *   불러오는 중   아무것도 시키지 않는다
 *   지원 안 함    데스크톱 앱에서 열라고 안내한다(웹 브라우저 일부는 폴더를 못 연다)
 *   안 정함       「사진 폴더 지정」
 *   권한 끊김     「폴더 다시 연결」 — 저장된 폴더는 그대로 두고 권한만 다시 청한다
 */

import { FolderOpen, FolderSync, HardDrive } from "lucide-react";
import { useApp } from "@/lib/store";
import { FolderCancelledError, FolderUnsupportedError } from "@/lib/face";
import type { PhotoRootState } from "@/lib/face";
import { Notice } from "@/components/ui";

export function PhotoFolderBar({
  root,
  /** 오른쪽 끝에 붙일 요약(장수 등). 없으면 자리를 비운다. */
  summary,
  /** 폴더를 왜 정해야 하는지 — 화면마다 다르다. */
  hint,
}: {
  root: PhotoRootState;
  summary?: React.ReactNode;
  hint?: string;
}) {
  const { toast } = useApp();

  const choose = async () => {
    try {
      await root.choose();
      toast("사진 폴더를 정했습니다 — 다음부터는 다시 고르지 않아도 됩니다");
    } catch (e) {
      if (e instanceof FolderCancelledError) return; // 교사가 취소한 것
      if (e instanceof FolderUnsupportedError) {
        toast(
          "이 브라우저에서는 폴더를 열 수 없습니다 — 데스크톱 앱에서 실행하세요.",
        );
        return;
      }
      toast(
        `폴더를 열지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const reconnect = async () => {
    const ok = await root.reconnect();
    toast(
      ok
        ? "폴더를 다시 연결했습니다"
        : "권한을 받지 못했습니다 — 폴더를 다시 지정해 주세요",
    );
  };

  if (!root.supported) {
    return (
      <Notice kind="warn">
        ⚠{" "}
        <span>
          이 환경에서는 폴더를 열 수 없습니다 — <b>데스크톱 앱</b>에서 실행하세요.
        </span>
      </Notice>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-muted">
          <HardDrive size={14} />
          사진 폴더
        </span>

        {root.loading ? (
          <span className="text-[13px] text-muted">불러오는 중…</span>
        ) : root.label ? (
          <code
            className="max-w-full overflow-x-auto whitespace-nowrap rounded-lg border border-line bg-paper px-2.5 py-1 text-[12.5px] text-ink"
            title={root.label}
          >
            {root.label}
          </code>
        ) : (
          <span className="text-[13px] text-muted">아직 정하지 않았습니다</span>
        )}

        {root.needsPermission ? (
          <button className="btn" onClick={() => void reconnect()}>
            <FolderSync size={14} /> 폴더 다시 연결
          </button>
        ) : (
          <button
            className={root.label ? "btn" : "btn primary"}
            onClick={() => void choose()}
          >
            <FolderOpen size={14} />
            {root.label ? "폴더 바꾸기" : "사진 폴더 지정"}
          </button>
        )}

        {summary && <span className="ml-auto text-[13px] text-muted">{summary}</span>}
      </div>

      {root.needsPermission && (
        <div className="mt-3">
          <Notice kind="warn">
            <span>
              앱을 다시 켜면서 폴더 권한이 풀렸습니다. <b>폴더 다시 연결</b>을
              누르면 같은 폴더를 그대로 씁니다.
            </span>
          </Notice>
        </div>
      )}

      {!root.loading && !root.label && hint && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{hint}</p>
      )}
    </div>
  );
}
