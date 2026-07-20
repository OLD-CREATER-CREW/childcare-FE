import type { Config } from "tailwindcss";

/** 디자인 토큰 — "교실의 종이와 잎" (와이어프레임 :root 이관) */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F7F8F4",
        surface: "#FFFFFF",
        ink: "#1F2A21",
        muted: "#68746C",
        faint: "#98A29B",
        line: { DEFAULT: "#E5E9E2", strong: "#CBD3CA" },
        green: {
          DEFAULT: "#2E7D52",
          deep: "#1F5C3C",
          soft: "#E8F3EC",
          ghost: "#F2F8F4",
        },
        amber: { DEFAULT: "#8A6410", bg: "#FFF6DA", line: "#EBD79A" },
        coral: { DEFAULT: "#BE4F3F", soft: "#FBECE9" },
        blue: { DEFAULT: "#3D6FA8", soft: "#EAF1F8" },
        confirm: { DEFAULT: "#1C7A43", soft: "#DFF2E6" },
      },
      /*
       * my-ui --radius-* 토큰 참조.
       * sm/md/lg는 기존 값(8/12/16px)과 토큰이 같아 치환만 했습니다.
       * xl/2xl은 Tailwind 기본값(12/16px)과 토큰(20/24px)이 달라 그대로 둡니다 —
       * .notice·.modal·.photo 등 기존 사용처의 모서리가 바뀌기 때문.
       */
      borderRadius: {
        "2xs": "var(--radius-2xs)",
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(33,43,34,.05), 0 4px 14px rgba(33,43,34,.06)",
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "Cascadia Code",
          "Consolas",
          "Menlo",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
