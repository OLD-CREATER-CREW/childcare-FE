"use client";

import { useMemo, useState } from "react";
import { DATE_OPTIONS, TODAY, dateLabel } from "@/lib/constants";
import { useApp } from "@/lib/store";
import {
  useChildren,
  useDayRecordedIds,
  useDayRecords,
  useDocumentDraft,
} from "@/lib/queries";
import { DocumentWorkbench } from "@/components/document/DocumentWorkbench";
import { DocumentTemplateBar } from "@/components/document/DocumentTemplateBar";
import { ProvenanceReader } from "@/components/document/ProvenanceReader";
import type {
  ProvenanceBlock,
  SourceRecordCard,
} from "@/components/document/ProvenanceReader";
import { PageHead, Select, Skeleton, SpecBar } from "@/components/ui";
import type { Child, DayRecord, DocumentDraft } from "@/lib/types";

/**
 * SCR-006 보육일지 — 검토를 지나 우리 원 서식에 채운 한글 파일까지.
 *
 * 이 화면의 산출물은 글이 아니라 **한글 파일**이다. 원에 제출하는 것은 원 서식에
 * 채워진 보육일지라, 화면 맨 위에 서식을 올리는 칸을 둔다(`DocumentTemplateBar`).
 *
 * ■ 한때 검토 단계가 없었다
 * 「만들기」 한 번으로 생성·확정·렌더링·내려받기가 끝났다 — 고칠 곳은 받은 hwpx를
 * 한글에서 고치는 편이 빠르다고 봤기 때문이다. 되돌린 이유는 **출처 표시**다
 * (FN-022). 어느 칸이 어느 기록에서 나왔는지 화면이 보여 주는데 정작 그 자리에서
 * 고칠 수 없으면, 교사는 틀린 문장을 찾고도 한글을 열어 그 칸을 다시 찾아야 한다.
 * 발견과 수정이 다른 앱에서 일어나면 검토가 아니다.
 *
 * 그래서 다른 문서와 같은 워크벤치를 쓴다 — 초안 → 칸별 검토·수정 → 확정 →
 * 문서 만들기 → 내려받기.
 *
 * 일지는 **날짜 단위 문서**다(EP-010의 `date`). 오늘만 쓸 수 있으면 어제 못 쓴
 * 일지를 이 화면에서 만들 수 없어, 하루 기록(SCR-003)과 같은 날짜 선택을 둔다.
 * 고른 날짜는 조회·생성·확정·내려받기까지 한 줄로 따라간다.
 */
