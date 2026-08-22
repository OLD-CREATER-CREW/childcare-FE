"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileWarning,
  FolderOpen,
  Power,
  ShieldAlert,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  useActivateTemplate,
  useDeactivateTemplate,
  useSetTemplateStyle,
  useTemplate,
  useTemplates,
  useUploadTemplate,
} from "@/lib/queries";
import { useApp } from "@/lib/store";
import {
  TEMPLATE_DOC_TYPES,
  TEMPLATE_DOC_TYPE_LABEL,
  type FormTemplate,
  type TemplateDocType,
} from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  N,
  Notice,
  PageHead,
  QueryError,
  Skeleton,
  SpecBar,
} from "@/components/ui";

/**
 * SCR-015 양식 템플릿 관리 (FN-019) — 원장·교사 공용(청사진 Q4).
 *
 * 어린이집이 실제 쓰는 서식(.docx/.hwpx)을 문서 타입별로 등록해 두면, 이후
 * 문서를 만들 때 **그 서식에 채워진 완성 파일**을 받을 수 있다. 등록하지 않아도
 * 문서 생성은 텍스트로 그대로 동작한다 — 이 화면은 "있으면 더 좋아지는" 선택
 * 설정이지 반드시 거쳐야 하는 관문이 아니다.
 *
 * 이 화면이 지키는 두 가지 규율:
 *
 * 1. **업로드는 등록이지 활성화가 아니다.** 서버가 구조를 분석해 비활성으로만
 *    넣고(EP-032), 사람이 미리보기를 확인한 뒤 「이 템플릿 활성화」를 눌러야
 *    실제로 쓰인다(EP-037). "AI는 초안·분석, 사람이 확정"을 서식 등록에도 적용한다.
 * 2. **구 .hwp는 "지원하지 않는 형식"이 아니라 변환 방법을 안내한다.** 현장 서식
 *    표본 16개 중 14개가 구 .hwp였고, 확장자만 .hwpx로 고쳐 올리는 일도 실제로
 *    있어 서버가 파일 내용으로 판별한다(415 HWP_NEEDS_CONVERSION).
 */

/** 업로드 실패를 화면 문구로 옮긴다. `null`이면 이 화면이 아는 갈래가 아니다. */
type UploadFailure = {
  tone: "warn" | "info";
  title: string;
  body: React.ReactNode;
};

function readUploadError(e: unknown): UploadFailure {
  if (!(e instanceof ApiError))
    return {
      tone: "warn",
      title: "서식을 올리지 못했습니다",
      body: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
    };

  switch (e.code) {
    // 이 화면의 핵심 갈래. 서버 message에 변환 절차가 그대로 담겨 오므로
    // 우리가 고쳐 쓰지 않는다 — 한글 메뉴 이름이 바뀌면 서버만 고치면 된다.
    case "HWP_NEEDS_CONVERSION":
      return {
        tone: "warn",
        title: "한글 파일을 HWPX로 저장해 주세요",
        body: (
          <>
            <p className="m-0">{e.message}</p>
            <p className="mb-0 mt-2 text-[12.5px] text-muted">
              확장자만 <code>.hwpx</code>로 고쳐 올린 경우도 여기에 걸립니다 —
              파일 내용으로 판별하기 때문입니다. 한글에서 <b>다시 저장</b>해야
              합니다.
            </p>
          </>
        ),
      };
    case "UNSUPPORTED_TEMPLATE_FILE":
      return {
        tone: "warn",
        title: "지원하지 않는 파일 형식입니다",
        body: `${e.message} 한글 서식은 .hwpx로, 워드 서식은 .docx로 저장해 올려 주세요.`,
      };
    case "TEMPLATE_ANALYSIS_FAILED":
      return {
        tone: "info",
        title: "이 서식은 자동 채움을 지원하지 못합니다",
        body: (
          <>
            <p className="m-0">
              {e.message} 표를 읽지 못했습니다 — 표 안에 내용을 채울 칸이 있는
              서식인지 확인해 주세요. 중첩된 표나 병합이 지나치게 많은 서식은
              분석이 어렵습니다.
            </p>
            <p className="mb-0 mt-2 text-[12.5px] text-muted">
              지금 쓰고 있는 활성 서식은 그대로 유지됩니다. 다른 서식으로 다시
              시도하거나, 서식 없이 텍스트 문서만 쓰셔도 됩니다.
            </p>
          </>
        ),
      };
    default:
      return {
        tone: "warn",
        title: "서식을 올리지 못했습니다",
        body: e.message,
      };
  }
}

