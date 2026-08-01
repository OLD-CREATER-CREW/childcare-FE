"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Baby,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  CheckSquare,
  Home,
  KeyRound,
  LogOut,
  Mail,
  Menu,
  Mic,
  Pencil,
  Search,
  Settings,
  Sprout,
  TrendingUp,
  Users,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { CLASS_NAME, TEACHER_NAME, TODAY_LABEL } from "@/lib/constants";
import { ROLE_LABEL } from "@/lib/types";
import { useLogout, useRecordSummary } from "@/lib/queries";
import { PasswordChangeDialog } from "@/components/PasswordChangeDialog";
import { Toast } from "@/components/ui";

type NavItem = {
  href: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  scr: string;
  badge?: (pendingDocs: number, unclassified: number) => number;
  /** 원장 계정에만 보이는 메뉴(명세 1.2.1) */
  directorOnly?: boolean;
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "하루 흐름",
    items: [
      { href: "/", icon: Home, label: "오늘 홈", scr: "002" },
      { href: "/records", icon: Pencil, label: "하루 기록", scr: "003" },
      {
        href: "/notices",
        icon: Mail,
        label: "알림장",
        scr: "004",
        badge: (docs) => docs,
      },
      {
        href: "/photos",
        icon: Camera,
        label: "사진함",
        scr: "005",
        badge: (_docs, photos) => photos,
      },
      { href: "/journal", icon: BookOpen, label: "보육일지", scr: "006" },
      { href: "/plans", icon: CalendarDays, label: "계획안", scr: "007" },
    ],
  },
  {
    group: "관찰·소통",
    items: [
      {
        href: "/observations",
        icon: Search,
        label: "관찰·발달영역",
        scr: "008",
      },
      { href: "/consults", icon: Mic, label: "상담일지", scr: "010" },
      {
        href: "/evaluations",
        icon: TrendingUp,
        label: "발달평가서",
        scr: "011",
      },
    ],
  },
  {
    group: "운영",
    items: [
      {
        href: "/checklist",
        icon: CheckSquare,
        label: "평가제 체크리스트",
        scr: "012",
      },
      {
        href: "/dashboard",
        icon: BarChart3,
        label: "지표 대시보드",
        scr: "013",
      },
      { href: "/settings", icon: Settings, label: "설정", scr: "014" },
    ],
  },
  {
    group: "원 관리",
    items: [
      { href: "/children", icon: Baby, label: "아동 관리", scr: "016" },
      // 계정 관리는 원장 계정에만 메뉴가 보인다(스토리보드 SCR-017)
      {
        href: "/users",
        icon: Users,
        label: "계정 관리",
        scr: "017",
        directorOnly: true,
      },
    ],
  },
];

const BOTTOM_TABS = [
  { href: "/", icon: Home, label: "홈" },
  { href: "/records", icon: Pencil, label: "기록" },
  { href: "/photos", icon: Camera, label: "사진" },
  { href: "/notices", icon: Mail, label: "알림장" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { replay, annot, setAnnot, auth, signOut } = useApp();
  const logoutMutation = useLogout();
  const [open, setOpen] = useState(false);
  const summaryQuery = useRecordSummary();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const teacherName = auth?.name ?? TEACHER_NAME;
  const teacherRole = auth ? ROLE_LABEL[auth.role] : "담임";
  const isDirector = auth?.role === "director";

  // 로그아웃(EP-002) — 서버는 리프레시 토큰만 폐기한다. 저장한 토큰 두 개를 지우는
  // 것은 API 계층이 맡고, 여기서는 화면 상태를 비우고 로그인 화면으로 돌려보낸다.
  // 서버 응답 실패와 무관하게 닫히는 루프여야 한다.
  const doLogout = () =>
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        signOut();
        router.replace("/login");
      },
    });

  const pendingDocs = summaryQuery.data?.pendingDocs ?? 0;
  const unclassified = summaryQuery.data?.unclassifiedPhotos ?? 0;
  const bellCount = pendingDocs + unclassified;

  // 좁은 창에서 라우트가 바뀌면 드로어를 닫는다
  useEffect(() => {
    setOpen(false);
  }, [path]);

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="menu-btn"
          aria-label="메뉴 열기"
          onClick={() => setOpen(!open)}
        >
          <Menu size={17} className="mx-auto" />
        </button>
        <div className="logo">
          <span className="logo-mark">
            <Sprout size={17} />
          </span>{" "}
          어린이집 AI 행정비서
        </div>
        <span className="top-date text-[13px] text-muted">
          {/* 기관명은 로그인 응답의 center_name — 세션 전 잠깐만 상수로 채운다 */}
          {TODAY_LABEL} · {auth?.centerName ?? CLASS_NAME}
        </span>
        <div className="flex-1" />
        {replay && <span className="replay-pill">▶ 재생 모드</span>}
        <label className="flex cursor-pointer items-center gap-[7px] text-[12.5px] text-muted">
          <input
            type="checkbox"
            checked={annot}
            onChange={(e) => setAnnot(e.target.checked)}
            className="accent-green"
          />{" "}
          명세 주석
        </label>
        <button className="bell" aria-label={`알림 ${bellCount}건`}>
          <Bell size={16} />
          {bellCount > 0 && <span className="dot">{bellCount}</span>}
        </button>
        <div className="user-chip">
          <span
            className="avatar"
            style={{ background: "var(--green)" }}
            aria-hidden
          >
            {teacherName.slice(0, 1)}
          </span>
          <span className="name">
            {teacherName} · {teacherRole}
          </span>
        </div>
      </header>

      <nav className={`sidenav ${open ? "open" : ""}`}>
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items
              .filter((it) => !it.directorOnly || isDirector)
              .map((it) => {
                const Icon = it.icon;
                const cnt = it.badge?.(pendingDocs, unclassified) ?? 0;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`nav-item ${path === it.href ? "active" : ""}`}
                  >
                    <Icon size={17} className="ico w-5 flex-none" />
                    {it.label}
                    {cnt > 0 ? <span className="cnt">{cnt}</span> : null}
                    <span className="nav-scr">{it.scr}</span>
                  </Link>
                );
              })}
          </div>
        ))}
        <div className="mt-auto">
          <div className="nav-group">계정</div>
          {/* EP-049 — 교사·원장 모두 쓴다(명세 1.2.1) */}
          <button
            type="button"
            className="nav-item w-full text-left"
            onClick={() => setPasswordOpen(true)}
          >
            <KeyRound size={17} className="ico w-5 flex-none" />
            비밀번호 변경
            <span className="nav-scr">049</span>
          </button>
          <button
            type="button"
            className="nav-item w-full text-left"
            onClick={doLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut size={17} className="ico w-5 flex-none" />
            {logoutMutation.isPending ? "로그아웃 중…" : "로그아웃"}
            <span className="nav-scr">001</span>
          </button>
        </div>
      </nav>

      <main className="main">{children}</main>

      <PasswordChangeDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
      <Toast />

      <nav className="bottomtab">
        {BOTTOM_TABS.map(({ href, icon: Icon, label }) => (
          <button
            key={href}
            className={path === href ? "active" : ""}
            onClick={() => router.push(href)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
