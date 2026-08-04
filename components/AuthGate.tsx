"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/lib/store";

/**
 * 인증 게이트 — (main) 셸을 감싼다.
 * 기동 시 저장된 리프레시 토큰으로 세션 복구(EP-050)를 시도하고, 그 판정이 끝나기
 * 전에는 화면을 잠시 잡아 둔다(명세 1.2.3 ③). 복구에 실패하면 /login으로 보낸다.
 * 화면 게이팅은 편의이고, 실제 판정은 서버가 401로 한다.
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
