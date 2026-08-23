/**
 * 분류 결과를 **한 세션 동안만** 화면 사이에서 나눠 쓰는 메모리 저장소.
 *
 * ■ 왜 필요한가
 * 사진함(SCR-005)의 분류 결과는 그 페이지의 `useState`에만 있어, 놀이이야기로
 * 이동하는 순간 사라진다. 그래서 "8/16에 분류해 둔 사진"을 놀이이야기 소주제
 * 옆에 놓아 줄 방법이 없었다. 이 모듈이 그 사이를 잇는다.
 *
 * ■ 무엇을 지키는가 (생체정보 보호 — `ml/pipeline/INTERFACE.md` 1절)
 * 규약이 금지하는 것은 **서버 보관**이다. 사진·임베딩은 교사 단말을 벗어나면
 * 안 된다. 이 저장소는 그 선을 넘지 않는다:
 *
 *   - 네트워크로 보내지 않는다. 여기에는 fetch가 없다.
 *   - localStorage·sessionStorage·IndexedDB에 쓰지 않는다. 평문으로 디스크에
 *     남기 때문이다(`gallery.ts`가 임베딩에 대해 세운 것과 같은 원칙).
 *   - 임베딩을 담지 않는다. 날짜로 짝을 맞추는 데 필요 없다.
 *   - 새로고침하면 사라진다. **그것이 의도한 수명이다.**
 *
 * ■ 한계 — 이건 최소 버전이다
 * 모듈 스코프 변수라 SPA 내부 이동에서만 살아남는다. 새로고침·앱 재시작이면
 * 비워진다. 영속이 필요하면 `electron/preload.js`에 `face` 채널을 붙여
 * 암호화 저장으로 가야 한다(`gallery.ts` 109행 참고) — 그건 별개 작업이다.
 *
 * ■ objectURL을 여기서 따로 만드는 이유
 * `ClassifyPanel`은 언마운트될 때 자기 URL을 전부 revoke한다. 그 URL을 빌려
 * 쓰면 사진함을 벗어난 순간 썸네일이 깨진다. 그래서 File 참조만 받아 이
 * 저장소가 자기 URL을 만들고, 자기가 지운다.
 */

import { useMemo, useSyncExternalStore } from "react";

/** 놀이이야기가 쓰는 최소 정보 — 임베딩·유사도는 담지 않는다. */
export type SessionShot = {
  id: string;
  /** 원본 파일. 브라우저가 디스크를 참조하므로 바이트를 통째로 들고 있지 않다 */
  file: File;
  /** 이 저장소가 만든 objectURL (ClassifyPanel 것과 별개) */
  url: string;
  /** 촬영일자 "YYYY-MM-DD". EXIF에서 못 읽고 교사도 안 정했으면 null */
  date: string | null;
  /** 배정된 아이 이름 — id가 아니라 이름으로 담는다(다른 화면이 명단을 다시 안 봐도 되게) */
  childNames: string[];
};

type Bucket = { className: string; shots: SessionShot[] };

let buckets: Bucket[] = [];
const listeners = new Set<() => void>();

/** useSyncExternalStore가 참조 동일성으로 렌더를 판단하므로 스냅샷을 캐시한다. */
let snapshot: readonly Bucket[] = buckets;

function emit(): void {
  snapshot = buckets;
  listeners.forEach((fn) => fn());
}

function revokeAll(shots: SessionShot[]): void {
  shots.forEach((s) => URL.revokeObjectURL(s.url));
}

/**
 * 한 반의 분류 결과를 갈아 끼운다. 같은 반의 이전 내용은 URL까지 정리한다.
 *
 * `date`가 없는 사진은 받지 않는다 — 날짜로 짝을 맞추는 것이 이 기능의 전부라,
 * 날짜 없는 사진은 놀이이야기에서 놓을 자리가 없다.
 */
export function publishSessionShots(
  className: string,
  input: { id: string; file: File; date: string | null; childNames: string[] }[],
): void {
  const dated = input.filter((s) => !!s.date);
  const next = dated.map((s) => ({
    id: s.id,
    file: s.file,
    url: URL.createObjectURL(s.file),
    date: s.date,
    childNames: s.childNames,
  }));

  const prev = buckets.find((b) => b.className === className);
  if (prev) revokeAll(prev.shots);

  const rest = buckets.filter((b) => b.className !== className);
  buckets = next.length > 0 ? rest.concat({ className, shots: next }) : rest;
  emit();
}

/** 전부 비운다 — 교사가 "이 세션 기록 지우기"를 눌렀을 때. */
export function clearSessionShots(): void {
  buckets.forEach((b) => revokeAll(b.shots));
  buckets = [];
  emit();
}

export function subscribeSessionShots(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSessionShotsSnapshot(): readonly Bucket[] {
  return snapshot;
}

/** 서버 렌더에는 아무것도 없다 — objectURL은 브라우저에만 있다. */
const EMPTY: readonly Bucket[] = [];
export function getSessionShotsServerSnapshot(): readonly Bucket[] {
  return EMPTY;
}

/**
 * 한 반의 세션 사진을 구독한다. 반을 안 고른 화면은 `null`을 넘기면 된다.
 *
 * 서버 렌더에서는 항상 빈 배열이라 hydration 불일치가 나지 않는다.
 */
export function useSessionShots(className: string | null): readonly SessionShot[] {
  const all = useSyncExternalStore(
    subscribeSessionShots,
    getSessionShotsSnapshot,
    getSessionShotsServerSnapshot,
  );
  return useMemo(() => {
    if (!className) return NO_SHOTS;
    return all.find((b) => b.className === className)?.shots ?? NO_SHOTS;
  }, [all, className]);
}

const NO_SHOTS: readonly SessionShot[] = [];

/** 한 반의 사진을 날짜별로 묶는다. 날짜 오름차순, 같은 날은 담긴 순서 그대로. */
export function groupByDate(
  shots: readonly SessionShot[],
): { date: string; shots: SessionShot[] }[] {
  const map = new Map<string, SessionShot[]>();
  for (const s of shots) {
    if (!s.date) continue;
    const list = map.get(s.date);
    if (list) list.push(s);
    else map.set(s.date, [s]);
  }
  return Array.from(map, ([date, list]) => ({ date, shots: list })).sort((a, b) =>
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
    out.add(
      `${year}-${`${mm}`.padStart(2, "0")}-${`${dd}`.padStart(2, "0")}`,
    );
  }
  return out;
}
