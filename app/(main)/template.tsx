"use client";

import { motion } from "framer-motion";

/**
 * 화면 전환 — template은 라우트 이동마다 리마운트되므로
 * 페이지 콘텐츠가 미세하게 페이드업하며 들어옵니다.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
