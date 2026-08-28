"use client";

/**
 * 이전에 쓰던 문서를 문체 예시로 등록하는 창 (FN-021 · EP-052/053).
 *
 * ■ 언제 뜨나
 * 알림장을 **처음 만들기 전에** 한 번. 이후에는 생성 화면의 「문체 예시 · 고치기」로만
 * 들어온다. 매번 물으면 초안 만들기가 두 걸음이 되고, 안 물으면 기관 말투를
 * 영영 못 배운다.
 *
 * ■ 왜 붙여넣기인가
 * 교사가 이미 카카오톡·키즈노트에 보낸 글이 있고, 그것을 복사해 오는 것이
 * 가장 짧은 길이다. 파일 업로드는 .hwpx/.docx 파싱이 필요한데, 표 안의 문안은
 * 추출 품질이 들쭉날쭉해서 오히려 이상한 예시가 들어간다.
 *
 * ■ 저장하면 글이 달라져 있을 수 있다
 * 서버가 아동·교사 이름을 ○○○로 가려서 저장한다. 그 결과를 **그대로 다시
 * 그린다** — 무엇이 지워졌는지 교사가 보고 손볼 수 있어야 하고, 화면에는
 * 원문이 남아 있는데 서버에는 가려진 글이 있는 어긋남도 없어진다.
 */

import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { useSaveStyleSamples, useStyleSamples } from "@/lib/queries";
import { DOC_TYPE_LABEL } from "@/lib/templates";
import type { DocType } from "@/lib/types";
import { Modal, Notice, Skeleton } from "@/components/ui";

/** 서버 상한과 같다(백엔드 `services/style_samples.MAX_SAMPLES`). */
const MAX_SAMPLES = 5;
/** 처음 열었을 때 보여 줄 빈 칸 수 — 3~5개가 권장 범위라 3에서 시작한다. */
const INITIAL_BLANKS = 3;

export function StyleSampleDialog({
  open,
  type,
  onClose,
}: {
  open: boolean;
  type: DocType;
  onClose: () => void;
}) {
  const { toast } = useApp();
  const query = useStyleSamples(type);
  const save = useSaveStyleSamples(type);
  const [texts, setTexts] = useState<string[]>([]);

  const label = DOC_TYPE_LABEL[type];

  // 열 때마다 서버 값으로 되돌린다. 닫고 다시 열었는데 지난번에 쓰다 만 글이
  // 남아 있으면, 저장된 것과 화면이 어긋난 채로 보인다.
  useEffect(() => {
    if (!open || query.data === undefined) return;
    const saved = query.data;
    setTexts(
      saved.length > 0
        ? saved
        : Array.from({ length: INITIAL_BLANKS }, () => ""),
    );
  }, [open, query.data]);

  const filled = texts.filter((t) => t.trim()).length;

  const setAt = (i: number, value: string) =>
    setTexts((prev) => prev.map((t, k) => (k === i ? value : t)));

  const removeAt = (i: number) =>
    setTexts((prev) => (prev.length <= 1 ? [""] : prev.filter((_, k) => k !== i)));

  const addBlank = () =>
    setTexts((prev) => (prev.length >= MAX_SAMPLES ? prev : prev.concat("")));

  const submit = () =>
    save.mutate(texts, {
      onSuccess: (saved) => {
        toast(
          saved.length > 0
            ? `${label} 문체 예시 ${saved.length}개를 저장했습니다`
            : "문체 예시를 지웠습니다 — 기본 문체로 씁니다",
        );
        onClose();
      },
      onError: (e) =>
        toast(e instanceof Error ? e.message : "저장하지 못했습니다."),
    });

  return (
    <Modal
      open={open}
      label={`이전에 쓰던 ${label} 등록`}
      onClose={onClose}
      wide
    >
      <h3>
        <Sparkles size={16} className="mr-1 inline" />
        이전에 쓰던 {label} 등록
      </h3>
      <div className="desc">
        어린이집마다 말투와 짜임이 다릅니다. 예전에 보낸 {label}을 넣어 두면
        초안이 그 문체를 따라가, 선생님이 고쳐 쓰는 양이 줄어듭니다.
        <b> 지금 없으면 건너뛰어도 됩니다.</b>
      </div>

      <div className="mt-4">
        <Notice kind="soft">
          <span>
            카카오톡·키즈노트에 보냈던 글을 <b>3~5개</b> 붙여 넣어 주세요. 아이·교사
            이름은 저장할 때 <b>○○○</b>로 가려집니다 — 가려진 결과가 이 화면에 다시
            보이니 확인하고 고치실 수 있습니다.
          </span>
        </Notice>
      </div>

      {query.isLoading ? (
        <div className="mt-4">
          <Skeleton lines={5} />
        </div>
      ) : (
        <div className="mt-4 flex max-h-[46vh] flex-col gap-2.5 overflow-y-auto pr-1">
          {texts.map((text, i) => (
            <div
              key={i}
              className="grid grid-cols-[26px_1fr_auto] items-start gap-2.5 rounded-[10px] border border-line bg-paper p-3"
            >
              <span className="mt-0.5 grid h-[24px] w-[24px] place-items-center rounded-lg bg-green-soft text-[12px] font-bold text-green-deep">
                {i + 1}
              </span>
              <textarea
                className="input min-h-[84px]"
                rows={3}
                placeholder={`${i + 1}번째 ${label}을 붙여 넣어 주세요`}
                value={text}
                onChange={(e) => setAt(i, e.target.value)}
              />
              <button
                className="btn ghost px-2.5 py-1.5"
                onClick={() => removeAt(i)}
                aria-label={`${i + 1}번 예시 지우기`}
                title="지우기"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="btnrow">
        <button
          className="btn"
          onClick={addBlank}
          disabled={texts.length >= MAX_SAMPLES}
        >
          <Plus size={14} /> 칸 추가
        </button>
        <span className="text-[12.5px] text-muted">
          {filled}개 작성 / 최대 {MAX_SAMPLES}개
        </span>
        <span className="flex-1" />
        <button className="btn" onClick={onClose} disabled={save.isPending}>
          건너뛰기
        </button>
        <button
          className="btn primary"
          onClick={submit}
          disabled={save.isPending || query.isLoading}
        >
          {save.isPending ? "저장 중…" : "저장"}
        </button>
      </div>
    </Modal>
  );
}