const fmtDate = (iso: string) => (iso ? iso.slice(0, 10) : "");

export default function TemplatesPage() {
  const { toast } = useApp();
  const [docType, setDocType] = useState<TemplateDocType>("notice");
  /** 미리보기로 펼쳐 볼 템플릿. 업로드 직후에는 방금 올린 것이 잡힌다. */
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [failure, setFailure] = useState<UploadFailure | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<FormTemplate | null>(
    null,
  );
  const [styleTarget, setStyleTarget] = useState<FormTemplate | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const listQuery = useTemplates(docType);
  const previewQuery = useTemplate(previewId);
  const uploadMutation = useUploadTemplate();
  const activateMutation = useActivateTemplate();
  const deactivateMutation = useDeactivateTemplate();
  const styleMutation = useSetTemplateStyle();

  const templates = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const active = templates.find((t) => t.active) ?? null;
  const preview = previewQuery.data ?? null;

  // 타입을 바꾸면 이전 타입의 미리보기가 남아 있으면 안 된다 — 다른 서식의
  // 칸 목록을 보면서 활성화를 누르는 사고를 막는다.
  const selectDocType = (t: TemplateDocType) => {
    setDocType(t);
    setPreviewId(null);
    setFailure(null);
  };

  const onPick = (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    uploadMutation.mutate(
      { docType, file },
      {
        onSuccess: (t) => {
          setPreviewId(t.id);
          toast(
            "구조를 분석했습니다 — 아래 칸 목록을 확인하고 「이 템플릿 활성화」를 눌러 주세요",
          );
        },
        onError: (e) => {
          setPreviewId(null);
          setFailure(readUploadError(e));
        },
      },
    );
    // 같은 파일을 다시 고를 수 있게 비운다(변환 후 재시도가 흔하다).
    if (fileRef.current) fileRef.current.value = "";
  };

  const activate = (id: number) =>
    activateMutation.mutate(id, {
      onSuccess: () =>
        toast(
          `${TEMPLATE_DOC_TYPE_LABEL[docType]} 서식을 활성화했습니다 — 이제 이 서식에 채워진 파일을 받을 수 있습니다`,
        ),
      onError: (e) =>
        toast(e instanceof ApiError ? e.message : "활성화하지 못했습니다"),
    });

  const deactivate = () => {
    if (!deactivateTarget) return;
    deactivateMutation.mutate(deactivateTarget.id, {
      onSuccess: () => {
        setDeactivateTarget(null);
        toast("비활성화했습니다 — 이 문서 종류는 텍스트로만 만들어집니다");
      },
    });
  };

  const toggleStyle = (t: FormTemplate) => {
    // 끄는 것은 되돌리는 방향이라 경고가 필요 없다. 켤 때만 확인 화면을 세운다.
    if (t.styleEnabled) {
      styleMutation.mutate(
        { id: t.id, enabled: false },
        { onSuccess: () => toast("문체 예시를 껐습니다") },
      );
      return;
    }
    setPreviewId(t.id);
    setStyleTarget(t);
  };

  const confirmStyleOn = () => {
    if (!styleTarget) return;
    styleMutation.mutate(
      { id: styleTarget.id, enabled: true },
      {
        onSuccess: () => {
          setStyleTarget(null);
          toast("문체 예시를 켰습니다 — 이 서식의 기존 문안이 참고됩니다");
        },
      },
    );
  };

  return (
    <>
      <PageHead
        title="양식 관리"
        sub="우리 원 서식을 등록해 두면 완성 문서 파일을 그 서식으로 받습니다"
      />
      <SpecBar
        scr="SCR-015"
        fn={["FN-019 양식 템플릿"]}
        ep={[
          "EP-032 업로드",
          "EP-033 목록",
          "EP-034 상세",
          "EP-037 활성화",
          "EP-035 비활성화",
        ]}
      />

      <div className="stack">
        {/* ① 문서 타입 선택 — 타입마다 활성 템플릿을 따로 관리한다(타입당 1개) */}
        <div className="card">
          <h2>
            <N n={1} />
            문서 종류
            <span className="hint">타입마다 활성 서식 1개</span>
          </h2>
          <div className="chiprow">
            {TEMPLATE_DOC_TYPES.map((t) => (
              <button
                key={t}
                className={`chip ${t === docType ? "on" : ""}`}
                onClick={() => selectDocType(t)}
              >
                {TEMPLATE_DOC_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <Notice kind="soft">
              놀이이야기는 서식 등록 대상이 아닙니다 — 자유 서술 문서라 채울
              표가 없습니다.
            </Notice>
          </div>
        </div>

        {/* ② 현재 활성 템플릿 */}
        <div className="card">
          <h2>
            <N n={2} />
            현재 활성 서식
            <span className="hint">{TEMPLATE_DOC_TYPE_LABEL[docType]}</span>
          </h2>

          {listQuery.isLoading ? (
            <Skeleton lines={3} />
          ) : listQuery.isError ? (
            <QueryError onRetry={() => listQuery.refetch()} />
          ) : active ? (
            <ActiveTemplateRow
              template={active}
              onPreview={() => setPreviewId(active.id)}
              onDeactivate={() => setDeactivateTarget(active)}
              onToggleStyle={() => toggleStyle(active)}
              stylePending={styleMutation.isPending}
            />
          ) : (
            /* 빈 상태에서 불안을 주지 않는다 — 폴백이 정상 동작임을 밝힌다 */
            <EmptyState
              icon="📄"
              title="아직 등록된 서식이 없습니다"
              desc="서식을 올리지 않아도 문서는 텍스트로 만들어집니다. 우리 원 서식 그대로 받고 싶을 때만 등록하세요."
            />
          )}
        </div>

        {/* ③ 업로드 — hwpx 안내는 상시 노출(스토리보드 r12) */}
        <div className="card">
          <h2>
            <N n={3} />새 서식 파일 올리기
            <span className="hint">.docx · .hwpx</span>
          </h2>

          <input
            ref={fileRef}
            type="file"
            accept=".docx,.hwpx"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <div className="btnrow">
            <button
              className="btn primary"
              onClick={() => fileRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <FolderOpen size={15} />
              {uploadMutation.isPending
                ? "서식을 분석하는 중…"
                : active
                  ? "다른 파일로 교체"
                  : "서식 파일 선택"}
            </button>
          </div>

          {/*
            현장 서식 대부분이 구 .hwp라, 올린 뒤에야 거절당하는 일이 잦다.
            그래서 이 안내는 오류가 났을 때가 아니라 **항상** 보인다(r12).
          */}
          <div className="mt-3">
            <Notice kind="info">
              {/* `.notice`가 flex라 인라인 요소를 그대로 두면 낱개 항목으로
                  흩어진다 — 한 덩어리로 감싸 문장으로 읽히게 한다. */}
              <div>
                한글 서식은 <b>.hwpx로 저장</b>해 올려 주세요 — 한글에서 [파일 →
                다른 이름으로 저장]을 열고 파일 형식을{" "}
                <b>&lsquo;HWPX 문서&rsquo;</b>로 고른 뒤 저장하면 됩니다.
                확장자만 <code>.hwpx</code>로 바꾼 파일은 내용으로 걸러집니다.
              </div>
            </Notice>
          </div>

          {uploadMutation.isPending && (
            <div className="draftbox mt-3">
              <Skeleton lines={3} />
              <div className="hint">
                서식을 열어 표 칸을 찾는 중입니다… 잠시만 기다려 주세요.
              </div>
            </div>
          )}

          {failure && (
            <div className="mt-3">
              <Notice kind={failure.tone}>
                <div className="flex items-start gap-2">
                  {failure.tone === "warn" ? (
                    <AlertTriangle size={16} className="mt-0.5 flex-none" />
                  ) : (
                    <FileWarning size={16} className="mt-0.5 flex-none" />
                  )}
                  <div>
                    <b>{failure.title}</b>
                    <div className="mt-1">{failure.body}</div>
                  </div>
                </div>
              </Notice>
            </div>
          )}
        </div>

        {/* ④·⑤ 구조 분석 미리보기 + 활성화 */}
        {previewId != null && (
          <div className="card">
            <h2>
              <span className="badge-ai">🤖 구조 분석</span>
              <span className="hint">
                자동 분석 결과입니다 — 확인한 뒤 활성화하세요
              </span>
            </h2>

            {previewQuery.isLoading ? (
              <div className="draftbox">
                <Skeleton lines={6} />
                <div className="hint">서식을 분석하는 중입니다…</div>
              </div>
            ) : previewQuery.isError ? (
              <QueryError onRetry={() => previewQuery.refetch()} />
            ) : !preview ? null : preview.analysisFailed ? (
              <Notice kind="warn">
                이 서식은 자동 채움을 지원하지 못합니다 — 표 구조를 읽지
                못했습니다. 활성화할 수 없습니다.
              </Notice>
            ) : !preview.structure ? (
              /* v1(구 분석)으로 등록된 템플릿 — 칸 정보가 없어 그릴 수 없다 */
              <Notice kind="info">
                이 서식은 예전 방식으로 분석돼 칸 정보가 없습니다. 활성화는
                되지만 미리보기는 볼 수 없습니다 — 다시 올리면 칸 목록이
                보입니다.
              </Notice>
            ) : (
              <StructurePreview template={preview} />
            )}

            {preview && !preview.analysisFailed && (
              <div className="btnrow">
                {preview.active ? (
                  <span className="badge-final">
                    <CheckCircle2 size={13} /> 사용 중인 서식입니다
                  </span>
                ) : (
                  <button
                    className="btn primary"
                    onClick={() => activate(preview.id)}
                    disabled={activateMutation.isPending}
                  >
                    <N n={5} />
                    <CheckCircle2 size={14} />
                    {activateMutation.isPending
                      ? "활성화 중…"
                      : "이 템플릿 활성화"}
                  </button>
                )}
                <button
                  className="btn ghost"
                  onClick={() => setPreviewId(null)}
                >
                  닫기
                </button>
              </div>
            )}

            {preview && !preview.active && !preview.analysisFailed && (
              <div className="mt-3">
                <Notice kind="soft">
                  활성화를 누르기 전까지는 기존 서식이 그대로 쓰입니다 — 검토
                  없이 자동으로 바뀌지 않습니다.
                </Notice>
              </div>
            )}
          </div>
        )}

        {/* 등록 이력 — 교체 이력도 남는다(파일을 지우지 않는다) */}
        {templates.length > 0 && (
          <div className="card">
            <h2>
              <N n={6} />
              등록 이력
              <span className="hint">{templates.length}건</span>
            </h2>
            <table className="tbl rowhover">
              <thead>
                <tr>
                  <th>등록일</th>
                  <th>상태</th>
                  <th>문체 예시</th>
                  <th className="text-right">동작</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-[12.5px]">
                      {fmtDate(t.createdAt)}
                    </td>
                    <td>
                      {t.active ? (
                        <span className="tag daily">활성</span>
                      ) : (
                        <span className="tag">비활성</span>
                      )}
                    </td>
                    <td className="text-[12.5px] text-muted">
                      {t.styleEnabled ? "켜짐" : "꺼짐"}
                    </td>
                    <td className="text-right">
                      <button
                        className="btn px-2.5 py-1 text-[12.5px]"
                        onClick={() => setPreviewId(t.id)}
                      >
                        <Eye size={13} />
                        미리보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="이 서식을 비활성화할까요?"
        desc={
          <>
            비활성화하면 <b>{TEMPLATE_DOC_TYPE_LABEL[docType]}</b>은 서식 없이
            텍스트로만 만들어집니다. 파일은 지워지지 않고 이력에 남으므로 언제든
            다시 활성화할 수 있습니다.
          </>
        }
        confirmLabel="비활성화"
        danger
        pending={deactivateMutation.isPending}
        onConfirm={deactivate}
        onClose={() => setDeactivateTarget(null)}
      />

      <StyleConsentDialog
        open={styleTarget !== null}
        template={preview}
        pending={styleMutation.isPending}
        onConfirm={confirmStyleOn}
        onClose={() => setStyleTarget(null)}
      />
    </>
  );
}

function ActiveTemplateRow({
  template,
  onPreview,
  onDeactivate,
  onToggleStyle,
  stylePending,
}: {
  template: FormTemplate;
  onPreview: () => void;
  onDeactivate: () => void;
  onToggleStyle: () => void;
  stylePending: boolean;
}) {
  return (
    <>
      <div className="setrow">
        <div>
          <div className="t">
            <CheckCircle2 size={14} className="mr-1 inline text-confirm" />
            사용 중 · 등록일 {fmtDate(template.createdAt)}
          </div>
          <div className="d">
            이 문서 종류를 확정한 뒤 「문서 만들기」를 누르면 이 서식에 채워진
            파일을 받습니다.
          </div>
        </div>
        <div className="act flex gap-2">
          <button className="btn px-2.5 py-1 text-[12.5px]" onClick={onPreview}>
            <Eye size={13} />
            미리보기
          </button>
          <button
            className="btn danger px-2.5 py-1 text-[12.5px]"
            onClick={onDeactivate}
          >
            <Power size={13} />
            비활성화
          </button>
        </div>
      </div>

      {/*
        문체 예시(EP-052)는 기본 꺼짐이다. 켜면 서식에 이미 적혀 있던 문안이
        생성 프롬프트에 실리는데, 교사가 올리는 서식은 빈 양식이 아니라 작년
        작성본인 경우가 많고 실제 아동·교사 이름이 들어 있다. 서버가 마스킹하지만
        완전하지 않으므로 **내용을 눈으로 확인하고 켜는 흐름**이어야 한다.
      */}
      <div className="setrow">
        <div>
          <div className="t">서식의 기존 문안을 문체 예시로 쓰기</div>
          <div className="d">
            켜면 이 서식에 이미 적혀 있던 글이 생성 프롬프트에 함께 들어가
            문체가 비슷해집니다. <b>개인정보가 실릴 수 있어 기본은 꺼짐</b>
            입니다.
          </div>
        </div>
        <div className="act">
          <button
            className={`toggle ${template.styleEnabled ? "on" : ""}`}
            role="switch"
            aria-checked={template.styleEnabled}
            aria-label="서식의 기존 문안을 문체 예시로 쓰기"
            onClick={onToggleStyle}
            disabled={stylePending}
          >
            <i />
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * ④ 구조 분석 미리보기.
 *
 * 활성화 전에 **채울 칸이 몇 개이고 어떤 라벨인지**를 사람이 확인할 수 있어야
 * 한다. 라벨은 서식의 `행 라벨 / 열 라벨`에서 나오므로, 여기 보이는 이름이 곧
 * 문서에서 그 칸에 들어갈 내용의 성격이다.
 */
function StructurePreview({ template }: { template: FormTemplate }) {
  const structure = template.structure;
  if (!structure) return null;

  const withText = structure.cells.filter((c) => c.existingText).length;
  const totalTables = structure.tables.length;
  const nested = structure.tables.some((t) => t.nested);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        <span className="tag">
          {structure.sourceFormat?.toUpperCase() ?? "서식"}
        </span>
        <span>
          표 {totalTables}개 ·{" "}
          <b className="text-ink">찾아낸 칸 {structure.cells.length}개</b>
        </span>
        {withText > 0 && <span>· 기존 문안이 있는 칸 {withText}개</span>}
        {nested && <span>· 중첩 표 포함</span>}
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>칸</th>
            <th>라벨</th>
            <th className="text-right">분량</th>
            <th>지금 내용</th>
          </tr>
        </thead>
        <tbody>
          {structure.cells.map((c) => (
            <tr key={c.key}>
              <td className="whitespace-nowrap font-mono text-[11.5px] text-muted">
                {c.key}
              </td>
              <td className="text-[13px]">{c.label || "(라벨 없음)"}</td>
              <td className="whitespace-nowrap text-right font-mono text-[11.5px] text-muted">
                {/* 서식이 칸 크기를 알려 주지 않으면 0이 온다 — "~0자"는 거짓말이다 */}
                {c.budgetChars > 0 ? `~${c.budgetChars}자` : "—"}
              </td>
              <td className="max-w-[280px] text-[12.5px] text-muted">
                {c.existingText ? (
                  <span title={c.existingText}>
                    {c.existingText.slice(0, 40)}
                    {c.existingText.length > 40 ? "…" : ""}
                  </span>
                ) : (
                  <span className="text-[12px]">비어 있음 — 새로 채웁니다</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {withText > 0 && (
        <div className="mt-3">
          <Notice kind="soft">
            <div>
              기존 문안이 있는 칸은 <b>지우지 않고 그대로 둡니다</b> — 서식에
              인쇄된 정형 문구일 수 있기 때문입니다.
            </div>
          </Notice>
        </div>
      )}
    </>
  );
}

/**
 * 문체 예시를 켜기 전 동의 화면.
 *
 * 경고만 띄우고 끝내지 않는다 — **실제로 프롬프트에 실릴 문장을 보여 준다.**
 * 작년 작성본에 아이 이름이 남아 있는지는 그 글을 봐야 알 수 있고, 그 판단은
 * 교사만 할 수 있다.
 */
function StyleConsentDialog({
  open,
  template,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  template: FormTemplate | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const samples = (template?.structure?.cells ?? []).filter(
    (c) => c.existingText,
  );

  return (
    <Modal open={open} label="문체 예시 사용 확인" onClose={onClose} wide>
      <h3>
        <ShieldAlert size={16} className="mr-1.5 inline text-warn" />
        서식에 적힌 글을 AI에게 보여 줄까요?
      </h3>
      <div className="desc">
        켜면 아래 문장이 <b>생성 프롬프트에 그대로 들어갑니다.</b> 교사가 올리는
        서식은 빈 양식이 아니라 작년 작성본인 경우가 많고, 실제 아동·교사 이름이
        남아 있을 수 있습니다. 서버가 이름을 가리지만 완전하지는 않습니다.
        <b> 내용을 직접 확인한 뒤 켜 주세요.</b>
      </div>

      <div className="draftbox mt-3 max-h-[240px] overflow-y-auto">
        {samples.length === 0 ? (
          <p className="m-0 text-[13px] text-muted">
            이 서식에는 미리 적혀 있는 문안이 없습니다 — 켜도 프롬프트에 실릴
            글이 없습니다.
          </p>
        ) : (
          samples.map((c) => (
            <div key={c.key} className="mb-3 last:mb-0">
              <div className="mb-1 text-[11.5px] font-semibold text-muted">
                {c.label}
              </div>
              <p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed">
                {c.existingText}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn ghost" onClick={onClose}>
          취소
        </button>
        <button className="btn primary" onClick={onConfirm} disabled={pending}>
          {pending ? "처리 중…" : "확인했습니다 — 켜기"}
        </button>
      </div>
    </Modal>
  );
}
