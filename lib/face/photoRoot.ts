"use client";

/**
 * 사진 폴더 — **한 번 정하면 앱이 기억한다.**
 *
 * ■ 왜 필요한가
 * 예전에는 사진을 만질 때마다 폴더를 다시 골랐다. 「사진 분류 › 폴더에서
 * 가져오기」, 「폴더 보기 › 폴더 고르기」, 「놀이이야기 › 사진 폴더 지정」,
 * 그리고 분류 결과를 내보낼 때 한 번 더 — 같은 폴더를 네 군데서 따로 물었다.
 * 교사의 사진은 늘 같은 자리에 있으므로 앱이 기억하면 될 일이다.
 *
 * ■ 무엇을 저장하나 — 경로 문자열이 아니라 **폴더 핸들**
 * 브라우저(Electron 포함)는 경로 문자열만으로 폴더를 열지 못한다. 파일 시스템
 * 접근 권한은 `showDirectoryPicker`가 돌려준 **핸들**에 붙어 있고, 그 핸들은
 * IndexedDB에 그대로 저장했다가 다음에 꺼내 쓸 수 있다(구조화 복제). 그래서
 * 핸들을 저장하고, 경로 문자열은 **화면에 보여 주기 위해서만** 따로 둔다.
 *
 * ■ 권한은 끊길 수 있다
 * 핸들을 꺼내 와도 권한이 `prompt`로 돌아가 있을 수 있다. 그때는 조용히
 * 실패하지 않고 `needsPermission`으로 알린다 — 화면이 「폴더 다시 연결」
 * 버튼을 띄우고, 교사가 누르는 그 순간(사용자 몸짓)에 권한을 다시 청한다.
 * 브라우저는 몸짓 없이 오는 권한 요청을 거부하므로 자동 재요청은 할 수 없다.
 *
 * ■ 사진은 이 PC를 벗어나지 않는다
 * 여기서 하는 일은 폴더를 가리키는 손가락 하나를 기억하는 것뿐이다. 사진도,
 * 경로도 서버로 보내지 않는다(`ml/pipeline/INTERFACE.md` 1절).
 */

import { useCallback, useEffect, useState } from "react";
import type { RootDirHandle } from "./photoFolder";
import { FolderCancelledError, FolderUnsupportedError } from "./photoFolder";

const DB_NAME = "childcare-desktop";
const DB_VERSION = 1;
const STORE = "handles";
/** 사진 폴더는 앱에 하나뿐이다 — 반이나 기관마다 나누지 않는다. */
const KEY = "photoRoot";

type Saved = { handle: RootDirHandle; label: string };

type PickerWindow = Window & {
  showDirectoryPicker?: (o?: {
    mode?: "read" | "readwrite";
  }) => Promise<RootDirHandle>;
};

/** Electron preload가 노출하는 통로. 웹(개발) 모드에는 없다. */
type DesktopWindow = Window & {
  desktop?: { isDesktop?: boolean; photos?: { pathForFile?: (f: File) => string } };
};

// ------------------------------------------------------------------
// IndexedDB — 핸들 한 개를 넣고 빼는 데만 쓴다
// ------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(): Promise<Saved | null> {
  return openDb().then(
    (db) =>
      new Promise<Saved | null>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve((req.result as Saved) ?? null);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

function idbPut(value: Saved): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbDelete(): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      }),
  );
}

// ------------------------------------------------------------------
// 화면에 보여 줄 경로
// ------------------------------------------------------------------

/**
 * 폴더의 절대 경로를 알아낸다. 못 알아내면 폴더 이름을 쓴다.
 *
 * 파일 시스템 접근 API는 경로를 알려 주지 않는다 — 웹 표준이라 일부러 감춘다.
 * 하지만 우리는 Electron 안이고, `webUtils.getPathForFile`이 File 하나의 절대
 * 경로를 준다(preload가 `desktop.photos.pathForFile`로 노출한다).
 *
 * 그래서 폴더 안에서 파일 하나를 찾아 그 절대 경로를 얻고, **루트에서 그
 * 파일까지의 상대 경로 길이만큼 뒤에서 잘라** 폴더의 절대 경로를 만든다.
 * 파일이 하나도 없으면 잘라 낼 기준이 없으므로 폴더 이름으로 물러선다.
 *
 * 실패해도 예외를 내지 않는다. 경로 표시는 편의이지 기능이 아니다.
 */
async function resolveLabel(root: RootDirHandle): Promise<string> {
  const bridge =
    typeof window === "undefined"
      ? undefined
      : (window as DesktopWindow).desktop?.photos?.pathForFile;
  if (!bridge) return root.name;

  try {
    // 첫 파일 하나만 찾으면 된다. 깊이 우선으로 들어가되 너무 깊이 파지 않는다 —
    // 파일이 없는 폴더에서 헛되이 전체를 훑지 않기 위해서다.
    const found = await findFirstFile(root, [], 0);
    if (!found) return root.name;

    const abs = bridge(found.file);
    if (!abs) return root.name;

    const parts = abs.split(/[\\/]/);
    const cut = parts.length - found.path.length;
    if (cut <= 0) return root.name;
    const sep = abs.includes("\\") ? "\\" : "/";
    return parts.slice(0, cut).join(sep) || root.name;
  } catch {
    return root.name;
  }
}

const MAX_PROBE_DEPTH = 4;

