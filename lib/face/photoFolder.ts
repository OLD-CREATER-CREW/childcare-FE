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
  /**
   * 이 사진에 담긴 아이 수. `countChildrenPerPhoto`가 채운다(기본 1).
   *
   * 사진함 내보내기가 **아이마다 폴더를 만들어 같은 파일을 복사**하므로
   * (`ClassifyPanel.runExport`), 같은 날짜의 같은 파일이 몇 개 아이 폴더에
   * 있는지를 세면 그것이 곧 그 사진에 몇 명이 나왔는지다. 얼굴을 다시 볼
   * 필요가 없다 — 분류할 때 이미 낸 답이 폴더 구조에 적혀 있다.
   */
  childCount: number;
};

// File System Access API — Chromium(Electron 포함)에만 있다. 필요한 것만 좁게 선언한다.
type DirEntry =
  | { kind: "file"; name: string; getFile: () => Promise<File> }
  | { kind: "directory"; name: string; values: () => AsyncIterable<DirEntry> };
type FileWriter = { write: (data: Blob) => Promise<void>; close: () => Promise<void> };
/**
 * 폴더 핸들. 하위 폴더도 같은 타입이라 재귀로 선언한다 — 내보내기가
 * `아이 이름/촬영일자/` 두 겹을 만들기 때문이다(`ClassifyPanel.runExport`).
 */
export type RootDirHandle = {
  name: string;
  values: () => AsyncIterable<DirEntry>;
  getDirectoryHandle: (
    name: string,
    o?: { create?: boolean },
  ) => Promise<RootDirHandle>;
  getFileHandle: (
    name: string,
    o?: { create?: boolean },
  ) => Promise<{ createWritable: () => Promise<FileWriter> }>;
  queryPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
};
type PickerWindow = Window & {
  showDirectoryPicker?: (o?: {
    mode?: "read" | "readwrite";
  }) => Promise<RootDirHandle>;
};

const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;

/** 내보내기가 배정 실패한 사진을 넣는 폴더 이름(`ClassifyPanel.runExport`). */
export const UNMATCHED_DIR = "미분류";

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
  root: RootDirHandle;
  photos: FolderPhoto[];
  folderName: string;
  hitLimit: boolean;
}> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new FolderUnsupportedError();

  // 읽기 권한만 요구한다. 추천 폴더를 만들 때 쓰기 권한을 따로 묻는다
  // (`saveRecommended`) — 둘러보기만 하는 교사에게 쓰기까지 허락받지 않는다.
  let root: RootDirHandle;
  try {
    root = await picker({ mode: "read" });
  } catch {
    throw new FolderCancelledError();
  }

  return { root, ...(await readDatedPhotos(root)) };
}

/**
 * **이미 고른 폴더**를 읽는다. 고르는 일과 읽는 일을 나눈 이유는, 사진 폴더를
 * 한 번 정해 두고 계속 쓰기 때문이다(`photoRoot`) — 볼 때마다 다시 고르게 하면
 * 그 설정이 아무 의미가 없다.
 *
 * 규칙은 `pickPhotoFolder`와 같다: 경로 안의 `YYYY-MM-DD` 폴더를 촬영일로 쓰고,
 * 날짜 폴더 밖의 사진은 건너뛴다.
 */
export async function readDatedPhotos(root: RootDirHandle): Promise<{
  photos: FolderPhoto[];
  folderName: string;
  hitLimit: boolean;
}> {
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
        childCount: 1,
      });
    }
  }

  countChildrenPerPhoto(photos);
  return { photos, folderName: root.name, hitLimit };
}

/**
 * 사진마다 **몇 명이 담겼는지**를 채운다(제자리 수정).
 *
 * 내보내기가 아이마다 폴더를 만들어 같은 파일을 복사하므로, `(날짜, 파일명,
 * 크기)`가 같은 것이 몇 개인지가 곧 인원수다. 파일명만으로 세지 않는 이유는
 * 카카오톡 사진처럼 이름이 겹치기 쉬워서다 — 크기까지 봐야 같은 사진이다.
 *
 * 「미분류」 폴더의 사진은 아무 아이에게도 배정되지 않은 것이라 세지 않는다.
 * 그것까지 세면 배정 안 된 사진이 인원 1명으로 보인다.
 */
