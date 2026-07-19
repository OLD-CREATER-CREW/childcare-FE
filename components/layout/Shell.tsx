"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  CheckSquare,
  Home,
  KeyRound,
  Mail,
  Menu,
  Mic,
  NotebookPen,
  Pencil,
  Search,
  Settings,
  Sprout,
  TrendingUp,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { TODAY, CLASS_NAME, TEACHER_NAME } from "@/lib/data/mock";
import { Toast } from "@/components/ui";

type NavItem = {
  href: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  scr: string;
  cnt?: number;
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "하루 흐름",
    items: [
      { href: "/", icon: Home, label: "오늘 홈", scr: "002" },
      { href: "/records", icon: Pencil, label: "하루 기록", scr: "003" },
      { href: "/notices", icon: Mail, label: "알림장", scr: "004", cnt: 3 },
      { href: "/photos", icon: Camera, label: "사진함", scr: "005", cnt: 5 },
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
  const { replay, annot, setAnnot } = useApp();
  const [open, setOpen] = useState(false);

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
            <Sprout size={16} />
          </span>{" "}
          어린이집 AI 행정비서
        </div>
        <span className="top-date text-[13px] text-muted">
          {TODAY} · {CLASS_NAME}
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
        <button className="bell" aria-label="알림">
          <Bell size={16} className="mx-auto" />
          <span className="dot">8</span>
        </button>
        <div className="user-chip">
          <span className="avatar">김</span>
          <span className="name">{TEACHER_NAME} · 담임</span>
        </div>
      </header>

      <nav className={`sidenav ${open ? "open" : ""}`}>
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items.map((it) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`nav-item ${path === it.href ? "active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={17} className="w-5 flex-none" />
                  {it.label}
                  {it.cnt ? <span className="cnt">{it.cnt}</span> : null}
                  <span className="nav-scr">{it.scr}</span>
                </Link>
              );
            })}
          </div>
        ))}
        <div className="nav-group">진입</div>
        <Link href="/login" className="nav-item">
          <KeyRound size={17} className="w-5 flex-none" /> 로그인
          <span className="nav-scr">001</span>
        </Link>
      </nav>

      <main className="main">{children}</main>

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
