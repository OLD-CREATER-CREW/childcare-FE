/**
 * 얼굴인식 연동 타입 — 서버 규약 `ml/pipeline/INTERFACE.md` v2.1 과 1:1 대응.
 *
 * 구조 요약: 얼굴 임베딩은 **서버 DB에 저장되지 않는다.** 서버는 추론만 하고
 * 응답 후 사진·임베딩을 폐기한다. 갤러리(아이별 임베딩)는 클라이언트가 보관하고
 * 분류 요청마다 함께 보낸다.
 *
 * 담당: 손승현(ml)
 */

/** 512차원 임베딩을 base64(float32, little-endian)로 직렬화한 문자열. 약 2.7KB */
export type EmbeddingB64 = string;

/** 얼굴 위치 [x1, y1, x2, y2] — 원본 사진 픽셀 좌표 */
export type BBox = [number, number, number, number];

/** 갤러리 항목 하나 = 아이 1명의 대표 임베딩 */
export type GalleryEntry = {
  child_id: string;
  embedding: EmbeddingB64;
};

// ---------- POST /api/face/enroll ----------

export type EnrollResult = {
  /** 로컬 갤러리에 보관할 값. status가 no_face면 null */
  embedding: EmbeddingB64 | null;
  /** 임베딩 추출에 성공한 사진 수 */
  used: number;
  /** 얼굴 미검출·디코드 실패로 건너뛴 사진 수 */
  skipped: number;
  status: "ok" | "no_face";
};

// ---------- POST /api/face/classify ----------

/** 갤러리에서 찾은 아이. 이 아이의 사진함에 해당 사진을 넣는다 */
export type MatchedFace = {
  child_id: string;
  /** 0~1 코사인 유사도 */
  similarity: number;
  bbox: BBox;
};

/**
 * 갤러리에 없는 얼굴(다른 반 아이·교사·학부모).
 * `embedding`이 함께 오므로, 교사가 "이 얼굴은 OO"라고 지정하면
 * **서버 왕복 없이** 로컬 갤러리에 바로 반영할 수 있다(점진적 등록, EP-018).
 */
export type UnmatchedFace = {
  bbox: BBox;
  /** 갤러리 중 가장 높았던 점수. 임계값 조정 판단에 쓴다 */
  best_similarity: number;
  embedding: EmbeddingB64;
};

export type ClassifyResult = {
  /** "사진 1장 = 여러 아이" — 인식된 모든 아이가 들어온다 */
  matched: MatchedFace[];
  unmatched: UnmatchedFace[];
  unmatched_faces: number;
  /** matched.length + unmatched.length */
  faces_detected: number;
  status: "classified" | "unmatched" | "no_face" | "bad_image";
};

// ---------- GET /api/face/health ----------

export type FaceHealth = {
  ok: boolean;
  model: string;
  embedding_dim: number;
  stateless: boolean;
};

// ---------- 여러 장 처리 ----------

/** 사진 1장의 처리 결과. 실패해도 나머지는 계속 진행된다 */
export type PhotoOutcome = {
  file: File;
  result?: ClassifyResult;
  error?: Error;
};

export type ClassifyProgress = {
  /** 처리 완료 수(성공+실패) */
  done: number;
  total: number;
  /** 방금 처리한 파일명 */
  current: string;
  ok: number;
  failed: number;
};
