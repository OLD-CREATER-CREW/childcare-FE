/** 세션·기관 상수 — 실서비스에서는 로그인 세션에서 내려옵니다. */

export const TODAY = "2026-07-16";
export const TODAY_LABEL = "2026-07-16 (목)";
export const CLASS_NAME = "해님반";
export const TEACHER_NAME = "김하늘 선생님";

/**
 * 계정 입력 규칙 — 명세 EP-043·051이 정한 값이다. 로그인·가입·계정 생성·비밀번호
 * 재설정 네 화면이 같은 문구로 안내해야 하므로 한 곳에 둔다.
 *
 * 아이디에 대문자를 막는 이유는 `Kim01`과 `kim01`을 같은 계정으로 착각하는
 * 사고를 막기 위해서다(명세 EP-043).
 */
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
export const USERNAME_HINT = "영문 소문자·숫자 3~30자";
export const USERNAME_ERROR =
  "아이디는 영문 소문자·숫자·. _ - 로 3~30자입니다.";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HINT = "8자 이상";
export const PASSWORD_ERROR = "비밀번호는 8자 이상이어야 합니다.";

export const ACTIVITY_PRESETS = [
  "바깥놀이",
  "블록쌓기",
  "그림그리기",
  "역할놀이",
  "동화듣기",
  "노래·율동",
  "물놀이",
  "산책",
];
