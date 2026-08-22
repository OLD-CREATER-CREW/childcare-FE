/**
 * 갤러리 암·복호화 — 백엔드 `ml/pipeline/crypto.py` 와 **같은 파일 포맷**.
 *
 * ■ 왜 Node 로 다시 구현했나
 * 교사 PC 에는 Python 이 없다. 얼굴인식 추론은 서버에서 돌고, 교사가 설치하는 것은
 * Electron 앱 하나뿐이다. `crypto.py` 를 쓰려면 Python 런타임을 번들해야 하는데,
 * AES-256-GCM 과 scrypt 는 Node 에 기본 내장이라 그럴 이유가 없다.
 *
 * **알고리즘을 새로 만든 것이 아니라 같은 규격을 다른 언어로 읽고 쓰는 것이다.**
 * 그래서 이 파일이 저장한 .enc 를 crypto.py 로 열 수 있고, 반대도 된다.
 *
 * ■ 파일 포맷 (crypto.py 와 1:1)
 *   일상 저장 : "CKGAL1" + 0x01           + nonce(12) + ciphertext(+tag)
 *   백업      : "CKGAL1" + 0x02 + salt(16) + nonce(12) + ciphertext(+tag)
 *   헤더는 AAD 로 묶는다 — 헤더를 건드리면 복호화가 실패한다.
 *
 *   평문 = JSON {
 *     version: 1, created_at: ISO8601, count: n,
 *     entries: [{ child_id, embedding(base64 float32 LE) }]
 *   }
 *
 * ■ AES-GCM 인 이유
 * 기밀성만이 아니라 **무결성**을 함께 보장한다. 임베딩이 조용히 변조되면 엉뚱한
 * 아이에게 사진이 배정되는 사고가 되므로, 복호화 시점에 변조를 잡아내야 한다.
 *
 * 담당: 손승현(ml) · 규약: `ml/pipeline/INTERFACE.md` 7절
 */

const crypto = require("node:crypto");

const MAGIC = Buffer.from("CKGAL1", "ascii"); // 참교육 GALlery v1
const MODE_KEY = 0x01; // 키체인 키로 잠근 일상 저장본
const MODE_PASSPHRASE = 0x02; // 교사 암호로 잠근 내보내기본

const KEY_BYTES = 32; // AES-256
const NONCE_BYTES = 12; // GCM 권장 길이
const SALT_BYTES = 16;

// scrypt 파라미터 — crypto.py 와 같은 값이어야 파일이 호환된다(약 32MB 메모리).
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

class GalleryDecryptError extends Error {}

// ------------------------------------------------------------------
// 키
// ------------------------------------------------------------------

function newKey() {
  return crypto.randomBytes(KEY_BYTES);
}

function keyToB64(key) {
  return key.toString("base64");
}

function keyFromB64(text) {
  const key = Buffer.from(text, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`키 길이가 ${key.length}바이트입니다. ${KEY_BYTES}이어야 합니다.`);
  }
  return key;
}

/** 암호 → 32바이트 키. 느린 것이 목적이다(대입 공격 방어) */
function deriveKey(passphrase, salt) {
  return crypto.scryptSync(Buffer.from(passphrase, "utf-8"), salt, KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
}

// ------------------------------------------------------------------
// 갤러리 <-> 평문 바이트
// ------------------------------------------------------------------

/** entries: [{ child_id, embedding(base64) }] → JSON 바이트 */
function entriesToBytes(entries) {
  const list = entries.map((e) => ({
    child_id: String(e.child_id),
    embedding: e.embedding,
  }));
  const payload = {
    version: 1,
    created_at: new Date().toISOString().replace(/\.\d+Z$/, "+00:00"),
    count: list.length,
    entries: list,
  };
  return Buffer.from(JSON.stringify(payload), "utf-8");
}

function bytesToEntries(raw) {
  const payload = JSON.parse(raw.toString("utf-8"));
  if (!payload || !Array.isArray(payload.entries)) {
    throw new GalleryDecryptError("갤러리 형식이 올바르지 않습니다.");
  }
  return payload.entries.map((e) => ({
    child_id: String(e.child_id),
    embedding: String(e.embedding),
  }));
}

// ------------------------------------------------------------------
// 저수준 암·복호화
// ------------------------------------------------------------------

/** header || nonce || ciphertext+tag. header 는 AAD 로 묶어 변조를 막는다 */
function seal(key, plaintext, header) {
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  // 파이썬 cryptography 는 태그를 암호문 뒤에 붙인다 — 같은 순서로 맞춘다
  return Buffer.concat([header, nonce, body, cipher.getAuthTag()]);
}

function open(key, blob, headerLen) {
  const header = blob.subarray(0, headerLen);
  const nonce = blob.subarray(headerLen, headerLen + NONCE_BYTES);
  const rest = blob.subarray(headerLen + NONCE_BYTES);
  if (rest.length < 16) throw new GalleryDecryptError("파일이 손상되었습니다.");

  const tag = rest.subarray(rest.length - 16);
  const body = rest.subarray(0, rest.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    // 키가 틀렸거나 파일이 변조된 경우 — 둘을 구분해 알려주지 않는다
    throw new GalleryDecryptError(
      "복호화에 실패했습니다. 키가 다르거나 파일이 손상되었습니다.",
    );
  }
}

function checkMagic(blob, expectedMode) {
  if (blob.length < MAGIC.length + 1 || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new GalleryDecryptError("갤러리 파일이 아닙니다.");
  }
  const mode = blob[MAGIC.length];
  if (mode !== expectedMode) {
    throw new GalleryDecryptError(
      mode === MODE_PASSPHRASE
        ? "이 파일은 백업본입니다. 암호를 입력해 불러오세요."
        : "이 파일은 이 PC 전용 저장본입니다. 다른 PC에서는 열 수 없습니다.",
    );
  }
}

// ------------------------------------------------------------------
// 공개 API
// ------------------------------------------------------------------

/** 일상 저장 — 키체인 키로 잠근다. 다른 PC 에서는 열리지 않는다(의도된 것) */
function encryptGallery(entries, key) {
  const header = Buffer.concat([MAGIC, Buffer.from([MODE_KEY])]);
  return seal(key, entriesToBytes(entries), header);
}

function decryptGallery(blob, key) {
  checkMagic(blob, MODE_KEY);
  return bytesToEntries(open(key, blob, MAGIC.length + 1));
}

/**
 * 내보내기 — 교사가 정한 암호로 잠근다.
 *
 * 일상 저장을 키체인 키로 잠그는 것은 맞지만 **그 키로 백업까지 잠그면 안 된다.**
 * 기기가 고장났을 때 백업도 함께 열리지 않아 백업의 존재 이유가 사라진다.
 */
function exportGallery(entries, passphrase) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const header = Buffer.concat([MAGIC, Buffer.from([MODE_PASSPHRASE]), salt]);
  return seal(deriveKey(passphrase, salt), entriesToBytes(entries), header);
}

function importGallery(blob, passphrase) {
  checkMagic(blob, MODE_PASSPHRASE);
  const headerLen = MAGIC.length + 1 + SALT_BYTES;
  if (blob.length < headerLen) throw new GalleryDecryptError("파일이 손상되었습니다.");
  const salt = blob.subarray(MAGIC.length + 1, headerLen);
  return bytesToEntries(open(deriveKey(passphrase, salt), blob, headerLen));
}

module.exports = {
  GalleryDecryptError,
  newKey,
  keyToB64,
  keyFromB64,
  encryptGallery,
  decryptGallery,
  exportGallery,
  importGallery,
};
