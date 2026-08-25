/**
 * .hwpx 서식 읽기·채우기 — 프론트에서 직접 한다.
 *
 * 흐름은 셋이다.
 *   1. `analyzeHwpx(bytes)` 교사가 올린 서식의 표를 읽어 **칸 목록**을 뽑는다.
 *   2. 그중 `fillable`인 칸만 모델이 채운다(내용은 목이 재생한다).
 *   3. `fillHwpx(bytes, 값)` 원본 서식에 그 값을 넣어 **.hwpx 그대로** 돌려준다.
 *
 * 칸 키는 백엔드와 같은 `t{표}r{행}c{열}`(0-based)이다. 같은 서식을 백엔드가
 * 분석한 결과(`8월 1주_생성_생성텍스트.json`)와 키·라벨·채울 칸 22개가 모두
 * 일치하는 것을 확인하고 규칙을 맞췄다 — 목에서만 통하는 키를 만들지 않기 위해서다.
 *
 * 표 구조를 화면에 그대로 그리지 않는 이유는 `DocumentCells`에 적어 두었다.
 */

import { readZip, writeZip, type ZipEntry } from "@/lib/hwpx/zip";

const HP = "http://www.hancom.co.kr/hwpml/2011/paragraph";
const SECTION_RE = /^Contents\/section\d+\.xml$/;

export type HwpxCell = {
  /** `t{표}r{행}c{열}` — 표·행·열 모두 0-based */
  key: string;
  table: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  /** `행 라벨 / 열 라벨` — 표의 머리 칸에서 뽑는다 */
  label: string;
  /** 서식에 이미 적혀 있던 글 */
  text: string;
  /** 이 칸을 모델이 채워야 하는가 — false면 서식에 인쇄된 정형 문구다 */
  fillable: boolean;
  /** 칸 크기로 어림한 글자 수 */
  budgetChars: number;
};

export type HwpxAnalysis = {
  tables: { index: number; rows: number; cols: number; nested: boolean }[];
  cells: HwpxCell[];
};

// ---------- XML 도우미 ----------

function childrenNS(el: Element, local: string): Element[] {
  return Array.from(el.children).filter(
    (c) => c.namespaceURI === HP && c.localName === local,
  );
}

function descendantsNS(el: Element | Document, local: string): Element[] {
  return Array.from(el.getElementsByTagNameNS(HP, local));
}

/** 한 칸의 글. 문단은 줄바꿈으로 잇는다(원본의 여러 줄 라벨을 살리기 위해). */
function cellText(tc: Element): string {
  return descendantsNS(tc, "p")
    .map((p) =>
      descendantsNS(p, "t")
        .map((t) => t.textContent ?? "")
        .join(""),
    )
    .join("\n")
    .trim();
}

/** 표 안에 또 표가 들어 있는 경우 바깥 표만 센다 — 중첩 표는 칸 좌표가 겹친다. */
function topLevelTables(doc: Document): Element[] {
  return descendantsNS(doc, "tbl").filter((tbl) => {
    for (let p = tbl.parentElement; p; p = p.parentElement) {
      if (p.namespaceURI === HP && p.localName === "tbl") return false;
    }
    return true;
  });
}

type RawCell = {
  el: Element;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  width: number;
  height: number;
  text: string;
};

function readCells(tbl: Element): RawCell[] {
  const cells: RawCell[] = [];
  for (const tr of childrenNS(tbl, "tr")) {
    for (const tc of childrenNS(tr, "tc")) {
      const addr = childrenNS(tc, "cellAddr")[0];
      const span = childrenNS(tc, "cellSpan")[0];
      const size = childrenNS(tc, "cellSz")[0];
      if (!addr) continue;
      cells.push({
        el: tc,
        row: Number(addr.getAttribute("rowAddr") ?? 0),
        col: Number(addr.getAttribute("colAddr") ?? 0),
        rowSpan: Number(span?.getAttribute("rowSpan") ?? 1),
        colSpan: Number(span?.getAttribute("colSpan") ?? 1),
        width: Number(size?.getAttribute("width") ?? 0),
        height: Number(size?.getAttribute("height") ?? 0),
        text: cellText(tc),
      });
    }
  }
  return cells;
}

/** 병합을 펼쳐 (행,열) → 그 자리를 덮고 있는 칸으로 만든다. 라벨을 찾는 데 쓴다. */
function spread(cells: RawCell[]): Map<string, RawCell> {
  const grid = new Map<string, RawCell>();
  for (const c of cells) {
    for (let r = c.row; r < c.row + c.rowSpan; r++)
      for (let x = c.col; x < c.col + c.colSpan; x++) {
        const k = `${r},${x}`;
        if (!grid.has(k)) grid.set(k, c);
      }
  }
  return grid;
}

