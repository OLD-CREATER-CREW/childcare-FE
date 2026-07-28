"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sprout } from "lucide-react";
import { useApp } from "@/lib/store";
import { useLogin } from "@/lib/queries";
import { N, Notice, SpecBar, Toast } from "@/components/ui";

// SCR-001 로그인 — 셸 밖의 단독 화면. "실제 아동 정보 입력 금지" 상시 고지(REQ-NF-007)
export default function LoginPage() {
  const router = useRouter();
  const { toast } = useApp();
  const loginMutation = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { username, password },
      {
        onSuccess: ({ teacher }) => {
          toast(`${teacher.name}, 환영합니다`);
          router.push("/");
        },
      },
    );
  };

  return (
    <div className="grid min-h-screen place-items-center p-5">
      <motion.div
        className="w-full max-w-[420px]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <SpecBar
          scr="SCR-001"
          fn={["FN-015"]}
          ep={["EP-001 POST /api/auth/login"]}
        />
        <form className="card px-8 py-8" onSubmit={submit}>
          <div className="mb-6 text-center">
            <div className="logo-mark mx-auto mb-3.5 h-[54px] w-[54px] rounded-2xl">
              <Sprout size={27} />
            </div>
            <div className="text-[19px] font-extrabold tracking-tight">
              어린이집 AI 행정비서
            </div>
            <div className="mt-0.5 text-[13px] text-muted">
              기록은 한 번, 문서는 AI가
            </div>
          </div>
          <div className="field">
            <label htmlFor="username">
              <N n={1} />
              아이디
            </label>
            <input
              id="username"
              className="input"
              placeholder="기관·교사 계정 아이디"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">
              <N n={2} />
              비밀번호
            </label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder="●●●●●●●●"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn primary big mt-2 w-full"
            disabled={loginMutation.isPending}
          >
            <N n={3} />
            {loginMutation.isPending ? "로그인 중…" : "로그인"}
          </button>
          <div className="mt-5">
            <Notice kind="warn">
              ⚠{" "}
              <span>
                <N n={4} />
                <b>이 서비스는 연습용입니다.</b> 실제 아동의 이름·사진을
                입력하지 마세요. 모든 데이터는 파일럿 종료 시 파기됩니다.
              </span>
            </Notice>
          </div>
        </form>
      </motion.div>
      <Toast />
    </div>
  );
}
