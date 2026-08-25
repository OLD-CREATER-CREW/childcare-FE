"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  FileUp,
  Power,
  Settings2,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  useActivateTemplate,
  useActiveTemplate,
  useDocumentDraft,
  useDownloadDocumentFile,
  useTemplate,
  useTemplates,
  useUploadTemplate,
} from "@/lib/queries";
import { useApp } from "@/lib/store";
import { fileKindLabel } from "@/components/document/DocumentFileBar";
import { Notice } from "@/components/ui";
import type { DocType, TemplateDocType } from "@/lib/types";

/**
 * 문서 화면 맨 위의 서식 줄 — **서식 하나 올리는 칸**과 **한글 파일 내려받기**.
 *
 * 양식 관리(SCR-015)는 서식 다섯 종류를 모두 다루는 설정 화면이라, 보육일지를
 * 쓰다가 "우리 원 양식으로 나오게 하려면" 거기까지 다녀와야 했다. 실제로 교사가
 * 이 화면에서 하는 일은 둘뿐이다 — **이 문서의 서식을 올리는 것**과 **채워진
 * 한글 파일을 받는 것**. 그 둘만 문서 위로 끌어올린다.
 *
 * 규율은 SCR-015와 같다: **올리는 것과 쓰는 것은 다른 동작이다.** 업로드는 등록
 * (EP-032)일 뿐이고, 칸을 확인한 뒤 사람이 「이 서식 쓰기」(EP-037)를 눌러야
 * 실제로 쓰인다. 올리자마자 바뀌면 다음 문서가 무슨 서식으로 나올지 아무도 모른다.
 *
 * 문서 초안은 `useDocumentDraft`로 **워크벤치와 같은 캐시**를 읽는다 — 추가 요청이
 * 아니고, 확정 상태·파일 유무가 워크벤치와 어긋나지 않는다.
 */
export function DocumentTemplateBar({
  type,
  childId = null,
  date = null,
}: {
  type: DocType;
  childId?: string | null;
  /** 날짜 단위 문서(보육일지)에서 고른 날 — 내려받기가 그 날 문서여야 한다 */
  date?: string | null;
}) {
  const { toast } = useApp();
  const templateType = type as TemplateDocType;
  const activeQuery = useActiveTemplate(type);
  const listQuery = useTemplates(templateType);
  const draftQuery = useDocumentDraft(type, childId, date);
  const uploadMutation = useUploadTemplate();
  const activateMutation = useActivateTemplate();
  const downloadMutation = useDownloadDocumentFile();
  const fileRef = useRef<HTMLInputElement>(null);
  /** 방금 올려 아직 쓰지 않은 서식 — 이 값이 있으면 「이 서식 쓰기」가 뜬다 */
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = activeQuery.data ?? null;
  const activeDetail = useTemplate(active?.id ?? null);
  const pending = listQuery.data?.find((t) => t.id === pendingId) ?? null;
  const pendingDetail = useTemplate(pendingId);

  const doc = draftQuery.data ?? null;
  const hasFile = doc?.fileKey != null && doc.fileRenderStatus === "ok";
  const isPreviewFile = doc?.fileKey?.includes("_preview") ?? false;
  const fileKind = fileKindLabel(activeDetail.data?.structure?.sourceFormat);
  const structure = activeDetail.data?.structure ?? null;

  const onPick = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    uploadMutation.mutate(
      { docType: templateType, file },
      {
        onSuccess: (t) => {
          setPendingId(t.id);
          toast("서식을 읽었습니다 — 칸을 확인하고 「이 서식 쓰기」를 눌러 주세요");
        },
        onError: (e) =>
          setError(
            e instanceof ApiError ? e.message : "서식을 올리지 못했습니다.",
          ),
      },
    );
    // 같은 파일을 다시 고를 수 있게 비운다(변환 후 재시도가 흔하다).
    if (fileRef.current) fileRef.current.value = "";
  };

  const use = () => {
    if (pendingId == null) return;
    activateMutation.mutate(pendingId, {
      onSuccess: () => {
        setPendingId(null);
        toast("이 서식으로 바꿨습니다 — 다음 초안부터 이 서식의 칸으로 나옵니다");
      },
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : "서식을 쓰지 못했습니다."),
    });
  };

  const download = () => {
    setError(null);
    downloadMutation.mutate(
      { type, childId, date },
      {
        onSuccess: ({ blob, filename }) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          toast(`${filename} 을(를) 저장했습니다`);
        },
        onError: (e) =>
          setError(
            e instanceof ApiError ? e.message : "파일을 내려받지 못했습니다.",
          ),
      },
    );
  };

  return (
    <div className="card">
      <h2>
        서식(양식)
        <span className="hint">
          이 서식의 칸에 AI가 내용을 씁니다 · FN-019 · EP-032·037
        </span>
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".hwpx,.docx"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <button
          className={`btn ${active ? "" : "primary"}`}
          onClick={() => fileRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          <FileUp size={15} />
          {uploadMutation.isPending
            ? "서식을 읽는 중…"
            : active
              ? "다른 서식 올리기"
              : "서식 파일 올리기"}
        </button>

        {/* 한글 파일 — 확정 전이라도 받는다. 한글에서 열어 봐야 검토가 된다. */}
        {hasFile && (
          <button
            className="btn primary"
            onClick={download}
            disabled={downloadMutation.isPending}
          >
            <Download size={15} />
            {downloadMutation.isPending
              ? "내려받는 중…"
              : `${isPreviewFile ? "초안 " : ""}${fileKind} 내려받기`}
          </button>
        )}

        <Link href="/templates" className="btn ml-auto px-2.5 py-1 text-[12.5px]">
          <Settings2 size={13} />
          양식 관리
        </Link>
      </div>

      <div className="mt-3 text-[12.5px] text-muted">
        {active ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <CheckCircle2 size={13} className="text-confirm" />
            지금 쓰는 서식 — {fileKind}
            {structure && (
              <>
                {" "}
                · 표 {structure.tables.length}개 · 칸 {structure.cells.length}개
              </>
            )}
            {isPreviewFile && " · 지금 받는 파일은 확정 전 초안입니다"}
          </span>
        ) : (
          "등록된 서식이 없습니다 — 올리지 않아도 문서는 글로 만들어지지만, 우리 원 양식 그대로 받으려면 한 개 올려 주세요."
        )}
      </div>

      {/* 올렸지만 아직 쓰지 않은 서식 — 칸 수를 보여 주고 사람이 결정한다 */}
      {pending && (
        <div className="mt-3">
          <Notice kind="info">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                새 서식을 읽었습니다
                {pendingDetail.data?.structure && (
                  <>
                    {" "}
                    — 표 {pendingDetail.data.structure.tables.length}개 · 칸{" "}
                    {pendingDetail.data.structure.cells.length}개
                  </>
                )}
                . 이 서식으로 바꿀까요?
              </span>
              <button
                className="btn primary ml-auto px-2.5 py-1 text-[12.5px]"
                onClick={use}
                disabled={activateMutation.isPending}
              >
                <Power size={13} />
                {activateMutation.isPending ? "바꾸는 중…" : "이 서식 쓰기"}
              </button>
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