/**
 * 머리 행 판정 — **그 행을 덮는 칸이 전부 짧은 글일 때** 머리 행으로 본다.
 *
 * 주간보육일지에는 머리 행이 둘이다. 요일 행(`03일 (월) … 07일 (금)`)과 아래쪽
 * `요일 | 놀이 평가 및 지원 계획` 행이다. 둘 다 짧은 글만 들어 있고, 내용 행은
 * 어느 칸이든 긴 문장이 하나는 있다. 그래서 길이 하나로 갈린다.
 *
 * 40자는 실물 서식에서 잰 값이다 — 가장 긴 머리 글이 24자, 가장 짧은 행 이름 칸이
 * 46자(`실내놀이/오전 (09:50 ~ 11:00)/오후 (15:20 ~ 16:30)`)라 그 사이에 둔다.
 */
const HEADER_TEXT_MAX = 40;

function headerRows(cells: RawCell[], grid: Map<string, RawCell>): number[] {
  const rows = Math.max(...cells.map((c) => c.row + c.rowSpan));
  const cols = Math.max(...cells.map((c) => c.col + c.colSpan));
  const out: number[] = [];
  for (let r = 0; r < rows; r++) {
    const covering: RawCell[] = [];
    for (let x = 0; x < cols; x++) {
      const c = grid.get(`${r},${x}`);
      if (c && !covering.includes(c)) covering.push(c);
    }
    if (covering.length < 2) continue;
    if (!covering.some((c) => c.text)) continue;
    if (covering.every((c) => c.text.length <= HEADER_TEXT_MAX)) out.push(r);
  }
  return out;
}

/**
 * 모델이 채울 칸인가.
 *
 * 라벨로 가른다 — 서식에 인쇄된 정형 문구(등원·간식·점심·낮잠·귀가)는 해마다
 * 그대로 나가는 글이라 모델이 손대면 안 되고, 교사가 매주 새로 쓰는 것은
 * 놀이·평가·특이사항 칸이다. 백엔드가 같은 서식에서 고른 22칸과 정확히 같다.
 *
 * 글이 없는 칸까지 무턱대고 채우지는 않는다(`text || 가장 넓은 칸`). 평가 행에는
 * 자리만 차지하는 빈 칸이 하나씩 있는데, 그 칸에 문장을 넣으면 완성 문서에서
 * 같은 글이 두 번 보인다.
 */
const FILLABLE_LABEL_RE = /실내놀이|바깥놀이|실내대체|평가|특이사항/;

/**
 * 칸이 감당하는 글자 수 어림 — 폭·높이를 글자 크기로 나눈다.
 *
 * 실서버는 칸의 글꼴 크기까지 보고 계산하므로 값이 정확히 같지는 않다. 목에서는
 * 「이 칸은 한 줄짜리」와 「이 칸은 문단짜리」를 가를 정도면 충분하다.
 */
const HWPUNIT_PER_CHAR = 560;
const HWPUNIT_PER_LINE = 1150;

function budgetFor(cell: RawCell): number {
  const perLine = Math.max(1, Math.floor(cell.width / HWPUNIT_PER_CHAR));
  const lines = Math.max(1, Math.floor(cell.height / HWPUNIT_PER_LINE));
  return perLine * lines;
}

// ---------- 분석 ----------

function parseSections(entries: ZipEntry[]): { entry: ZipEntry; doc: Document }[] {
  const decoder = new TextDecoder();
  const parser = new DOMParser();
  return entries
    .filter((e) => SECTION_RE.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      entry,
      doc: parser.parseFromString(decoder.decode(entry.data), "application/xml"),
    }));
}

/** 서식 파일의 표·칸을 읽는다. 표가 하나도 없으면 채울 수 없는 서식이다. */
export async function analyzeHwpx(buf: ArrayBuffer): Promise<HwpxAnalysis> {
  const sections = parseSections(await readZip(buf));
  if (!sections.length)
    throw new Error("hwpx 안에서 본문(section)을 찾지 못했습니다.");

  const tables: HwpxAnalysis["tables"] = [];
  const cells: HwpxCell[] = [];
  let tableIndex = 0;

  for (const { doc } of sections) {
    for (const tbl of topLevelTables(doc)) {
      const index = tableIndex++;
      const raw = readCells(tbl);
      if (!raw.length) continue;
      const grid = spread(raw);
      const headers = headerRows(raw, grid);
      const cols = Math.max(...raw.map((c) => c.col + c.colSpan));

      tables.push({
        index,
        rows: Number(tbl.getAttribute("rowCnt") ?? 0),
        cols: Number(tbl.getAttribute("colCnt") ?? 0),
        nested: descendantsNS(tbl, "tbl").length > 0,
      });

      for (const c of raw) {
        const rowHead = grid.get(`${c.row},0`);
        const rowLabel = rowHead && rowHead !== c ? rowHead.text : "";
        const header = [...headers].reverse().find((r) => r < c.row);
        const colHead = header != null ? grid.get(`${header},${c.col}`) : null;
        const colLabel = colHead && colHead !== c ? colHead.text : "";
        const label = [rowLabel, colLabel]
          .filter(Boolean)
          .map((s) => s.replace(/\n/g, " "))
          .join(" / ");

        // 같은 행에서 가장 넓은 칸 — 빈 칸 중에는 이것만 본문 칸으로 본다
        let widest: RawCell | null = null;
        for (let x = 0; x < cols; x++) {
          const cur = grid.get(`${c.row},${x}`);
          if (!cur) continue;
          if (!widest || cur.colSpan * cur.width > widest.colSpan * widest.width)
            widest = cur;
        }

        cells.push({
          key: `t${index}r${c.row}c${c.col}`,
          table: index,
          row: c.row,
          col: c.col,
          rowSpan: c.rowSpan,
          colSpan: c.colSpan,
          label,
          text: c.text,
          fillable:
            c.col > 0 &&
            FILLABLE_LABEL_RE.test(label) &&
            (c.text !== "" || c === widest),
          budgetChars: budgetFor(c),
        });
      }
    }
  }
  return { tables, cells };
}