export function countChildrenPerPhoto(photos: FolderPhoto[]): void {
  const groups = new Map<string, FolderPhoto[]>();
  for (const p of photos) {
    if (p.childName === UNMATCHED_DIR) continue;
    const key = `${p.date}|${p.name}|${p.file.size}`;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  // Map 순회는 이 tsconfig(target ES5 계열)에서 downlevelIteration이 필요하다.
  // 배열로 받아 돌면 설정을 건드리지 않아도 된다.
  groups.forEach((group) => {
    // 같은 아이 폴더에 같은 파일이 두 번 들어갈 일은 없지만, 있어도 한 명으로
    // 센다 — 인원수이지 파일 수가 아니다.
    const names = new Set(group.map((photo: FolderPhoto) => photo.childName));
    group.forEach((photo: FolderPhoto) => {
      photo.childCount = names.size;
    });
  });
}

/** 폴더를 그냥 훑어볼 때 쓰는 사진 한 장 — 날짜·아이를 요구하지 않는다. */
export type BrowsedPhoto = {
  /** 폴더 안 상대 경로. 같은 파일명이 여러 폴더에 있어도 겹치지 않는다 */
  id: string;
  name: string;
  /** 상위 폴더 경로("가상아동_민준/2026-08-16"). 최상위면 빈 문자열 */
  dir: string;
  file: File;
  url: string;
};

/**
 * 고른 폴더의 사진을 **구조를 따지지 않고** 전부 읽는다.
 *
 * `pickPhotoFolder` 와 다른 점은 하나다 — 저쪽은 `YYYY-MM-DD` 폴더 아래 있는
 * 사진만 거둬 온다(놀이이야기가 날짜로 짝을 맞춰야 해서). 이쪽은 그냥 보여
 * 주는 것이 목적이라 아무 폴더의 사진이든 다 가져온다.
 *
 * 읽기만 한다. 서버로 보내지도, 브라우저 저장소에 쓰지도 않는다.
 */
export async function browsePhotoFolder(): Promise<{
  photos: BrowsedPhoto[];
  folderName: string;
  hitLimit: boolean;
}> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new FolderUnsupportedError();

  let root: RootDirHandle;
  try {
    root = await picker({ mode: "read" });
  } catch {
    throw new FolderCancelledError();
  }

  return readAllPhotos(root);
}

/**
 * **이미 고른 폴더**의 사진을 구조를 따지지 않고 전부 읽는다.
 * `browsePhotoFolder`와 달리 폴더를 묻지 않는다 — 사진 폴더는 한 번 정해 두고
 * 계속 쓰기 때문이다(`photoRoot`).
 */
export async function readAllPhotos(root: RootDirHandle): Promise<{
  photos: BrowsedPhoto[];
  folderName: string;
  hitLimit: boolean;
}> {
  const photos: BrowsedPhoto[] = [];
  let hitLimit = false;

  // 최상위는 `values`를 화살표로 감싼다 — 함수만 떼어 담으면 `this`가 끊겨
  // "Illegal invocation"이 난다(`pickPhotoFolder` 와 같은 이유).
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
      const file = await entry.getFile();
      if (!file.type.startsWith("image/")) continue;
      photos.push({
        id: path.concat(entry.name).join("/"),
        name: entry.name,
        dir: path.join("/"),
        file,
        url: URL.createObjectURL(file),
      });
    }
  }

  return { photos, folderName: root.name, hitLimit };
}

/** `browsePhotoFolder` 가 만든 objectURL 을 해제한다. */
export function revokeBrowsedPhotos(photos: readonly BrowsedPhoto[]): void {
  photos.forEach((p) => URL.revokeObjectURL(p.url));
}

export class WritePermissionDeniedError extends Error {}

/** 파일 이름에 못 쓰는 문자를 걷어낸다(`ClassifyPanel`의 safeName 과 같은 규칙). */
const safeName = (s: string) =>
  s.replace(/[\\/:*?"<>|]/g, "_").trim() || "이름없음";

/** `~월 놀이이야기 사진 추천` — 달마다 폴더가 갈리도록 월을 앞에 둔다. */
export function recommendFolderName(month: number): string {
  return `${month}월 놀이이야기 사진 추천`;
}

/**
 * 고른 사진을 원본 폴더 **안에** 새 폴더를 만들어 모아 준다.
 *
 * ■ 왜 원본 폴더 안인가
 * 교사가 이미 그 폴더를 열어 뒀고 사진이 거기 있다. 다른 곳에 만들면 어디에
 * 저장됐는지 다시 찾아야 한다.
 *
 * ■ 파일 이름 앞에 날짜를 붙인다
 * 원본은 `{아이}/{날짜}/` 로 나뉘어 있어 같은 파일명이 여러 날짜에 있을 수
 * 있다(카카오톡 사진이 특히 그렇다). 한 폴더로 모으면 그대로 덮어써지므로
 * `2026-08-16_원본이름.jpg` 로 바꿔 넣는다 — 겹침도 막고 날짜도 남는다.
 *
 * ■ 쓰기 권한은 이때 묻는다
 * 폴더를 고를 때는 읽기만 요구했다. 실제로 쓰기 직전에 물어야 교사가 무엇에
 * 동의하는지 안다.
 */
export async function saveRecommended(
  root: RootDirHandle,
  photos: readonly FolderPhoto[],
  folderName: string,
): Promise<{ written: number; folder: string }> {
  if (photos.length === 0) return { written: 0, folder: folderName };

  // 이미 허용돼 있으면 다시 묻지 않는다.
  const state =
    (await root.queryPermission?.({ mode: "readwrite" })) ?? "prompt";
  if (state !== "granted") {
    const asked = await root.requestPermission?.({ mode: "readwrite" });
    if (asked !== "granted") throw new WritePermissionDeniedError();
  }

  const dir = await root.getDirectoryHandle(safeName(folderName), {
    create: true,
  });

  const used = new Set<string>();
  let written = 0;
  for (const p of photos) {
    let name = safeName(`${p.date}_${p.name}`);
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let i = 2;
      while (used.has(`${stem}_${i}${ext}`)) i += 1;
      name = `${stem}_${i}${ext}`;
    }
    used.add(name);

    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(p.file);
    await writable.close();
    written += 1;
  }

  return { written, folder: folderName };
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
