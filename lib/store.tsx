"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearSession, onSessionExpired, restoreSession } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

/** 리프레시 토큰이 담긴 localStorage 키 — 탭 간 로그아웃 전파에만 쓴다 */
const REFRESH_KEY = "childcare.refresh_token";

/** 클라이언트 UI 전역 상태 — 토스트 · 재생 모드 · 명세 주석 + 로그인 세션
 * (서버 데이터는 TanStack Query, 인증 토큰은 lib/api/client.ts의 tokenStore) */

type AppContextValue = {
  replay: boolean;
  setReplay: (v: boolean) => void;
  annot: boolean;
  setAnnot: (v: boolean) => void;
  toast: (msg: string) => void;
  toastMsg: string;
  toastShow: boolean;
  /** 로그인한 사용자 — null이면 미로그인 */
  auth: AuthUser | null;
  /** 기동 시 세션 복구(EP-050) 완료 여부 — 이전엔 게이트가 판단을 미룬다 */
  authReady: boolean;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [replay, setReplay] = useState(false);
  const [annot, setAnnot] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // 로그인 세션 — 액세스 토큰은 메모리에만 있으므로(명세 1.2.3 ②) 새로고침하면
  // 매번 사라진다. 저장된 리프레시 토큰으로 EP-050을 한 번 부르는 것이 정상 기동
  // 순서다(명세 1.2.3 ③) — 앱을 켤 때마다 로그인 화면부터 띄우지 않는다.
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    let alive = true;
    restoreSession()
      .then((user) => {
        // 복구가 느린 사이 사용자가 직접 로그인했을 수 있다. 그때 늦게 도착한
        // 결과로 덮으면 방금 성공한 로그인이 취소되고 로그인 화면으로 되돌아간다.
        if (alive) setAuth((prev) => prev ?? user);
      })
      .finally(() => {
        if (alive) setAuthReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 갱신까지 실패해 되살릴 수 없는 401 — 어느 화면에서 났든 세션을 비운다.
  // 리다이렉트는 AuthGate가 맡는다.
  useEffect(() => {
    onSessionExpired(() => {
      setAuth(null);
      // 만료 후 로그인 화면에서 대기하는 동안 아동 이름·특이사항이 메모리 캐시에
      // 남아 있을 이유가 없다. 다음 사용자가 다른 사람일 수도 있다.
      queryClient.clear();
    });
    return () => onSessionExpired(null);
  }, [queryClient]);

  // 다른 탭에서 로그아웃하면 이 탭도 함께 끊는다. localStorage의 리프레시 토큰만
  // 지워질 뿐 이 탭의 메모리 액세스 토큰과 화면 상태는 그대로라, 놔두면 최대
  // 15분간 이전 사용자의 이름·아동 명단이 계속 보인다(공용 태블릿에서 실제로 난다).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === REFRESH_KEY && !e.newValue) {
        clearSession();
        setAuth(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 토큰 자체는 API 계층이 이미 보관했다 — 여기서는 화면 상태만 든다.
  const signIn = useCallback((user: AuthUser) => setAuth(user), []);

  // EP-002가 실패했더라도 토큰을 남기지 않는다 — 남기면 최대 15분간 유효한
  // 액세스 토큰이 살아 있다(명세 EP-002 경고). 여러 번 불러도 안전하다.
  const signOut = useCallback(() => {
    clearSession();
    setAuth(null);
  }, []);

  // 명세 주석 토글 — body 클래스로 전 화면 제어 (globals.css의 body.annot 셀렉터)
  useEffect(() => {
    document.body.classList.toggle("annot", annot);
  }, [annot]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastShow(false), 2600);
  }, []);

  return (
    <AppContext.Provider
      value={{
        replay,
        setReplay,
        annot,
        setAnnot,
        toast,
        toastMsg,
        toastShow,
        auth,
        authReady,
        signIn,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
