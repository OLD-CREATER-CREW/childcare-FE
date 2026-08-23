/**
 * 반 단위 갤러리 상태 훅 — 등록 화면과 분류 화면이 함께 쓴다.
 *
 * ■ 왜 훅으로 빼는가
 * 갤러리는 화면 하나의 지역 상태가 아니다. 등록 화면에서 넣은 임베딩을 분류 화면이
 * 그대로 써야 하고, 검수(EP-018)에서 추가한 얼굴도 같은 갤러리에 들어간다.
 * 화면마다 `store.load()`를 따로 부르면 서로 다른 사본을 들고 어긋나므로,
 * 모듈 스코프에 반별로 하나씩만 두고 구독자에게 알린다(React Context 없이 동작하는
 * 작은 외부 스토어다 — Provider를 layout에 끼울 필요가 없다).
 *
 * ■ 저장은 즉시, 화면은 낙관적
 * `enroll()`·`forget()`은 메모리 갤러리를 먼저 바꾸고 화면에 반영한 뒤 저장소에 쓴다.
 * 저장이 실패하면 `error`로 알린다 — 조용히 넘기면 교사는 등록된 줄 알고 앱을 닫는다.
 *
 * 담당: 손승현(ml)
 */

"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { ClassGallery, createGalleryStore } from "./gallery";
import type { GalleryStore } from "./gallery";
import type { EmbeddingB64 } from "./types";

/**
 * 갤러리 파일을 가르는 키.
 *
 * ■ 기관(centerId)이 반드시 들어가야 한다
 * 반 이름만 쓰면 **다른 기관·다른 계정이라도 반 이름이 같으면 같은 파일**을 쓴다.
 * 데모 기관의 "햇님반"과 실제 기관의 "햇님반"이 한 파일에 섞여, 명단에 없는
 * 아이의 임베딩이 분류 결과에 튀어나온다(실제로 4명 반에 7개가 쌓였다).
 * 기관이 다른 얼굴 데이터가 한 파일에 모이는 것이라 정확도 문제이자 개인정보 문제다.
 *
 * ■ class_id 가 생기면
 * 서버 명단(EP-004)이 아직 `class_id`를 주지 않아 반 **이름**을 쓴다. 반 이름이
 * 바뀌면 갤러리가 새 파일로 갈라진다. `class_id`가 생기면 이 함수 하나만 고치면
 * 된다 — 호출부는 전부 이 키를 통해서만 저장소에 접근한다.
 */
export function galleryKey(centerId: number, className: string): string {
  return `center:${centerId}/cls:${className}`;
}

// ------------------------------------------------------------------
// 모듈 스코프 스토어 — 반 키 하나당 ClassGallery 하나
// ------------------------------------------------------------------

let storeSingleton: GalleryStore | null = null;

/** 브라우저에서 처음 필요할 때 만든다 — SSR 시점에 desktop 브리지를 못 보기 때문 */
function getStore(): GalleryStore {
  storeSingleton ??= createGalleryStore();
  return storeSingleton;
}

const galleries = new Map<string, ClassGallery>();
const subscribers = new Map<string, Set<() => void>>();

function notify(key: string): void {
  const set = subscribers.get(key);
  if (!set) return;
  set.forEach((fn) => fn());
}

/** 테스트·로그아웃용 — 메모리에 남은 임베딩을 비운다 */
export function resetGalleryCache(): void {
  galleries.clear();
}

export type UseGalleryResult = {
  /** 로딩이 끝나기 전에는 null */
  gallery: ClassGallery | null;
  /** 저장소에서 읽어오는 중 */
  loading: boolean;
  /** 저장소에 쓰는 중 */
  saving: boolean;
  /** 앱을 껐다 켜도 유지되는 저장소인가 (false면 휘발) */
  persistent: boolean;
  /** 등록된 아이 수 */
  size: number;
  /** 등록 여부 조회 — 렌더 중에 써도 된다 */
  isEnrolled: (childId: string) => boolean;
  /** 분류 요청에 실어 보낼 형태 */
  entries: () => ReturnType<ClassGallery["toEntries"]>;
  /** 등록·재등록. 저장까지 끝나면 resolve */
  enroll: (childId: string, embedding: EmbeddingB64) => Promise<void>;
  /** 퇴소 등으로 파기. 저장소에도 반영된다 */
  forget: (childId: string) => Promise<void>;
  /** 여러 명을 한 번에 파기하고 **한 번만** 저장한다(자동 파기용) */
  forgetMany: (childIds: string[]) => Promise<void>;
  /** 저장·로드 실패 메시지 */
  error: string | null;
};