// ---------- 채우기 ----------

/**
 * 칸 하나의 글을 바꾼다 — **첫 문단의 첫 글자 조각만 살리고** 나머지를 지운다.
 *
 * 글자 모양(글꼴·크기)은 `hp:run`의 `charPrIDRef`에 달려 있으므로, run을 새로
 * 만들지 않고 원래 있던 것을 그대로 쓴다. 그래야 채운 글이 서식의 글꼴로 나온다.
 * 줄바꿈은 문단을 복제해 만든다(hwpx는 문단이 곧 줄이다).
 */
function setCellText(tc: Element, text: string): void {
  const subList = childrenNS(tc, "subList")[0];
  if (!subList) return;
  const paras = childrenNS(subList, "p");
  if (!paras.length) return;

  const first = paras[0];
  let carrier = descendantsNS(first, "t")[0] ?? null;
  if (!carrier) {
    const run = descendantsNS(first, "run")[0];
    if (!run) return;
    carrier = run.ownerDocument.createElementNS(HP, "hp:t");
    run.appendChild(carrier);
  }
  // 첫 문단에 남은 다른 글자 조각은 지운다(이어 붙은 옛 글이 남지 않도록).
  descendantsNS(first, "t")
    .slice(1)
    .forEach((t) => t.parentNode?.removeChild(t));
  paras.slice(1).forEach((p) => subList.removeChild(p));

  const lines = text.split("\n");
  carrier.textContent = lines[0] ?? "";
  for (const line of lines.slice(1)) {
    const clone = first.cloneNode(true) as Element;
    const t = descendantsNS(clone, "t")[0];
    if (t) t.textContent = line;
    subList.appendChild(clone);
  }
}

/**
 * 서식에 값을 채워 .hwpx 바이트를 돌려준다.
 *
 * 원본 항목을 순서·압축 방식 그대로 두고 본문 XML만 갈아 끼운다 — 글꼴·표
 * 테두리·머리말은 손대지 않으므로 교사가 올린 서식 그대로 나온다.
 */
export async function fillHwpx(
  buf: ArrayBuffer,
  values: Record<string, string>,
): Promise<Uint8Array> {
  const entries = await readZip(buf);
  const sections = parseSections(entries);
  const serializer = new XMLSerializer();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let tableIndex = 0;

  for (const { entry, doc } of sections) {
    let touched = false;
    for (const tbl of topLevelTables(doc)) {
      const index = tableIndex++;
      for (const tr of childrenNS(tbl, "tr")) {
        for (const tc of childrenNS(tr, "tc")) {
          const addr = childrenNS(tc, "cellAddr")[0];
          if (!addr) continue;
          const key = `t${index}r${addr.getAttribute("rowAddr")}c${addr.getAttribute("colAddr")}`;
          if (!(key in values)) continue;
          setCellText(tc, values[key]);
          touched = true;
        }
      }
    }
    if (!touched) continue;
    /*
      XML 선언(`<?xml …?>`)은 DOM에 속하지 않아 브라우저 XMLSerializer는 빼고
      내보낸다. 한글은 선언이 없는 본문을 열지 못하므로 원본의 선언을 되살린다.
      내보낸 쪽에 이미 선언이 있으면(구현에 따라 다르다) 지우고 붙인다 —
      선언이 두 번 나오면 XML 자체가 깨진다.
    */
    const original = decoder.decode(entry.data);
    const declaration = original.startsWith("<?xml")
      ? `${original.slice(0, original.indexOf("?>") + 2)}\n`
      : "";
    const body = serializer
      .serializeToString(doc)
      .replace(/^\s*<\?xml[^?]*\?>\s*/, "");
    entry.data = encoder.encode(declaration + body);
  }

  return writeZip(entries);
}
