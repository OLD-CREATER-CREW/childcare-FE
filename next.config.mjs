/** @type {import('next').NextConfig} */
const nextConfig = {
  // Electron 패키징을 위해 정적 산출물(out/)로 내보냄 — dev 모드에는 영향 없음
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
