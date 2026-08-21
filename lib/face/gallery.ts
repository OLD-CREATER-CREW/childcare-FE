/**
 * 반 단위 갤러리 — 아이별 얼굴 임베딩 모음.
 *
 * ■ 이게 왜 클라이언트에 있나
 * 얼굴 임베딩은 개인정보보호법상 **민감정보(생체인식정보)** 다. 서버 DB에 보관하지
 * 않기로 해서, 임베딩이 영속적으로 남는 곳은 교사 단말뿐이다. 분류할 때마다
 * 이 갤러리를 요청에 실어 보낸다.
 *
 * ■ 반드시 지킬 것
 * - **localStorage·sessionStorage에 임베딩을 저장하지 않는다.** 평문으로 디스크에
 *   남고 어떤 스크립트든 읽을 수 있다. 민감정보 저장 요건을 못 맞춘다.
 * - 영속 저장은 Electron(OS 키체인 키 + AES-256-GCM)으로만 한다.
 *   규약은 `ml/pipeline/INTERFACE.md` 7절.
 * - 갤러리는 **반 단위**로 유지한다. 원 전체를 한 갤러리에 넣으면 오배정이 급증한다
 *   (실측: 15명 오배정 0% → 100명 1.46%).
 *
 * 담당: 손승현(ml)
 */

import type { EmbeddingB64, GalleryEntry } from "./types";

/** 반 하나의 갤러리. 순서는 의미 없고 child_id가 유일 키다. */
export class ClassGallery {
  private entries = new Map<string, EmbeddingB64>();

  constructor(initial: GalleryEntry[] = []) {
    for (const e of initial) this.entries.set(e.child_id, e.embedding);
  }

  get size(): number {
    return this.entries.size;
  }

  get childIds(): string[] {
    // Array.from을 쓰는 이유: tsconfig target이 낮아 Map 이터레이터 spread가 막혀 있다.
    return Array.from(this.entries.keys());
  }

  has(childId: string): boolean {
    return this.entries.has(childId);
  }

  /** 등록 결과를 반영한다. 이미 있으면 덮어쓴다(재등록). */
  set(childId: string, embedding: EmbeddingB64): void {
    this.entries.set(childId, embedding);
  }

  /**
   * 퇴소 등으로 아이의 임베딩을 파기한다.
   * 개인정보보호법상 즉시 파기 의무 — 저장소에도 반영해야 완료된다.
   */
  forget(childId: string): boolean {
    return this.entries.delete(childId);
  }

  /** 분류 요청에 실어 보낼 형태 */
  toEntries(): GalleryEntry[] {
    return Array.from(this.entries, ([child_id, embedding]) => ({ child_id, embedding }));
  }

  /** 요청당 전송량(바이트) 대략값 — 반 20명이면 약 55KB */
  get approxBytes(): number {
    return JSON.stringify(this.toEntries()).length;
  }
}

/**
 * 갤러리 영속 저장소.
 *
 * 구현체는 반 ID별로 암호화된 갤러리를 읽고 쓴다. 브라우저에는 안전한 구현이
 * 없으므로(위 "반드시 지킬 것" 참고), 데스크톱에서만 실제 저장이 가능하다.
 */
export interface GalleryStore {
  load(classId: string): Promise<GalleryEntry[] | null>;
  save(classId: string, entries: GalleryEntry[]): Promise<void>;
  remove(classId: string): Promise<void>;
  /** 이 저장소가 앱을 껐다 켜도 유지되는지 */
  readonly persistent: boolean;
}

/**
 * 메모리 저장소 — 새로고침하면 사라진다.
 *
 * 브라우저에서 화면을 만들거나 데스크톱 채널이 붙기 전에 쓰는 임시 구현이다.
 * 이 상태에서는 교사가 앱을 닫으면 갤러리가 날아가므로 **실사용에 쓰면 안 된다.**
 */
export class MemoryGalleryStore implements GalleryStore {
  readonly persistent = false;
  private data = new Map<string, GalleryEntry[]>();

  async load(classId: string) {
    return this.data.get(classId) ?? null;
  }
  async save(classId: string, entries: GalleryEntry[]) {
    this.data.set(classId, entries);
  }
  async remove(classId: string) {
    this.data.delete(classId);
  }
}

// ------------------------------------------------------------------
// 데스크톱(Electron) 저장소
// ------------------------------------------------------------------

/**
 * Electron preload가 노출해야 하는 채널.
 *
 * 현재 `electron/preload.js`에는 `templates` 채널만 있다. 아래 `face` 채널을
 * 추가해야 실제 암호화 저장이 동작한다. 암·복호화 자체는 파이썬
 * `ml/pipeline/crypto.py`(AES-256-GCM)가 맡고, 키는 `safeStorage`로
 * OS 키체인(Windows DPAPI / macOS Keychain)에 보관한다.
 *
 * 규약: `ml/pipeline/INTERFACE.md` 7-2절
 */
export type DesktopFaceBridge = {
  loadGallery: (classId: string) => Promise<GalleryEntry[] | null>;
  saveGallery: (classId: string, entries: GalleryEntry[]) => Promise<void>;
  removeGallery: (classId: string) => Promise<void>;
  /** 기기 교체·담임 인수인계용. 교사가 정한 암호로 잠근다 */
  exportGallery: (classId: string, passphrase: string) => Promise<void>;
  importGallery: (passphrase: string) => Promise<GalleryEntry[] | null>;
};

type DesktopWindow = Window & {
  desktop?: { isDesktop?: boolean; face?: DesktopFaceBridge };
};

/** Electron에서 실행 중이고 face 채널이 준비됐는지 */
export function hasDesktopFaceBridge(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as DesktopWindow).desktop?.face);
}

class DesktopGalleryStore implements GalleryStore {
  readonly persistent = true;
  constructor(private bridge: DesktopFaceBridge) {}

  load(classId: string) {
    return this.bridge.loadGallery(classId);
  }
  save(classId: string, entries: GalleryEntry[]) {
    return this.bridge.saveGallery(classId, entries);
  }
  remove(classId: string) {
    return this.bridge.removeGallery(classId);
  }
}

/**
 * 환경에 맞는 저장소를 고른다.
 *
 * 데스크톱이면 암호화 저장, 아니면 메모리(휘발). `store.persistent`가 false면
 * 화면에서 "이 환경에서는 갤러리가 저장되지 않는다"고 알려주는 것이 좋다 —
 * 모르고 등록했다가 새로고침 한 번에 반 전체를 다시 등록하게 된다.
 */
export function createGalleryStore(): GalleryStore {
  if (typeof window !== "undefined") {
    const bridge = (window as DesktopWindow).desktop?.face;
    if (bridge) return new DesktopGalleryStore(bridge);
  }
  return new MemoryGalleryStore();
}
