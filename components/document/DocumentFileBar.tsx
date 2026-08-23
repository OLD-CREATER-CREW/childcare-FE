"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileCog, FileText, FileWarning, Lock } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  useActiveTemplate,
  useDownloadDocumentFile,
  useRenderDocumentFile,
  useTemplate,
} from "@/lib/queries";
import { useApp } from "@/lib/store";
import { Notice } from "@/components/ui";
import type { DocType, DocumentDraft } from "@/lib/types";

/**
 * 어떤 파일로 나올지 — 활성 서식의 원본 형식이 정한다.
 *
 * 교사가 기다리는 것은 "문서 파일"이 아니라 **한글 파일**인 경우가 많다.
 * 확정 전에 이걸 밝혀 두면 "이 화면에서 한글 파일이 나오긴 하나" 하는 의문이
 * 남지 않는다.
 */
function fileKindLabel(format: string | null | undefined): string {
  if (format === "hwpx") return "한글 파일(.hwpx)";
  if (format === "docx") return "워드 파일(.docx)";
  return "완성 문서 파일";
}

/**
 * 서식 파일 — 내려받기(EP-036) · 확정본 만들기(EP-038). FN-020.
 *
 * 상태가 넷이고, `status`·`fileKey`·`fileRenderStatus` 셋으로 가른다.
 *
 * | 문서 상태 | 파일 | 화면 |
 * |---|---|---|
 * | draft | `_preview` 있음 | 초안 내려받기 — 한글에서 열어 검토하라고 안내 |
 * | draft | 없음 | 서식은 있는데 파일이 없다는 안내(만들기는 409라 막는다) |
 * | confirmed·sent | `_preview` | 「확정본 파일 만들기」가 주 동작 — 초안을 확정본으로 오해하지 않게 |
 * | confirmed·sent | `_final` | 내려받기가 주 동작, 만들기는 서식 교체 후 재생성용 |
 *
 * 확정 전 초안 파일을 주는 것은 서버의 결정이다 — 교사가 올린 서식을 그대로
 * 채우므로 한글에서 열어 봐야 칸 넘침·요일 배치를 검토할 수 있고, 그 검토를
 * 막지 않기 위해서다. 대신 파일명에 `_초안`이 박혀 나온다.
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

  // 어떤 확장자로 나올지 미리 밝히려고 활성 서식을 본다. 상세는 문서 화면의
  // 칸 보기와 같은 캐시를 쓰므로(EP-034, staleTime: Infinity) 추가 요청이 아니다.
  const activeTemplateQuery = useActiveTemplate(type);
  const activeTemplate = activeTemplateQuery.data ?? null;
  const templateDetailQuery = useTemplate(
    doc.templateId ?? activeTemplate?.id ?? null,
  );
  const fileKind = fileKindLabel(
    templateDetailQuery.data?.structure?.sourceFormat,
  );

  const hasFile = doc.fileKey != null && doc.fileRenderStatus === "ok";

  /*
    지금 있는 파일이 **확정 전 초안**인지.

    서버는 저장 키를 `_preview`(생성 시 자동) / `_final`(확정 후 EP-038)로 나누고,
    다운로드 파일명에도 `_초안`을 붙여 구분한다. 그 구분이 곧 계약이라 여기서도
    같은 표식을 본다 — 확정본을 받았다고 믿고 초안을 제출하는 일을 막아야 한다.
  */
  const isPreviewFile = doc.fileKey?.includes("_preview") ?? false;

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

  /*
    확정 전 — 서버가 생성 시점에 초안 파일을 **이미 만들어 둔다.**

    한때는 만들지 않았고 화면도 이 자리를 감췄다. 그 판단은 산출물이 새로 그린
    2열 .docx이던 시절의 것이다. 지금은 교사가 올린 서식을 그대로 채우므로 한글에서
    열어 봐야 제대로 검토된다 — 칸이 넘치는지, 요일별로 제자리에 들어갔는지는 칸
    목록을 스크롤해서는 알기 어렵다. 검토를 지키려던 규칙이 검토를 막고 있었다.

    그래서 초안도 내려받게 하되, **초안임을 화면과 파일명 양쪽에 남긴다**
    (서버가 파일명에 `_초안`을 박는다). 새로 만들기는 여기서 안 된다 — EP-038은
    확정 전에는 409 NOT_CONFIRMED다.
  */
  if (doc.status === "draft") {
    // 서식도 파일도 없으면 약속할 것이 없다 — 빈 카드로 화면만 늘리지 않는다.
    if (!hasFile && !activeTemplate) return null;
    return (
      <div className="card">
        <h2>
          서식 파일로 검토
          <span className="hint">FN-020 · EP-036 · 확정 전 초안</span>
        </h2>

        {hasFile ? (
          <>
            <Notice kind="info">
              <div>
                지금 받는 파일은 <b>확정 전 초안</b>입니다 — 파일명에 「초안」이
                붙습니다. 한글에서 열어 칸이 넘치지 않는지, 요일별로 제자리에
                들어갔는지 확인한 뒤 확정해 주세요.
              </div>
            </Notice>
            <div className="btnrow">
              <button
                className="btn primary"
                onClick={download}
                disabled={downloadMutation.isPending}
              >
                <Download size={14} />
                {downloadMutation.isPending
                  ? "내려받는 중…"
                  : `초안 ${fileKind} 내려받기`}
              </button>
            </div>
          </>
        ) : (
          <Notice kind="info">
            <div>
              <Lock size={13} className="mr-1 inline" />이 문서 종류에 서식이
              등록돼 있습니다 — 초안 파일을 만드는 중이거나 만들지 못했습니다.
              「다시 생성」을 누르면 {fileKind}가 함께 만들어집니다.
            </div>
          </Notice>
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

  return (
    <div className="card">
      <h2>
        완성 문서 파일
        <span className="hint">FN-020 · EP-038 만들기 / EP-036 내려받기</span>
      </h2>

      {/*
        확정은 했지만 파일은 아직 생성 시점의 초안 그대로다. 여기서 「내려받기」만
        내밀면 파일명에 「초안」이 붙은 파일을 확정본으로 믿고 제출하게 된다.
      */}
      {hasFile && isPreviewFile && (
        <Notice kind="warn">
          <div>
            지금 있는 파일은 <b>확정 전에 만든 초안</b>입니다. 확정본으로
            받으려면 아래 「확정본 파일 만들기」를 눌러 주세요.
          </div>
        </Notice>
      )}

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
            {/*
              확정본이 아직 없으면 「만들기」가 주 동작이다. 확정본이 있으면
              내려받기가 주 동작이고, 만들기는 서식을 바꾼 뒤 다시 찍는 용도로
              남는다(EP-038은 멱등이라 같은 키에 덮어쓴다).
            */}
            <button
              className={`btn ${isPreviewFile ? "primary" : ""}`}
              onClick={make}
              disabled={renderMutation.isPending}
            >
              <FileCog size={14} />
              {renderMutation.isPending
                ? "서식에 채우는 중…"
                : isPreviewFile
                  ? "확정본 파일 만들기"
                  : "다시 만들기"}
            </button>
            <button
              className={`btn ${isPreviewFile ? "" : "primary"}`}
              onClick={download}
              disabled={downloadMutation.isPending}
            >
              <Download size={14} />
              {downloadMutation.isPending
                ? "내려받는 중…"
                : isPreviewFile
                  ? "초안 내려받기"
                  : "내려받기"}
            </button>
          </>
        ) : (
          <button
            className="btn primary"
            onClick={make}
            disabled={renderMutation.isPending}
          >
            <FileText size={14} />
            {renderMutation.isPending
              ? "서식에 채우는 중…"
              : `${fileKind}로 만들기`}
          </button>
        )}
      </div>

      {hasFile && !isPreviewFile && (
        <div className="mt-3">
          <Notice kind="soft">
            <div>
              {fileKind}로 저장됩니다 — 확장자는 올린 서식을 따릅니다. 한글
              서식이면 <code>.hwpx</code>, 워드 서식이거나 서식이 없으면{" "}
              <code>.docx</code>입니다.
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
