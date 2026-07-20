"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppProvider } from "@/lib/store";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

// dev의 StrictMode는 effect를 두 번 실행하는데, worker.start()를 두 번 호출하면
// MSW가 "cannot configure an already enabled network"로 던집니다.
// 모듈 스코프에 promise를 캐시해 실제 start는 한 번만 일어나게 합니다.
let mockStart: Promise<unknown> | null = null;
function startMocks() {
  mockStart ??= import("@/mocks/browser").then(({ worker }) =>
    worker.start({ onUnhandledRequest: "bypass" }),
  );
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
  useEffect(() => {
    if (!USE_MOCK) return;
    let cancelled = false;
    startMocks().then(() => {
      if (!cancelled) setMockReady(true);
    });
    return () => {
      cancelled = true;
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
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}