/**
 * @param classKey `galleryKey(className)` 로 만든 키. null이면 아무것도 하지 않는다
 *                 (반이 아직 안 골라진 상태).
 */
export function useGallery(classKey: string | null): UseGalleryResult {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [loading, setLoading] = useState(classKey !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 저장소는 클라이언트에서만 만든다. persistent 값도 그때 확정된다.
  const [persistent, setPersistent] = useState(false);
  useEffect(() => {
    setPersistent(getStore().persistent);
  }, []);

  // 변경 알림 구독
  useEffect(() => {
    if (!classKey) return;
    let set = subscribers.get(classKey);
    if (!set) {
      set = new Set();
      subscribers.set(classKey, set);
    }
    set.add(rerender);
    return () => {
      set?.delete(rerender);
    };
  }, [classKey]);

  // 반이 바뀌면 로드 (이미 메모리에 있으면 다시 읽지 않는다)
  const loadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!classKey) {
      setLoading(false);
      return;
    }
    if (galleries.has(classKey)) {
      loadedRef.current = classKey;
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    getStore()
      .load(classKey)
      .then((entries) => {
        if (cancelled) return;
        galleries.set(classKey, new ClassGallery(entries ?? []));
        notify(classKey);
      })
      .catch(() => {
        if (cancelled) return;
        // 읽기에 실패해도 빈 갤러리로 화면은 살려 둔다. 다만 이 상태에서 저장하면
        // 기존 파일을 덮어쓸 수 있으므로 오류를 계속 띄운다.
        galleries.set(classKey, new ClassGallery());
        setError(
          "저장된 갤러리를 불러오지 못했습니다. 이 상태에서 등록하면 기존 갤러리를 덮어쓸 수 있습니다.",
        );
        notify(classKey);
      })
      .finally(() => {
        if (cancelled) return;
        loadedRef.current = classKey;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [classKey]);

  const persist = useCallback(
    async (mutate: (g: ClassGallery) => void) => {
      if (!classKey) return;
      const gallery = galleries.get(classKey) ?? new ClassGallery();
      mutate(gallery);
      galleries.set(classKey, gallery);
      notify(classKey);

      setSaving(true);
      try {
        await getStore().save(classKey, gallery.toEntries());
        setError(null);
      } catch {
        setError("갤러리를 저장하지 못했습니다. 등록 내용이 남지 않을 수 있습니다.");
      } finally {
        setSaving(false);
      }
    },
    [classKey],
  );

  const gallery = classKey ? (galleries.get(classKey) ?? null) : null;

  const isEnrolled = useCallback(
    (childId: string) => Boolean(classKey && galleries.get(classKey)?.has(childId)),
    [classKey],
  );

  const entries = useCallback(
    () => (classKey ? (galleries.get(classKey)?.toEntries() ?? []) : []),
    [classKey],
  );

  const enroll = useCallback(
    (childId: string, embedding: EmbeddingB64) =>
      persist((g) => g.set(childId, embedding)),
    [persist],
  );

  const forget = useCallback(
    (childId: string) => persist((g) => g.forget(childId)),
    [persist],
  );

  const forgetMany = useCallback(
    (childIds: string[]) =>
      persist((g) => {
        childIds.forEach((id) => g.forget(id));
      }),
    [persist],
  );

  return {
    gallery,
    loading,
    saving,
    persistent,
    size: gallery?.size ?? 0,
    isEnrolled,
    entries,
    enroll,
    forget,
    forgetMany,
    error,
  };
}
