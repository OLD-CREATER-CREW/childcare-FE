"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/** 클라이언트 UI 전역 상태 — 토스트 · 재생 모드 · 명세 주석 + 로그인 세션
 * (서버 데이터는 TanStack Query, 로그인 세션은 여기서 localStorage로 지속) */

/** 로그인한 교사 세션 — 실서비스의 세션 쿠키 대신 데모에서는 이 값으로 게이팅 */
export type AuthSession = { name: string; role: string; className: string };

const AUTH_KEY = "childcare.auth";

type AppContextValue = {
  replay: boolean;
  setReplay: (v: boolean) => void;
  annot: boolean;
  setAnnot: (v: boolean) => void;
  toast: (msg: string) => void;
  toastMsg: string;
  toastShow: boolean;
  /** 로그인 세션 — null이면 미로그인 */
  auth: AuthSession | null;
  /** localStorage 하이드레이션 완료 여부 — 이전엔 게이트가 판단을 미룬다 */
  authReady: boolean;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [replay, setReplay] = useState(false);
  const [annot, setAnnot] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // 로그인 세션 — SSR에는 localStorage가 없으므로 마운트 후 하이드레이션한다.
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) setAuth(JSON.parse(raw) as AuthSession);
    } catch {
      /* 손상된 값이면 미로그인으로 간주 */
    }
    setAuthReady(true);
  }, []);

  const signIn = useCallback((session: AuthSession) => {
    setAuth(session);
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    } catch {
      /* 저장 실패해도 이 세션 동안은 메모리 상태로 동작 */
    }
  }, []);

  const signOut = useCallback(() => {
    setAuth(null);
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
      /* noop */
    }
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
