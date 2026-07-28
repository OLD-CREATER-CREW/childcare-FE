"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/lib/store";

/**
 * 인증 게이트 — (main) 셸을 감싼다.
 * 로그인 세션이 없으면 /login으로 돌려보내고, 하이드레이션 전에는 판단을 미룬다.
 * 실서비스에서는 서버가 세션 쿠키로 가드하지만, 목 데모에서는 클라이언트 상태로 게이팅한다.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { auth, authReady } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (authReady && !auth) router.replace("/login");
  }, [authReady, auth, router]);

  // 세션 확인 전 — 깜빡임 방지용 대기 화면
  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center text-[13px] text-muted">
        세션 확인 중…
      </div>
    );
  }

  // 미로그인 — 리다이렉트가 실행되는 동안 화면을 비운다
  if (!auth) return null;

  return <>{children}</>;
}
