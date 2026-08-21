/**
 * 얼굴인식 API 호출 — `ml/pipeline/INTERFACE.md` v2.1
 *
 *   POST /api/face/enroll     등록 사진 N장 → 임베딩 1개
 *   POST /api/face/classify   사진 1장 + 갤러리 → 매칭 결과
 *   GET  /api/face/health     모델 로드 상태
 *
 * ■ 두 가지 접속 경로
 * 기본은 팀 백엔드와 같은 곳(`lib/api/client`의 api 래퍼)으로 보낸다.
 * 그러면 Bearer 토큰 부착·401 자동 갱신·에러 규약을 그대로 물려받는다.
 *
 * 다만 개발 중에는 얼굴인식 서버를 내 PC에서 따로 띄우는 경우가 있다
 * (`uvicorn ml.server.app:app --reload` → http://127.0.0.1:8000).
 * 그때는 `.env.local`에 아래를 넣으면 그쪽으로 직접 보낸다.
 *
 *   NEXT_PUBLIC_FACE_API_BASE_URL=http://127.0.0.1:8000
 *
 * 배포 시에는 이 값을 **비워둔다** — 그러면 팀 백엔드로 붙는다.
 *
 * 담당: 손승현(ml)
 */

import { ApiError, api } from "@/lib/api/client";

import type {
  ClassifyProgress,
  ClassifyResult,
  EnrollResult,
  FaceHealth,
  GalleryEntry,
  PhotoOutcome,
} from "./types";

/** 비어 있으면 팀 백엔드(api 래퍼)를 쓴다. 값이 있으면 그 주소로 직접 보낸다. */
const FACE_BASE = process.env.NEXT_PUBLIC_FACE_API_BASE_URL ?? "";

/** 서버 상한과 맞춘다(router.py MAX_ENROLL_FILES). 권장은 3~5장 */
export const MAX_ENROLL_FILES = 10;
/** 서버 기본값. 확정 전까지는 호출부에서 명시적으로 넘기는 편이 안전하다 */
export const DEFAULT_THRESHOLD = 0.35;

// ------------------------------------------------------------------
// 전송 계층
// ------------------------------------------------------------------

/**
 * 개발용 직접 호출. 인증 헤더를 붙이지 않는다 — 로컬 추론 서버는 인증이 없다.
 * 에러 형태는 api 래퍼와 맞춰 ApiError로 통일한다(호출부가 분기하지 않아도 되게).
 */
async function directPost<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${FACE_BASE}/api/face${path}`, {
      method: "POST",
      body: form, // Content-Type은 넣지 않는다 — boundary는 fetch가 만든다
    });
  } catch {
    throw new ApiError(
      0,
      "FACE_SERVER_UNREACHABLE",
      `얼굴인식 서버에 연결할 수 없습니다(${FACE_BASE}). 서버가 실행 중인지 확인하세요.`,
    );
  }
  if (!res.ok) {
    // FastAPI 기본 오류는 { detail: "..." } 형태라 api 래퍼 규약과 다르다.
    let message = `POST /api/face${path} → ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) message = body.detail;
    } catch {
      /* 본문이 JSON이 아니어도 기본 메시지로 둔다 */
    }
    throw new ApiError(res.status, "FACE_REQUEST_FAILED", message);
  }
  return res.json() as Promise<T>;
}

function postForm<T>(path: string, form: FormData): Promise<T> {
  return FACE_BASE
    ? directPost<T>(path, form)
    : api.postForm<T>(`/face${path}`, form);
}

// ------------------------------------------------------------------
// 이미지 축소 (업로드 절약)
// ------------------------------------------------------------------

/**
 * 장변을 maxSide 이하로 줄여 JPEG로 다시 인코딩한다.
 *
 * 검출기(det_10g)가 어차피 내부에서 640×640으로 줄이므로 1280~1600px면 충분하다.
 * 다만 **너무 줄이면 단체사진 뒤쪽의 작은 얼굴이 손해**를 본다. 실측에서 1600px는
 * 검출 수에 영향이 없었지만 유사도가 미세하게 낮아져, 임계값 경계에 있던 1건이
 * 뒤집힌 적이 있다. 정확도가 우선이면 maxSide를 0으로 두고 원본을 보낸다.
 */
export async function resizeImage(file: File, maxSide: number): Promise<File> {
  if (maxSide <= 0 || typeof document === "undefined") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // 디코드 실패 시 원본을 그대로 보낸다

  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= maxSide) {
    bitmap.close();
    return file;
  }

  const scale = maxSide / longest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.95),
  );
  if (!blob) return file;
  return new File([blob], file.name, { type: "image/jpeg" });
}

