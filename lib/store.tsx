"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/** 클라이언트 UI 전역 상태 — 토스트 · 재생 모드 · 명세 주석 (서버 상태는 TanStack Query) */

type AppContextValue = {
  replay: boolean;
  setReplay: (v: boolean) => void;
  annot: boolean;
  setAnnot: (v: boolean) => void;
  toast: (msg: string) => void;
  toastMsg: string;
  toastShow: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [replay, setReplay] = useState(false);
  const [annot, setAnnot] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

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
      value={{ replay, setReplay, annot, setAnnot, toast, toastMsg, toastShow }}
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
