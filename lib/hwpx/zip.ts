/**
 * 최소 ZIP 리더·라이터 — .hwpx를 브라우저에서 직접 열고 다시 묶기 위한 것.
 *
 * .hwpx는 XML 몇 개를 담은 ZIP이다. 서식을 읽어 칸을 찾고(`analyzeHwpx`), 칸을
 * 채워 파일로 돌려주려면(`fillHwpx`) 압축을 풀고 다시 묶어야 한다.
 *
 * **라이브러리를 넣지 않는다.** 브라우저(Electron/Chromium)에 이미 있는
 * `DecompressionStream`/`CompressionStream`의 `deflate-raw`가 ZIP이 쓰는 압축
 * 방식(method 8) 그대로라, 필요한 것은 헤더를 읽고 쓰는 100여 줄뿐이다.
 * jszip 같은 의존성을 목 하나 때문에 번들에 얹을 이유가 없다.
 *
 * 지원 범위는 딱 hwpx가 쓰는 만큼이다 — 무압축(0)·deflate(8), ZIP64 아님,
 * 암호화 없음. 그 밖의 파일을 만나면 조용히 넘기지 않고 던진다.
 */

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

export type ZipEntry = {
  name: string;
  data: Uint8Array;
  /** 0=무압축, 8=deflate. 원본 항목의 방식을 그대로 되돌려 쓴다. */
  method: 0 | 8;
};

/** 브라우저 내장 압축 스트림이 없으면 이 기능 전체가 성립하지 않는다. */
export function hasZipSupport(): boolean {
  return (
    typeof DecompressionStream !== "undefined" &&
    typeof CompressionStream !== "undefined"
  );
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** 끝에서부터 EOCD(중앙 디렉터리 끝) 서명을 찾는다. 주석은 최대 64KB다. */
function findEocd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let p = view.byteLength - 22; p >= min; p--) {
    if (view.getUint32(p, true) === SIG_EOCD) return p;
  }
  throw new Error("ZIP 형식이 아닙니다 — 파일 끝을 읽지 못했습니다.");
}

export async function readZip(buf: ArrayBuffer): Promise<ZipEntry[]> {
  if (!hasZipSupport())
    throw new Error("이 브라우저에서는 서식 파일을 열 수 없습니다.");
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const eocd = findEocd(view);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== SIG_CENTRAL)
      throw new Error("ZIP 중앙 디렉터리가 손상되었습니다.");
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    if (compressedSize === 0xffffffff)
      throw new Error(`ZIP64 서식은 지원하지 않습니다 (${name}).`);
    if (method !== 0 && method !== 8)
      throw new Error(`지원하지 않는 압축 방식입니다 (${name}).`);

    // 실제 데이터 위치는 지역 헤더의 이름·부가필드 길이를 더해야 나온다 —
    // 중앙 디렉터리의 길이와 다를 수 있어 지역 헤더를 다시 읽는다.
    if (view.getUint32(localOffset, true) !== SIG_LOCAL)
      throw new Error(`ZIP 지역 헤더가 손상되었습니다 (${name}).`);
    const dataStart =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    entries.push({
      name,
      method,
      data: method === 8 ? await inflateRaw(raw) : raw.slice(),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * 항목을 받은 순서대로 다시 묶는다.
 *
 * 순서와 압축 방식을 **원본 그대로** 유지하는 것이 중요하다. hwpx는 OCF 계열이라
 * `mimetype`이 맨 앞에 무압축으로 있어야 뷰어가 형식을 알아본다 — 읽은 순서를
 * 그대로 쓰면 저절로 지켜진다.
 */
export async function writeZip(entries: ZipEntry[]): Promise<Uint8Array> {
  if (!hasZipSupport())
    throw new Error("이 브라우저에서는 서식 파일을 만들 수 없습니다.");
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    // 이름에 ASCII 밖 글자가 있으면 UTF-8 플래그(비트 11)를 세워야 한다.
    const flags = name.some((b) => b > 0x7f) ? 0x800 : 0;
    const crc = crc32(entry.data);
    const body =
      entry.method === 8 ? await deflateRaw(entry.data) : entry.data;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, SIG_LOCAL, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, flags, true);
    lv.setUint16(8, entry.method, true);
    lv.setUint16(10, 0, true); // 시각·날짜는 0으로 둔다(원본 보존 대상이 아니다)
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, SIG_CENTRAL, true);
    cv.setUint16(4, 20, true); // 만든 버전
    cv.setUint16(6, 20, true); // 필요한 버전
    cv.setUint16(8, flags, true);
    cv.setUint16(10, entry.method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, body.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    parts.push(local, body);
    centrals.push(central);
    offset += local.length + body.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, SIG_EOCD, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = [...parts, ...centrals, eocd];
  const total = all.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of all) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