export default function JournalPage() {
  const { auth } = useApp();
  const [date, setDate] = useState(TODAY);
  const childrenQuery = useChildren();
  const recordedQuery = useDayRecordedIds(date);
  /** 출처 카드가 이 목록에서 나온다 — 서버가 일지를 만들 때 쓴 기록과 같다. */
  const dayRecordsQuery = useDayRecords(date);
  const draftQuery = useDocumentDraft("journal", null, date);

  // useMemo 의존성에 들어가므로 렌더마다 새 배열이 되지 않게 고정한다.
  const kids = useMemo(() => childrenQuery.data ?? [], [childrenQuery.data]);
  const attending = kids.filter((c) => c.attending).length;
  const absent = kids.length - attending;
  const recorded = recordedQuery.data?.length ?? 0;

  const doc = draftQuery.data ?? null;
  const sourceCards = useMemo(
    () => recordCards(dayRecordsQuery.data ?? [], kids),
    [dayRecordsQuery.data, kids],
  );
  /** 표시가 하나라도 있어야 「출처 보기」를 붙인다 — 없으면 빈 화면만 준다. */
  const hasProvenance =
    doc != null && Object.keys(doc.cellProvenance).length > 0;

  return (
    <>
      <PageHead
        title="보육일지"
        sub={`${auth?.centerName ?? ""} ${dateLabel(date)} — 검토한 뒤 우리 원 서식에 채워 받습니다`.trim()}
        right={
          <Select
            className="w-fit"
            value={date}
            onChange={setDate}
            ariaLabel="일지 날짜"
            options={DATE_OPTIONS}
          />
        }
      />
      <SpecBar
        scr="SCR-006"
        fn={["FN-003 파생", "FN-019 양식", "FN-020 파일", "FN-022 출처"]}
        ep={[
          "EP-010 generate(journal, date)",
          "EP-013 칸 편집",
          "EP-014 확정",
          "EP-038 문서 만들기",
          "EP-036 내려받기",
        ]}
      />
      <DocumentWorkbench
        /* 날짜가 바뀌면 다른 문서다 — 편집 중이던 상태가 넘어오면 안 된다. */
        key={date}
        type="journal"
        date={date}
        generateLabel="초안 만들기"
        emptyMessage="이 날의 하루 기록이 없습니다. 일지는 그날 하루 기록에서 나옵니다 — 하루 기록을 먼저 저장해 주세요."
        topSlot={<DocumentTemplateBar type="journal" date={date} />}
        provenanceView={
          hasProvenance
            ? () => (
                <ProvenanceReader
                  blocks={cellBlocks(doc)}
                  records={sourceCards}
                  citations={draftQuery.data?.citations ?? []}
                  hint="점선 밑줄 = 하루 기록에서 나온 구문 · 눌러서 근거를 봅니다"
                />
              )
            : undefined
        }
        source={
          childrenQuery.isLoading || recordedQuery.isLoading ? (
            <Skeleton lines={5} />
          ) : (
            <table className="tbl">
              <tbody>
                <tr>
                  <td className="w-20 text-muted">날짜</td>
                  <td>
                    {dateLabel(date)}
                    {date === TODAY ? "" : " — 지난 날짜의 일지입니다"}
                  </td>
                </tr>
                {/* 출결은 지금 등원 상태라 오늘에만 뜻이 있다. 지난 날짜에
                    오늘의 등원 수를 얹으면 사실이 아닌 숫자가 일지로 들어간다. */}
                {date === TODAY && (
                  <tr>
                    <td className="text-muted">출결</td>
                    <td>
                      등원 {attending}명 / 결석 {absent}명
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="text-muted">하루 기록</td>
                  <td>
                    {recorded}/{kids.length}명 작성 — 그날 기록 전체가 일지의
                    원천
                  </td>
                </tr>
                <tr>
                  <td className="text-muted">급식</td>
                  <td>정상 배식 · 알레르기 대체식 3건</td>
                </tr>
                <tr>
                  <td className="text-muted">낮잠</td>
                  <td>평균 1시간 20분</td>
                </tr>
                <tr>
                  <td className="text-muted">특이</td>
                  <td>또래 갈등 1건 (중재 후 해결)</td>
                </tr>
              </tbody>
            </table>
          )
        }
      />
    </>
  );
}

/**
 * 문서의 칸을 출처 블록으로 옮긴다.
 *
 * **표시가 있는 칸만** 그린다. 채운 칸이 23개인 서식에서 근거 없는 칸까지
 * 늘어놓으면 밑줄 있는 칸이 그 사이에 묻힌다 — 이 화면은 "어느 기록이 어디에
 * 쓰였나"를 보는 자리이고, 칸 전체를 훑는 일은 「칸별로 보기」가 맡는다.
 *
 * `where`는 표 좌표다. 교사가 고칠 곳을 한글에서 찾을 때 칸 이름만으로는
 * 부족하다 — 실물 서식에는 같은 라벨의 칸이 요일마다 있다.
 */
function cellBlocks(doc: DocumentDraft): ProvenanceBlock[] {
  return doc.cells
    .filter((c) => (doc.cellProvenance[c.key] ?? []).length > 0)
    .map((c) => ({
      key: c.key,
      label: c.label || "(라벨 없음)",
      where: `표${c.table + 1} · ${c.row + 1}행 ${c.col + 1}열`,
      text: c.text,
      spans: doc.cellProvenance[c.key] ?? [],
      locked: c.source === "template",
    }));
}

/**
 * 하루 기록을 출처 카드로 옮긴다 — 기록 id가 열쇠다.
 *
 * 아이 이름을 앞머리에 함께 둔다. 일지는 반 전체 문서라 "8/3"만으로는 어느
 * 기록인지 알 수 없다 — 같은 날 기록이 반 인원만큼 있다.
 */
function recordCards(
  rows: DayRecord[],
  kids: Child[],
): Map<number, SourceRecordCard> {
  const nameOf = new Map(kids.map((k) => [k.id, k.name]));
  const map = new Map<number, SourceRecordCard>();
  rows.forEach((r) => {
    map.set(r.recordId, {
      lead: `${r.date.slice(5)} ${nameOf.get(r.childId) ?? ""}`.trim(),
      tags: r.activity ? [r.activity] : [],
      body: r.note || "관찰 메모 없음",
      href: `/records?child=${r.childId}&date=${r.date}`,
      hrefLabel: "하루 기록에서 보기",
    });
  });
  return map;
}
