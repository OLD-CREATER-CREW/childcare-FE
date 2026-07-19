"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mic, Paperclip } from "lucide-react";
import { useApp } from "@/lib/store";
import { useChildren, useSaveDailyRecord } from "@/lib/queries";
import { N, PageHead, Skeleton, SpecBar } from "@/components/ui";

const ACTIVITIES = [
  "바깥놀이",
  "블록쌓기",
  "그림그리기",
  "역할놀이",
  "동화듣기",
  "노래·율동",
];

// SCR-003 하루 기록 입력 — 모든 문서의 유일한 원천 (FN-001)
function RecordForm() {
  const { toast } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const childrenQuery = useChildren();
  const saveMutation = useSaveDailyRecord();

  const [child, setChild] = useState(params.get("child") ?? "c01");
  const [date, setDate] = useState("2026-07-16");
  const [acts, setActs] = useState<string[]>(["바깥놀이", "블록쌓기"]);
  const [lunch, setLunch] = useState("다 먹음");
  const [snack, setSnack] = useState("남김");
  const [napFrom, setNapFrom] = useState("12:40");
  const [napTo, setNapTo] = useState("14:10");
  const [napQuality, setNapQuality] = useState("잘 잤어요");
  const [memo, setMemo] = useState("");

  const toggleAct = (a: string) =>
    setActs((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );

  const buildInput = () => ({
    childId: child,
    date,
    activities: acts,
    lunch,
    snack,
    napFrom,
    napTo,
    napQuality,
    memo,
  });

  const save = () =>
    saveMutation.mutate(buildInput(), {
      onSuccess: () => toast("저장했습니다"),
    });

  const saveAndDraft = () =>
    saveMutation.mutate(buildInput(), {
      onSuccess: () => {
        toast("저장 완료 — 알림장 초안을 만듭니다");
        router.push("/notices");
      },
    });

  return (
    <>
      <PageHead
        title="하루 기록 입력"
        sub="아이별 1회 입력 — 모든 문서의 유일한 원천"
      />
      <SpecBar
        scr="SCR-003"
        fn={["FN-001"]}
        ep={["EP-007 저장", "EP-008 불러오기", "EP-004 아이 목록"]}
      />

      <div className="card">
        <div className="inline">
          <div className="field m-0">
            <label>
              <N n={1} />
              날짜
            </label>
            <select
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            >
              <option value="2026-07-16">2026-07-16 (목)</option>
              <option value="2026-07-15">2026-07-15 (수)</option>
            </select>
          </div>
          <div className="field m-0">
            <label>아이</label>
            {childrenQuery.isLoading ? (
              <div className="skel w-32" style={{ height: 38 }} />
            ) : (
              <select
                className="input"
                value={child}
                onChange={(e) => setChild(e.target.value)}
              >
                {childrenQuery.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <span className="notice soft ml-auto text-xs">
            같은 날짜·아이 기록이 있으면 불러와 수정 모드가 됩니다
          </span>
        </div>
      </div>

      <div className="card">
        <div className="field">
          <label>
            <N n={2} />
            활동{" "}
            <span className="font-normal">
              — 자주 쓰는 키워드로 빠르게(자유 서술 최소화)
            </span>
          </label>
          <div className="chiprow">
            {ACTIVITIES.map((a) => (
              <button
                key={a}
                className={`chip ${acts.includes(a) ? "on" : ""}`}
                onClick={() => toggleAct(a)}
              >
                {a}
              </button>
            ))}
            <button className="chip border-dashed">＋ 직접 입력</button>
          </div>
        </div>
        <div className="inline mb-[13px]">
          <div className="field m-0">
            <label>
              <N n={3} />
              점심
            </label>
            <select
              className="input"
              value={lunch}
              onChange={(e) => setLunch(e.target.value)}
            >
              <option>다 먹음</option>
              <option>조금 남김</option>
              <option>많이 남김</option>
              <option>거의 안 먹음</option>
            </select>
          </div>
          <div className="field m-0">
            <label>간식</label>
            <select
              className="input"
              value={snack}
              onChange={(e) => setSnack(e.target.value)}
            >
              <option>남김</option>
              <option>다 먹음</option>
              <option>안 먹음</option>
            </select>
          </div>
          <div className="field m-0">
            <label>
              <N n={4} />
              낮잠
            </label>
            <span className="inline">
              <input
                className="input w-[86px]"
                value={napFrom}
                onChange={(e) => setNapFrom(e.target.value)}
              />{" "}
              ~{" "}
              <input
                className="input w-[86px]"
                value={napTo}
                onChange={(e) => setNapTo(e.target.value)}
              />
              <select
                className="input"
                value={napQuality}
                onChange={(e) => setNapQuality(e.target.value)}
              >
                <option>잘 잤어요</option>
                <option>뒤척였어요</option>
                <option>못 잤어요</option>
              </select>
            </span>
          </div>
        </div>
        <div className="field">
          <label>
            <N n={5} />
            특이사항 메모{" "}
            <span className="font-normal">
              — 발달영역 자동 태깅(FN-010)의 원료
            </span>
          </label>
          <textarea
            className="input"
            placeholder="예: 친구와 장난감 두고 다툼, 금방 화해"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
        <div className="field mb-0">
          <label>
            <N n={6} />
            사진·음성 첨부
          </label>
          <div className="inline">
            <button className="btn inline-flex items-center gap-1.5">
              <Paperclip size={14} /> 파일 선택
            </button>
            <button className="btn inline-flex items-center gap-1.5">
              <Mic size={14} /> 녹음
            </button>
            <span className="text-xs text-muted">
              사진은 사진함 분류(FN-006)로 연결됩니다
            </span>
          </div>
        </div>
      </div>

      <div className="btnrow">
        <button
          className="btn big"
          onClick={save}
          disabled={saveMutation.isPending}
        >
          <N n={7} />
          {saveMutation.isPending ? "저장 중…" : "저장"}
        </button>
        <button
          className="btn primary big"
          onClick={saveAndDraft}
          disabled={saveMutation.isPending}
        >
          <N n={8} />
          저장하고 알림장 초안 만들기
        </button>
      </div>
    </>
  );
}

export default function RecordsPage() {
  return (
    <Suspense>
      <RecordForm />
    </Suspense>
  );
}
