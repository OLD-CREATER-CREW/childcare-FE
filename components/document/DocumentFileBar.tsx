"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileCog, FileText, FileWarning } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useDownloadDocumentFile, useRenderDocumentFile } from "@/lib/queries";
import { useApp } from "@/lib/store";
import { Notice } from "@/components/ui";
import type { DocType, DocumentDraft } from "@/lib/types";

/**
 * 완성 문서 파일 — 만들기(EP-038) · 내려받기(EP-036). FN-020, 스토리보드 r5.1.
 *
 * 확정 뒤에만 나타난다. 파일 만들기는 생성·확정과 분리된 별도 단계라 교사가
 * 눌렀을 때만 일어난다 — 검토 전 초안으로 완성 파일을 내주면 초안이 완성물처럼
 * 보여 "AI는 초안까지, 확정은 사람이"와 어긋난다(명세 1.5절).
 *
 * 무엇을 보일지는 `fileKey`·`fileRenderStatus`로 정한다.
 */
export function DocumentFileBar({
  type,
  childId,
  doc,
}: {
  type: DocType;
  childId: string | null;
  doc: DocumentDraft;
}) {
  const { toast } = useApp();
  const renderMutation = useRenderDocumentFile();
  const downloadMutation = useDownloadDocumentFile();
  const [error, setError] = useState<React.ReactNode>(null);

  // 확정 전에는 아예 보이지 않는다 — 서버도 409 NOT_CONFIRMED로 막는다.
  if (doc.status === "draft") return null;

  const hasFile = doc.fileKey != null && doc.fileRenderStatus === "ok";

  const make = () => {
    setError(null);
    renderMutation.mutate(
      { type, childId },
      {
        onSuccess: () =>
          toast("완성 문서를 만들었습니다 — 내려받을 수 있습니다"),
        onError: (e) => setError(renderErrorMessage(e)),
      },
    );
  };

  const download = () => {
    setError(null);
    downloadMutation.mutate(
      { type, childId },
      {
        onSuccess: ({ blob, filename }) => {
          // 확장자·파일명은 서버가 정한다 — 서식을 채우면 .hwpx, 폴백이면 .docx다.
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          toast(`${filename} 을(를) 저장했습니다`);
        },
        onError: (e) => setError(renderErrorMessage(e)),
      },
    );
  };

  return (
    <div className="card">
      <h2>
        완성 문서 파일
        <span className="hint">FN-020 · EP-038 만들기 / EP-036 내려받기</span>
      </h2>

      {doc.fileRenderStatus === "no_template" && !hasFile ? (
        <Notice kind="info">
          <div>
            이 문서 종류에 등록된 서식이 없습니다 — 문서는 텍스트로 그대로
            남습니다. 우리 원 서식 그대로 받고 싶다면{" "}
            <Link href="/templates" className="underline">
              양식 관리
            </Link>
            에서 서식을 올려 활성화해 주세요.
          </div>
        </Notice>
      ) : doc.fileRenderStatus === "failed" && !hasFile ? (
        <Notice kind="warn">
          완성 문서를 만들지 못했습니다 — 서식의 표 구조를 확인해 주세요. 확정본
          텍스트는 그대로 남아 있으니 복사해 쓰셔도 됩니다.
        </Notice>
      ) : null}

      <div className="btnrow">
        {hasFile ? (
          <>
            <button
              className="btn primary"
              onClick={download}
              disabled={downloadMutation.isPending}
            >
              <Download size={14} />
              {downloadMutation.isPending ? "내려받는 중…" : "내려받기"}
            </button>
            {/* 서식을 바꾼 뒤 다시 만들 수 있어야 한다 — EP-038은 멱등이다 */}
            <button
              className="btn"
              onClick={make}
              disabled={renderMutation.isPending}
            >
              <FileCog size={14} />
              {renderMutation.isPending ? "만드는 중…" : "다시 만들기"}
            </button>
          </>
        ) : (
          <button
            className="btn primary"
            onClick={make}
            disabled={renderMutation.isPending}
          >
            <FileText size={14} />
            {renderMutation.isPending ? "서식에 채우는 중…" : "문서 만들기"}
          </button>
        )}
      </div>

      {hasFile && (
        <div className="mt-3">
          <Notice kind="soft">
            <div>
              확장자는 올린 서식을 따릅니다 — 한글 서식이면 <code>.hwpx</code>,
              워드 서식이거나 서식이 없으면 <code>.docx</code>로 저장됩니다.
            </div>
          </Notice>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <Notice kind="warn">
            <div>{error}</div>
          </Notice>
        </div>
      )}
    </div>
  );
}

function renderErrorMessage(e: unknown): React.ReactNode {
  if (!(e instanceof ApiError))
    return "완성 문서를 만들지 못했습니다. 네트워크 상태를 확인해 주세요.";

  switch (e.code) {
    // 오류 응답이지만 **비정상 상황은 아니다** — 서식을 안 올린 기관의 정상
    // 상태다. 실패로 겁주지 말고 등록 화면으로 안내한다.
    case "NO_ACTIVE_TEMPLATE":
      return (
        <>
          {e.message}{" "}
          <Link href="/templates" className="underline">
            양식 관리로 이동
          </Link>
        </>
      );
    case "NOT_CONFIRMED":
      return `${e.message} 확정한 뒤에만 완성 파일을 만들 수 있습니다.`;
    case "RENDER_FAILED":
      return (
        <>
          <b>완성 문서를 만들지 못했습니다.</b> {e.message} 표 구조가 복잡한
          서식은 채우지 못할 수 있습니다 — 다른 서식으로 바꿔 보세요. 확정본
          텍스트는 그대로 남아 있습니다.
        </>
      );
    case "FILE_NOT_AVAILABLE":
      return `${e.message}`;
    default:
      return (
        <span className="inline-flex items-start gap-1.5">
          <FileWarning size={15} className="mt-0.5 flex-none" />
          {e.message}
        </span>
      );
  }
}
