/**
 * 내보내기 폴더에서 분류된 사진을 읽어 온다.
 *
 * ■ 왜 폴더인가
 * 사진함의 분류 결과는 화면 메모리에만 있어, 다른 화면으로 넘어가면 사라진다.
 * 반면 **내보내기(`ClassifyPanel.runExport`)가 만든 폴더는 남는다.** 그것이
 * 교사 단말에서 분류 결과가 실제로 사는 곳이므로, 놀이이야기는 거기서 읽는다.
 *
 * ■ 경로가 곧 메타데이터다
 *     가상아동_민준/2026-08-16/KakaoTalk_....jpg
 *              └ 아이      └ 촬영일
 * 내보내기가 `{아이 이름}/{촬영일}/{원본 파일명}` 으로 쓰기 때문에, 파일을
 * 열지 않고도 날짜와 아이를 안다. EXIF 가 지워진 사진(카카오톡 등)도 상관없다.
 *
 * ■ 생체정보 보호 (`ml/pipeline/INTERFACE.md` 1절)
 * 읽기만 한다. 사진은 교사가 고른 폴더에 그대로 있고, 서버로 보내지 않으며,
 * 브라우저 저장소에도 쓰지 않는다. 폴더 핸들조차 기억하지 않는다 — 볼 때마다
 * 교사가 폴더를 직접 고른다.
 */

/** 폴더에서 찾은 사진 한 장. */
export type FolderPhoto = {
  /** 폴더 안 상대 경로 — 같은 파일명이 여러 날짜에 있어도 겹치지 않는다 */
  id: string;
  name: string;
  /** 날짜 폴더의 바로 위 폴더 이름. 최상위에서 바로 날짜가 나오면 빈 문자열 */
  childName: string;
  /** "YYYY-MM-DD" */
  date: string;
  file: File;
  /** 썸네일용 objectURL — 다 쓰면 revokeFolderPhotos 로 반드시 해제한다 */
  url: string;
};

// File System Access API — Chromium(Electron 포함)에만 있다. 필요한 것만 좁게 선언한다.
type DirEntry =
  | { kind: "file"; name: string; getFile: () => Promise<File> }
  | { kind: "directory"; name: string; values: () => AsyncIterable<DirEntry> };
type PickerWindow = Window & {
  showDirectoryPicker?: (o?: { mode?: "read" | "readwrite" }) => Promise<{
    name: string;
    values: () => AsyncIterable<DirEntry>;
  }>;
};

const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;

/** 한 번에 읽을 사진 수 상한 — 썸네일 objectURL 이 그만큼 메모리를 잡는다. */
export const MAX_FOLDER_PHOTOS = 500;

export class FolderUnsupportedError extends Error {}
export class FolderCancelledError extends Error {}

/**
 * 폴더를 고르게 하고 그 안의 사진을 모두 읽는다.
 *
 * 경로에서 `YYYY-MM-DD` 폴더를 찾아 촬영일로 쓴다. 날짜 폴더 아래에 있지 않은
 * 사진은 **건너뛴다** — 놓을 날짜가 없으면 놀이이야기에서 쓸 수 없고, 파일
 * 수정시각으로 추측하면 복사·편집 시점이 찍혀 엉뚱한 날짜가 된다.
 *
 * 교사가 최상위(`.../아이이름/날짜/`)를 고르든 아이 폴더(`.../날짜/`)를 고르든
 * 똑같이 동작한다. 경로 어디에 있든 날짜 폴더를 찾기 때문이다.
 */
export async function pickPhotoFolder(): Promise<{
  photos: FolderPhoto[];
  folderName: string;
  hitLimit: boolean;
}> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new FolderUnsupportedError();

  let root: { name: string; values: () => AsyncIterable<DirEntry> };
  try {
    root = await picker({ mode: "read" });
  } catch {
    throw new FolderCancelledError();
  }

  const photos: FolderPhoto[] = [];
  let hitLimit = false;

  // 넓이 우선 — 깊은 폴더에서 스택이 위험하고, 중간에 상한을 걸어 빠져나오기 쉽다.
  //
  // 최상위는 `values`를 **화살표로 감싸 넘긴다.** `{ values: root.values }`처럼
  // 함수만 떼어 담으면 호출 시 `this`가 핸들에서 끊겨 브라우저가 "Illegal
  // invocation"으로 거부한다. 하위 폴더는 항목 객체를 통째로 넣으므로 문제없다.
  const queue: { dir: { values: () => AsyncIterable<DirEntry> }; path: string[] }[] = [
    { dir: { values: () => root.values() }, path: [] },
  ];

  while (queue.length > 0 && !hitLimit) {
    const { dir, path } = queue.shift()!;
    for await (const entry of dir.values()) {
      if (photos.length >= MAX_FOLDER_PHOTOS) {
        hitLimit = true;
        break;
      }
      if (entry.kind === "directory") {
        queue.push({ dir: entry, path: path.concat(entry.name) });
        continue;
      }

      // 경로 안에서 **가장 안쪽** 날짜 폴더를 촬영일로 본다.
      const dateAt = path.map((p) => DATE_DIR.test(p)).lastIndexOf(true);
      if (dateAt < 0) continue; // 날짜 폴더 밖의 사진은 놓을 자리가 없다

      const file = await entry.getFile();
      // 확장자가 아니라 MIME 으로 거른다 — 사진함의 업로드와 같은 기준이다.
      if (!file.type.startsWith("image/")) continue;

      photos.push({
        id: path.concat(entry.name).join("/"),
        name: entry.name,
        childName: dateAt > 0 ? path[dateAt - 1] : "",
        date: path[dateAt],
        file,
        url: URL.createObjectURL(file),
      });
    }
  }

  return { photos, folderName: root.name, hitLimit };
}

/** objectURL 을 해제한다. 폴더를 다시 고르거나 화면을 떠날 때 반드시 부른다. */
export function revokeFolderPhotos(photos: readonly FolderPhoto[]): void {
  photos.forEach((p) => URL.revokeObjectURL(p.url));
}

/** 날짜별로 묶는다. 날짜 오름차순, 같은 날은 읽은 순서 그대로. */
export function groupByDate(
  photos: readonly FolderPhoto[],
): { date: string; photos: FolderPhoto[] }[] {
  const map = new Map<string, FolderPhoto[]>();
  for (const p of photos) {
    const list = map.get(p.date);
    if (list) list.push(p);
    else map.set(p.date, [p]);
  }
  return Array.from(map, ([date, list]) => ({ date, photos: list })).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/**
 * 초안 본문에서 소주제 날짜를 뽑는다.
 *
 * 생성기가 `1. 내가 좋아하는 색으로 그려요 (8/16, 8/17, 8/19, 8/22)` 형태로
 * 쓰므로 괄호 안의 `월/일`을 모은다. 연도는 본문에 없어서 호출부가 준다
 * (놀이이야기는 한 달짜리 문서라 그 달의 연도를 쓰면 된다).
 *
 * 형식이 어긋나도 예외를 내지 않는다 — 못 찾으면 빈 집합이고, 화면은 그냥
 * "짝이 맞는 날짜 없음"으로 보인다. 초안 본문은 모델이 쓴 자연어라 언제든
 * 모양이 달라질 수 있고, 그때 화면이 깨지면 안 된다.
 */
export function draftDates(draft: string, year: number): Set<string> {
  const out = new Set<string>();
  const re = /(\d{1,2})\/(\d{1,2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(draft)) !== null) {
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;
    out.add(`${year}-${`${mm}`.padStart(2, "0")}-${`${dd}`.padStart(2, "0")}`);
  }
  return out;
}
