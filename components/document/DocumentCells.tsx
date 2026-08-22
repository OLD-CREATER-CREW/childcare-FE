"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Lock, PencilLine } from "lucide-react";
import { useSaveDocumentCells, useTemplate } from "@/lib/queries";
import { Notice } from "@/components/ui";
import type { DocType, DocumentCell } from "@/lib/types";

/**
 * 칸 단위 검토·수정 — 원본 서식의 칸을 그대로 늘어놓는다.
 *
 * 왜 표로 그리지 않는가: 표 구조(행·열·병합)는 문서가 아니라 **템플릿**에 속하고
 * (`GET /api/templates/{id}`), 실물 서식은 29행 9열에 병합이 얽혀 있어 화면에
 * 재현하면 각 칸이 두세 글자 폭으로 찌그러진다. 교사가 여기서 하는 일은 표를
 * 보는 게 아니라 **AI가 쓴 문장을 고치는 것**이라, 라벨 + 넓은 편집창이 낫다.
 * 원본 배치는 완성 파일(EP-036)에서 그대로 보인다.
 *
 * 저장은 `PUT /api/documents/{id}/draft`에 **바뀐 칸만** 보낸다 — 서버가 병합한다.
 */
export function DocumentCells({
  type,
  childId,
  cells,
  templateId,
  editable,
}: {
  type: DocType;
  childId: string | null;
  cells: DocumentCell[];
  templateId: number | null;
  /** 확정 후에는 읽기 전용이다 */
  editable: boolean;
}) {
  const saveMutation = useSaveDocumentCells();
  // 표 구조는 문서마다 다시 받지 않는다 — 템플릿에서 한 번 받아 캐시한다.
  const templateQuery = useTemplate(templateId);

  /** 편집 중인 값. 서버 값이 도착해도 타이핑을 덮지 않도록 화면이 들고 있는다. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // 아이·문서가 바뀌면 편집 중이던 값은 남아 있으면 안 된다.
  useEffect(() => {
    setDrafts({});
  }, [type, childId]);

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const valueOf = (c: DocumentCell) => drafts[c.key] ?? c.text;

  const onEdit = (key: string, next: string) => {
    setDrafts((d) => ({ ...d, [key]: next }));
    clearTimeout(timers.current[key]);
    // 칸마다 따로 디바운스한다 — 한 칸을 고치는 동안 다른 칸까지 저장하면
    // 방금 서버가 준 값으로 되돌아가는 칸이 생긴다.
    timers.current[key] = setTimeout(() => {
      saveMutation.mutate(
        { type, childId, cells: { [key]: next } },
        {
          onSuccess: () => {
            setSavedKey(key);
            setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1600);
          },
        },
      );
    }, 800);
  };

  const aiCells = cells.filter((c) => c.source !== "template");
  const emptyCount = aiCells.filter((c) => !valueOf(c).trim()).length;
  const structure = templateQuery.data?.structure ?? null;

  return (
    <div className="stack">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        <span className="badge-ai">
          <Bot size={12} /> 칸 {aiCells.length}개
        </span>
        {structure && (
          <span>
            원본 서식 표 {structure.tables.length}개 · 칸{" "}
            {structure.cells.length}개
          </span>
        )}
        <span className="ml-auto">
          라벨은 서식의 <b>행/열 이름</b>에서 나옵니다
        </span>
      </div>

      {/*
        칸이 비어 오는 일이 간헐적으로 있다(모델이 형식을 벗어나면 서버가 재시도
        하지만 100%는 아니다). 화면이 깨지지 않는 것에 더해, 교사가 **어디를 채워야
        하는지** 알 수 있어야 한다.
      */}
      {emptyCount > 0 && (
        <Notice kind="warn">
          내용이 비어 있는 칸이 {emptyCount}개 있습니다 — 아래에서 직접 채우거나
          「다시 생성」을 눌러 주세요. 빈 칸이 있어도 확정·문서 만들기는 됩니다.
        </Notice>
      )}

      {cells.map((c) => {
        const value = valueOf(c);
        const locked = !editable || !c.editable;
        return (
          <div key={c.key} className="card">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-ink">
                {c.label || "(라벨 없음)"}
              </span>
              <CellSourceTag source={c.source} />
              <span className="font-mono text-[11px] text-muted">{c.key}</span>
              {savedKey === c.key && (
                <span className="ml-auto text-[11.5px] font-semibold text-confirm">
                  저장됨 ✓
                </span>
              )}
            </div>

            {locked ? (
              <div className="draftbox confirmed whitespace-pre-wrap text-[14px] leading-[1.85]">
                {value || (
                  <span className="text-[13px] text-muted">
                    비어 있는 칸입니다 — 서식 원형을 그대로 둡니다.
                  </span>
                )}
              </div>
            ) : (
              <div className="draftbox">
                <textarea
                  value={value}
                  onChange={(e) => onEdit(c.key, e.target.value)}
                  rows={Math.max(2, Math.ceil(value.length / 45))}
                  placeholder="이 칸은 비어 있습니다 — 직접 채워 주세요"
                  className="w-full resize-y border-0 bg-transparent text-[14px] leading-[1.85] [font-family:inherit] focus:outline-none"
                  aria-label={`${c.label} 칸 편집`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 이 글이 어디서 왔는지를 칸마다 밝힌다.
 *
 * 교사의 검토 범위를 좁히는 장치다 — `template` 칸은 서식에 인쇄된 정형 문구라
 * 읽을 필요가 없고, `ai` 칸만 사실과 대조하면 된다.
 */
function CellSourceTag({ source }: { source: DocumentCell["source"] }) {
  if (source === "template")
    return (
      <span className="tag" title="서식에 인쇄된 문구 — 수정하지 않습니다">
        <Lock size={10} className="mr-0.5 inline" />
        서식 문구
      </span>
    );
  if (source === "teacher")
    return (
      <span className="tag manual">
        <PencilLine size={10} className="mr-0.5 inline" />
        직접 수정함
      </span>
    );
  return (
    <span className="tag dom">
      <Bot size={10} className="mr-0.5 inline" />
      AI 작성
    </span>
  );
}
