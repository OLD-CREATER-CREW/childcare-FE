import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "어린이집 AI 행정비서 — 프로토타입",
  description: "기록은 한 번, 문서는 AI가",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard — CDN 실패(오프라인) 시 Apple SD Gothic Neo로 폴백 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="annot">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
