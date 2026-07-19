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
        paper: "#FAFAF7",
        surface: "#FFFFFF",
        ink: "#212B22",
        muted: "#6B7770",
        line: { DEFAULT: "#E4E8E1", strong: "#C9D1C9" },
        green: { DEFAULT: "#2E7D52", deep: "#215E3D", soft: "#E9F3ED" },
        amber: { DEFAULT: "#8A6410", bg: "#FFF6DA", line: "#EBD79A" },
        coral: { DEFAULT: "#BE4F3F", soft: "#FBECE9" },
        blue: { DEFAULT: "#3D6FA8", soft: "#EAF1F8" },
        confirm: { DEFAULT: "#1C7A43", soft: "#DFF2E6" },
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
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
