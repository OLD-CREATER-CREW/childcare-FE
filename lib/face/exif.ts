/**
 * 사진 촬영일시 읽기 — EXIF DateTimeOriginal.
 *
 * ■ 왜 직접 파싱하나
 * 외부 EXIF 라이브러리를 하나 더 넣지 않기 위해서다. 우리가 필요한 건 태그 하나
 * (촬영일시)뿐이고, 그건 파일 앞부분 APP1 세그먼트만 읽으면 나온다.
 *
 * ■ 파일 전체를 읽지 않는다
 * EXIF 는 JPEG 맨 앞에 있다. 20MB 사진 100장을 통째로 메모리에 올리면 브라우저가
 * 죽으므로 앞 256KB 만 잘라서 본다(`file.slice`).
 *
 * ■ 못 읽는 경우가 흔하다
 * 카카오톡·메신저를 거친 사진은 EXIF 가 지워져 온다. PNG·HEIC 도 이 파서로는 못
 * 읽는다. 그때는 null 을 돌려주고, 날짜는 교사가 직접 지정한다 — 파일 수정시각으로
 * 추측하면 복사·편집 시점이 찍혀 엉뚱한 날짜가 되기 때문이다.
 *
 * 담당: 손승현(ml)
 */

/** 촬영일시 태그 (ExifIFD) */
const TAG_DATETIME_ORIGINAL = 0x9003;
/** 디지털화 일시 (ExifIFD) — 원본이 없을 때의 차선 */
const TAG_DATETIME_DIGITIZED = 0x9004;
/** 파일 변경일시 (IFD0) — 최후의 수단 */
const TAG_DATETIME = 0x0132;
/** ExifIFD 로 가는 포인터 (IFD0) */
const TAG_EXIF_IFD = 0x8769;

/** EXIF 헤더는 파일 앞쪽에 있다. 이만큼만 읽는다. */
const HEAD_BYTES = 256 * 1024;

type Entry = { type: number; count: number; valueAt: number };

function typeSize(type: number): number {
  switch (type) {
    case 1: // BYTE
    case 2: // ASCII
    case 6: // SBYTE
    case 7: // UNDEFINED
      return 1;
    case 3: // SHORT
    case 8: // SSHORT
      return 2;
    case 4: // LONG
    case 9: // SLONG
    case 11: // FLOAT
      return 4;
    case 5: // RATIONAL
    case 10: // SRATIONAL
    case 12: // DOUBLE
      return 8;
    default:
      return 0;
  }
}

function readAscii(view: DataView, at: number, len: number): string {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    if (at + i >= view.byteLength) break;
    const code = view.getUint8(at + i);
    if (code === 0) break; // ASCII 값은 NUL 로 끝난다
    out += String.fromCharCode(code);
  }
  return out;
}

/** IFD 하나를 훑어 태그 → 항목 맵을 채운다 */
function scanIfd(
  view: DataView,
  base: number,
  ifdOffset: number,
  little: boolean,
  out: Map<number, Entry>,
): void {
  const head = base + ifdOffset;
  if (head + 2 > view.byteLength) return;

  const count = view.getUint16(head, little);
  for (let i = 0; i < count; i += 1) {
    const at = head + 2 + i * 12;
    if (at + 12 > view.byteLength) return;

    const tag = view.getUint16(at, little);
    const type = view.getUint16(at + 2, little);
    const num = view.getUint32(at + 4, little);
    const bytes = typeSize(type) * num;
    // 값이 4바이트 이하면 항목 안에 직접 들어 있고, 넘으면 오프셋이 들어 있다
    const valueAt = bytes <= 4 ? at + 8 : base + view.getUint32(at + 8, little);
    out.set(tag, { type, count: num, valueAt });
  }
}

/** "2010:05:16 13:22:01" → "2010-05-16". 형식이 다르면 null */
function toIsoDate(raw: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  if (y === "0000" || mo === "00" || d === "00") return null;
  return `${y}-${mo}-${d}`;
}

function readDateTag(
  view: DataView,
  base: number,
  little: boolean,
  ifd: Map<number, Entry>,
  tag: number,
): string | null {
  const entry = ifd.get(tag);
  if (!entry || entry.type !== 2) return null;
  return toIsoDate(readAscii(view, entry.valueAt, Math.min(entry.count, 32)));
}

/** TIFF 헤더 위치를 받아 촬영일시를 찾는다 */
function parseTiff(view: DataView, base: number): string | null {
  if (base + 8 > view.byteLength) return null;

  const order = view.getUint16(base);
  if (order !== 0x4949 && order !== 0x4d4d) return null; // "II" | "MM"
  const little = order === 0x4949;
  if (view.getUint16(base + 2, little) !== 0x002a) return null;

  const ifd0 = new Map<number, Entry>();
  scanIfd(view, base, view.getUint32(base + 4, little), little, ifd0);

  // 촬영일시는 ExifIFD 안에 있다. IFD0 의 포인터를 따라간다.
  const pointer = ifd0.get(TAG_EXIF_IFD);
  if (pointer) {
    const sub = new Map<number, Entry>();
    scanIfd(view, base, view.getUint32(pointer.valueAt, little), little, sub);
    const shot =
      readDateTag(view, base, little, sub, TAG_DATETIME_ORIGINAL) ??
      readDateTag(view, base, little, sub, TAG_DATETIME_DIGITIZED);
    if (shot) return shot;
  }

  return readDateTag(view, base, little, ifd0, TAG_DATETIME);
}

/**
 * 사진의 촬영일자를 "YYYY-MM-DD" 로 돌려준다. 못 읽으면 null.
 *
 * null 이면 교사가 직접 지정해야 한다 — 파일 수정시각으로 추측하지 않는다.
 */
export async function readPhotoDate(file: File): Promise<string | null> {
  try {
    const head = await file.slice(0, HEAD_BYTES).arrayBuffer();
    const view = new DataView(head);
    if (view.byteLength < 4) return null;
    if (view.getUint16(0) !== 0xffd8) return null; // JPEG(SOI) 가 아니면 포기

    let at = 2;
    while (at + 4 <= view.byteLength) {
      if (view.getUint8(at) !== 0xff) {
        at += 1; // 마커 정렬이 어긋났다 — 한 바이트씩 밀며 다시 찾는다
        continue;
      }
      const marker = view.getUint8(at + 1);

      // 길이 필드가 없는 마커들
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        at += 2;
        continue;
      }
      // SOS 부터는 압축된 화소 데이터다. EXIF 는 그 앞에만 있다.
      if (marker === 0xda) break;

      const size = view.getUint16(at + 2);
      if (size < 2) break;

      const APP1 = 0xe1;
      if (marker === APP1 && readAscii(view, at + 4, 4) === "Exif") {
        // APP1: "Exif\0\0" 6바이트 뒤부터 TIFF 헤더
        return parseTiff(view, at + 10);
      }
      at += 2 + size;
    }
    return null;
  } catch {
    return null; // 읽기 실패는 "날짜 모름"으로 처리한다
  }
}

/** "2010-05-16" → "2010년 5월 16일" (화면 표시용) */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}
