"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppProvider } from "@/lib/store";

/**
 * 목 사용 여부는 **명시적으로 켤 때만** 켠다.
 *
 * `!== "false"`로 두면 변수가 없을 때 목이 켜지는데, `output: "export"`라
 * `NEXT_PUBLIC_*`는 빌드 시점에 값이 박힌다. 즉 배포 빌드에서 이 변수를 깜빡하면
 * 산출물이 목을 물고 나가고, 목 로그인은 아무 아이디·비밀번호나 통과시키므로
 * 인증이 통째로 무력화된다(REQ-NF-011은 시연 첫날부터 토큰 인증을 요구한다).
 * 기본값은 안전측(실 서버)이어야 한다.
 */
const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" &&
  process.env.NEXT_PUBLIC_APP_ENV !== "production";

// dev의 StrictMode는 effect를 두 번 실행하는데, worker.start()를 두 번 호출하면
// MSW가 "cannot configure an already enabled network"로 던집니다.
// 모듈 스코프에 promise를 캐시해 실제 start는 한 번만 일어나게 합니다.
let mockStart: Promise<unknown> | null = null;
function startMocks() {
  mockStart ??= import("@/mocks/browser")
    .then(({ worker }) => worker.start({ onUnhandledRequest: "bypass" }))
    .then((reg) => {
      console.info("[MSW] worker started", reg);
      return reg;
    })
    .catch((e) => {
      console.error("[MSW] worker.start() 실패:", e);
      throw e;
    });
  return mockStart;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  // MSW 워커가 뜨기 전에 화면이 fetch를 날리면 목이 아닌 실요청이 나가므로,
  // 목 모드에서는 워커 준비 후에 렌더링합니다.
  const [mockReady, setMockReady] = useState(!USE_MOCK);
  const [mockFailed, setMockFailed] = useState(false);
  useEffect(() => {
    if (!USE_MOCK) return;
    let cancelled = false;
    // 안전장치: 8초 안에 준비 안 되면 흰 화면 무한 대기 대신 화면을 띄운다.
    const timeout = setTimeout(() => {
      if (cancelled) return;
      console.error("[MSW] 8초 내 준비되지 않음 — 준비 대기를 건너뜁니다");
      setMockFailed(true);
      setMockReady(true);
    }, 8000);
    startMocks()
      .then(() => {
        if (!cancelled) setMockReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setMockFailed(true);
          setMockReady(true);
        }
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  if (!mockReady) {
    return (
      <div className="grid min-h-screen place-items-center text-[13px] text-muted">
        목 서버 준비 중…
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {mockFailed && (
        <div
          role="alert"
          className="bg-amber px-4 py-2 text-center text-[12.5px] font-semibold text-white"
        >
          ⚠ 목 서버(MSW) 초기화에 실패했습니다 — 데이터가 정상 동작하지 않을 수
          있습니다. 개발자 도구 콘솔의 [MSW] 로그를 확인하세요.
        </div>
      )}
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}