// ------------------------------------------------------------------
// 엔드포인트
// ------------------------------------------------------------------

export async function faceHealth(): Promise<FaceHealth> {
  if (!FACE_BASE) return api.get<FaceHealth>("/face/health");
  const res = await fetch(`${FACE_BASE}/api/face/health`);
  if (!res.ok) {
    throw new ApiError(res.status, "FACE_REQUEST_FAILED", "얼굴인식 서버 상태 확인 실패");
  }
  return res.json() as Promise<FaceHealth>;
}

/**
 * 아이 1명의 등록 사진 여러 장 → 대표 임베딩 1개.
 *
 * 서버는 저장하지 않는다. **반환된 embedding을 갤러리에 넣는 것은 호출부 책임**이다.
 * 사진마다 가장 큰 얼굴을 대상 아이로 간주하므로, 등록 사진에 여러 명이 있으면
 * 아이가 가장 크게 나온 사진을 골라야 한다.
 */
export async function enrollChild(
  files: File[],
  opts: { maxSide?: number } = {},
): Promise<EnrollResult> {
  if (files.length === 0) {
    throw new ApiError(422, "NO_FILES", "등록 사진을 1장 이상 선택하세요.");
  }
  if (files.length > MAX_ENROLL_FILES) {
    throw new ApiError(
      422,
      "TOO_MANY_FILES",
      `등록 사진은 최대 ${MAX_ENROLL_FILES}장입니다(권장 3~5장). 선택: ${files.length}장`,
    );
  }

  const form = new FormData();
  for (const f of files) {
    const sent = await resizeImage(f, opts.maxSide ?? 0);
    form.append("files", sent, f.name);
  }
  return postForm<EnrollResult>("/enroll", form);
}

/**
 * 사진 1장 + 같은 반 갤러리 → 매칭 결과.
 *
 * 갤러리는 **반 단위**로 보낸다. 원 전체를 넣으면 오배정이 급증한다
 * (실측: 15명 오배정 0% → 100명 1.46%).
 */
export async function classifyPhoto(
  file: File,
  gallery: GalleryEntry[],
  opts: { thresh?: number; maxSide?: number } = {},
): Promise<ClassifyResult> {
  if (gallery.length === 0) {
    throw new ApiError(422, "EMPTY_GALLERY", "등록된 아이가 없습니다. 먼저 아이를 등록하세요.");
  }

  const form = new FormData();
  const sent = await resizeImage(file, opts.maxSide ?? 0);
  form.append("file", sent, file.name);
  form.append("gallery", JSON.stringify(gallery));
  form.append("thresh", String(opts.thresh ?? DEFAULT_THRESHOLD));
  return postForm<ClassifyResult>("/classify", form);
}

/**
 * 여러 장을 순차 처리한다. 행사 사진 100장 같은 경우에 쓴다.
 *
 * 한 장씩 보내는 이유: 200장을 한 요청에 담으면 타임아웃에 걸리고, 중간에 실패하면
 * 전부 다시 해야 한다. 장 단위로 끊으면 **실패한 장만 재시도**하면 되고 진행률도 나온다.
 * 사진 1장당 약 1초(서버 CPU 추론 + 왕복)이므로 100장이면 100초 정도 걸린다.
 *
 * 개별 사진의 실패는 전체를 중단시키지 않는다. 결과의 `error`를 확인할 것.
 */
export async function classifyPhotos(
  files: File[],
  gallery: GalleryEntry[],
  opts: {
    thresh?: number;
    maxSide?: number;
    onProgress?: (p: ClassifyProgress) => void;
    /** 사용자가 취소했을 때 남은 사진 처리를 멈춘다 */
    signal?: AbortSignal;
  } = {},
): Promise<PhotoOutcome[]> {
  const outcomes: PhotoOutcome[] = [];
  let ok = 0;
  let failed = 0;

  for (const file of files) {
    if (opts.signal?.aborted) break;
    try {
      const result = await classifyPhoto(file, gallery, opts);
      outcomes.push({ file, result });
      ok += 1;
    } catch (e) {
      outcomes.push({ file, error: e instanceof Error ? e : new Error(String(e)) });
      failed += 1;
    }
    opts.onProgress?.({
      done: outcomes.length,
      total: files.length,
      current: file.name,
      ok,
      failed,
    });
  }
  return outcomes;
}
