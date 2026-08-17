/** 세션·기관 상수 — 실서비스에서는 로그인 세션에서 내려옵니다. */

/**
 * 오늘 날짜. 화면 표시뿐 아니라 **문서 생성 요청의 date 파라미터**로도 쓰인다
 * (lib/api/index.ts). 그래서 고정값이면 시연 당일 "오늘 기록"이 비고 알림장·
 * 보육일지 생성이 404로 떨어진다 — 예전에 "2026-07-16"으로 박혀 있었다.
 *
 * 모듈 로드 시점에 한 번 계산한다. 자정을 넘겨 쓰는 화면이 아니고, 새로고침하면
 * 다시 잡힌다.
 */
function localToday(): Date {
  return new Date();
}

function formatISODate(d: Date): string {
  // toISOString()은 UTC로 바꿔 버려 한국 시간 오전 9시 이전에는 하루 전 날짜가
  // 나온다. 지역 시간 그대로 조립한다.
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

export const TODAY = formatISODate(localToday());
export const TODAY_LABEL = `${TODAY} (${WEEKDAY_KO[localToday().getDay()]})`;

/**
 * 계획안 생성에 쓰는 기간. 여기도 예전에는 "2026-07-13 ~ 2026-07-17"이 박혀
 * 있었고, 그 기간에 기록이 없으면 생성이 RECORD_NOT_FOUND로 떨어졌다.
 *
 * 주간은 이번 주 월~금, 월간은 이번 달 1일~말일이다.
 */
function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

const _today = localToday();
// getDay()는 일요일이 0이다. 월요일을 주의 시작으로 삼는다.
const _mondayOffset = (_today.getDay() + 6) % 7;
const _monday = addDays(_today, -_mondayOffset);

export const WEEK_FROM = formatISODate(_monday);
export const WEEK_TO = formatISODate(addDays(_monday, 4)); // 금요일

export const MONTH_FROM = formatISODate(
  new Date(_today.getFullYear(), _today.getMonth(), 1),
);
export const MONTH_TO = formatISODate(
  new Date(_today.getFullYear(), _today.getMonth() + 1, 0),
);

export const WEEK_LABEL = `${WEEK_FROM} ~ ${WEEK_TO.slice(5)}`;
export const MONTH_LABEL = `${MONTH_FROM.slice(0, 7)} 전체`;

/** 세션에서 이름을 못 받았을 때만 쓰는 대체값. */
export const CLASS_NAME = "우리 반";
export const TEACHER_NAME = "선생님";

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