async function findFirstFile(
  dir: RootDirHandle | { values: () => AsyncIterable<unknown> },
  path: string[],
  depth: number,
): Promise<{ file: File; path: string[] } | null> {
  if (depth > MAX_PROBE_DEPTH) return null;
  const subdirs: { entry: RootDirHandle; name: string }[] = [];

  for await (const raw of (dir as RootDirHandle).values()) {
    const entry = raw as unknown as {
      kind: "file" | "directory";
      name: string;
      getFile?: () => Promise<File>;
    };
    if (entry.kind === "file" && entry.getFile) {
      return { file: await entry.getFile(), path: path.concat(entry.name) };
    }
    if (entry.kind === "directory") {
      subdirs.push({ entry: raw as unknown as RootDirHandle, name: entry.name });
    }
  }

  for (const sub of subdirs) {
    const hit = await findFirstFile(sub.entry, path.concat(sub.name), depth + 1);
    if (hit) return hit;
  }
  return null;
}

// ------------------------------------------------------------------
// 공개 API
// ------------------------------------------------------------------

export function canPickFolder(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as PickerWindow).showDirectoryPicker === "function"
  );
}

/** 저장해 둔 폴더를 꺼내 온다. 없으면 null, 권한이 끊겼으면 `granted: false`. */
export async function loadPhotoRoot(): Promise<
  { handle: RootDirHandle; label: string; granted: boolean } | null
> {
  let saved: Saved | null = null;
  try {
    saved = await idbGet();
  } catch {
    return null; // 시크릿 창 등 IndexedDB를 못 쓰는 환경 — 없는 것으로 본다
  }
  if (!saved?.handle) return null;

  let granted = true;
  try {
    const state = await saved.handle.queryPermission?.({ mode: "readwrite" });
    granted = state === undefined || state === "granted";
  } catch {
    granted = false;
  }
  return { handle: saved.handle, label: saved.label || saved.handle.name, granted };
}

/**
 * 폴더를 고르게 하고 기억한다.
 *
 * `readwrite`로 묻는 이유: 이 폴더는 보기만 하는 곳이 아니라 **분류한 사진을
 * 내보내 넣는 곳**이기도 하다(`ClassifyPanel.runExport`). 내보낼 때 권한을 또
 * 묻지 않으려면 정할 때 한 번에 받아 둬야 한다.
 */
export async function choosePhotoRoot(): Promise<{
  handle: RootDirHandle;
  label: string;
}> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new FolderUnsupportedError();

  let handle: RootDirHandle;
  try {
    handle = await picker({ mode: "readwrite" });
  } catch {
    throw new FolderCancelledError();
  }

  const label = await resolveLabel(handle);
  try {
    await idbPut({ handle, label });
  } catch {
    // 저장에 실패해도 이번 세션에서는 쓸 수 있다. 기억만 못 할 뿐이다.
  }
  return { handle, label };
}

/** 끊긴 권한을 다시 청한다. **반드시 사용자 몸짓 안에서** 부를 것. */
export async function reconnectPhotoRoot(
  handle: RootDirHandle,
): Promise<boolean> {
  try {
    const state = await handle.requestPermission?.({ mode: "readwrite" });
    return state === undefined || state === "granted";
  } catch {
    return false;
  }
}

export async function forgetPhotoRoot(): Promise<void> {
  try {
    await idbDelete();
  } catch {
    // 지우지 못해도 화면에서는 없는 것으로 다룬다
  }
}

// ------------------------------------------------------------------
// 훅
// ------------------------------------------------------------------

export type PhotoRootState = {
  /** 정해진 폴더. 아직 안 정했거나 권한이 끊겼으면 null이 아니라 handle이 있고 ready가 false다 */
  handle: RootDirHandle | null;
  /** 화면에 보여 줄 경로(가능하면 절대 경로, 아니면 폴더 이름) */
  label: string | null;
  /** 지금 바로 읽고 쓸 수 있는가 — 이 값이 true일 때만 폴더를 만진다 */
  ready: boolean;
  /** 저장된 폴더는 있는데 권한이 끊긴 상태 — 「폴더 다시 연결」을 띄운다 */
  needsPermission: boolean;
  loading: boolean;
  /** 이 환경에서 폴더 고르기를 지원하는가(웹 브라우저 일부는 못 한다) */
  supported: boolean;
  choose: () => Promise<boolean>;
  reconnect: () => Promise<boolean>;
  forget: () => Promise<void>;
};

/**
 * 사진 폴더 상태를 화면에 물려준다.
 *
 * 여러 화면(사진함·놀이이야기)이 같은 폴더를 쓰지만 훅은 화면마다 따로 돈다 —
 * IndexedDB가 단일 출처라 값이 어긋나지 않고, 폴더를 바꾸면 다음에 그 화면을
 * 열 때 새 값을 읽는다. 전역 상태를 하나 더 만들 만한 일이 아니다.
 */
export function usePhotoRoot(): PhotoRootState {
  const [handle, setHandle] = useState<RootDirHandle | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadPhotoRoot()
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          setHandle(saved.handle);
          setLabel(saved.label);
          setGranted(saved.granted);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback(async () => {
    const picked = await choosePhotoRoot();
    setHandle(picked.handle);
    setLabel(picked.label);
    setGranted(true);
    return true;
  }, []);

  const reconnect = useCallback(async () => {
    if (!handle) return false;
    const ok = await reconnectPhotoRoot(handle);
    setGranted(ok);
    return ok;
  }, [handle]);

  const forget = useCallback(async () => {
    await forgetPhotoRoot();
    setHandle(null);
    setLabel(null);
    setGranted(false);
  }, []);

  return {
    handle,
    label,
    ready: Boolean(handle) && granted,
    needsPermission: Boolean(handle) && !granted,
    loading,
    supported: canPickFolder(),
    choose,
    reconnect,
    forget,
  };
}
