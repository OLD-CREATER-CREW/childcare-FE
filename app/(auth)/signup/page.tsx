"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sprout } from "lucide-react";
import { useApp } from "@/lib/store";
import { useSignup } from "@/lib/queries";
import { ApiError } from "@/lib/api/client";
import { N, Notice, SpecBar, Toast } from "@/components/ui";

/**
 * SCR-018 원장 회원가입 — 어린이집 이름과 함께 그 기관의 첫 원장 계정을 만든다.
 * 계정 생성(EP-043)은 원장 전용이라, 이 화면이 없으면 새 어린이집은 시작할 방법이 없다.
 * 로그인하지 않고 볼 수 있는 유일한 화면이다(명세 EP-051).
 */

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

/** 오류 코드 → 붙일 입력칸 (명세 1.2.3 ⑥) */
const ERROR_FIELD: Record<string, "centerName" | "username"> = {
  DUPLICATE_CENTER: "centerName",
  DUPLICATE_USERNAME: "username",
};

type FieldErrors = Partial<
  Record<"centerName" | "name" | "username" | "password" | "form", string>
>;

export default function SignupPage() {
  const router = useRouter();
  const { toast, auth, authReady, signIn } = useApp();
  const signupMutation = useSignup();
  const [centerName, setCenterName] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  // 이미 로그인된 세션이면 가입 화면을 건너뛴다
  useEffect(() => {
    if (authReady && auth) router.replace("/");
  }, [authReady, auth, router]);

  // 형식 위반은 요청을 보내지 않고 화면에서 막는다(스토리보드 SCR-018)
  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const center = centerName.trim();
    if (center.length < 2 || center.length > 100)
      next.centerName = "어린이집 이름을 2~100자로 입력해 주세요.";
    const director = name.trim();
    if (director.length < 1 || director.length > 50)
      next.name = "원장님 성함을 입력해 주세요.";
    if (!USERNAME_RE.test(username))
      next.username =
        "아이디는 영문 소문자·숫자와 . _ - 를 3~30자로 쓸 수 있습니다.";
    if (password.length < 8)
      next.password = "비밀번호는 8자 이상이어야 합니다.";
    return next;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validate();
    setErrors(invalid);
    if (Object.keys(invalid).length > 0) return;

    signupMutation.mutate(
      {
        centerName: centerName.trim(),
        username,
        password,
        name: name.trim(),
      },
      {
        onSuccess: (user) => {
          signIn(user);
          toast(`${user.centerName} 등록이 완료되었습니다`);
          // 가입 직후 토큰이 함께 오므로 로그인 화면으로 돌려보내지 않는다(EP-051)
          router.replace("/");
        },
        onError: (e) => {
          if (!(e instanceof ApiError)) {
            setErrors({
              form: "인터넷 연결을 확인하거나 잠시 후 다시 시도하세요.",
            });
            return;
          }
          const field = ERROR_FIELD[e.code];
          setErrors(field ? { [field]: e.message } : { form: e.message });
        },
      },
    );
  };

  const fieldError = (key: keyof FieldErrors) =>
    errors[key] ? (
      <p role="alert" className="mt-1.5 text-[12px] font-semibold text-coral">
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="grid min-h-screen place-items-center p-5">
      <motion.div
        className="w-full max-w-[420px]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <SpecBar
          scr="SCR-018"
          fn={["FN-015"]}
          ep={["EP-051 POST /api/auth/signup"]}
        />
        <form className="card px-8 py-8" onSubmit={submit}>
          <div className="mb-6 text-center">
            <div className="logo-mark mx-auto mb-3.5 h-[54px] w-[54px] rounded-2xl">
              <Sprout size={27} />
            </div>
            <div className="text-[19px] font-extrabold tracking-tight">
              어린이집 등록하기
            </div>
            <div className="mt-0.5 text-[13px] text-muted">
              어린이집과 원장 계정을 함께 만듭니다
            </div>
          </div>

          <div className="field">
            <label htmlFor="centerName">
              <N n={1} />
              어린이집 이름
            </label>
            <input
              id="centerName"
              className="input"
              placeholder="예) 햇살어린이집"
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
            />
            {fieldError("centerName")}
          </div>

          <div className="field">
            <label htmlFor="name">
              <N n={2} />
              원장님 성함
            </label>
            <input
              id="name"
              className="input"
              placeholder="예) 김원장"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldError("name")}
          </div>

          <div className="field">
            <label htmlFor="username">
              <N n={3} />
              아이디
            </label>
            <input
              id="username"
              className="input"
              placeholder="영문 소문자·숫자 3~30자"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {fieldError("username") ?? (
              <p className="mt-1.5 text-[12px] text-muted">
                영문 소문자·숫자 3~30자
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">
              <N n={4} />
              비밀번호
            </label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder="●●●●●●●●"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {fieldError("password") ?? (
              <p className="mt-1.5 text-[12px] text-muted">8자 이상</p>
            )}
          </div>

          {fieldError("form")}

          {/* ⑤ 중복 클릭을 막는다 — 두 번 눌리면 기관이 둘 생길 수 있다(EP-051) */}
          <button
            type="submit"
            className="btn primary big mt-2 w-full"
            disabled={signupMutation.isPending}
          >
            <N n={5} />
            {signupMutation.isPending ? "등록 중…" : "등록하고 시작하기"}
          </button>

          <p className="mt-4 text-center text-[13px] text-muted">
            <N n={6} />
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-bold text-green underline">
              로그인
            </Link>
          </p>

          <div className="mt-5">
            <Notice kind="warn">
              ⚠{" "}
              <span>
                <N n={7} />
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
