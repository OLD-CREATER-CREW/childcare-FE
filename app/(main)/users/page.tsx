"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, UserPlus } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import {
  useCreateUser,
  useLockUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
} from "@/lib/queries";
import { useApp } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/types";
import type { UserAccount, UserRole } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  N,
  Notice,
  PageHead,
  QueryError,
  Select,
  Skeleton,
  SpecBar,
} from "@/components/ui";

/**
 * SCR-017 계정 관리 (FN-022) — **원장 전용**(명세 1.2.1).
 * 메뉴 자체를 교사에게 숨기지만, 주소로 직접 들어올 수 있으므로 화면에서도 막는다.
 * 서버의 403이 최후 방어선이다.
 */

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

const ROLE_OPTIONS = [
  { value: "teacher", label: ROLE_LABEL.teacher },
  { value: "director", label: ROLE_LABEL.director },
];

type Panel =
  | { mode: "create" }
  | { mode: "edit"; user: UserAccount }
  | { mode: "password"; user: UserAccount }
  | null;

export default function UsersPage() {
  const { auth, toast } = useApp();
  const isDirector = auth?.role === "director";

  const [activeOnly, setActiveOnly] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState("");
  const [confirmLock, setConfirmLock] = useState<UserAccount | null>(null);

  // 생성 폼
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("teacher");

  const usersQuery = useUsers(activeOnly, isDirector);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const lockMutation = useLockUser();
  const resetMutation = useResetUserPassword();

  useEffect(() => {
    if (panel?.mode === "edit") {
      setName(panel.user.name);
      setRole(panel.user.role);
    }
    if (panel?.mode === "create") {
      setUsername("");
      setPassword("");
      setName("");
      setRole("teacher");
    }
    if (panel?.mode === "password") setPassword("");
    setError("");
  }, [panel]);

  const onApiError = (e: unknown) =>
    setError(
      e instanceof ApiError
        ? e.message
        : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    );

  // 교사가 주소로 직접 들어온 경우 — 서버 문구와 같은 말로 막는다
  if (!isDirector) {
    return (
      <>
        <PageHead title="계정 관리" sub="원장 권한이 필요한 기능입니다" />
        <SpecBar scr="SCR-017" fn={["FN-022"]} ep={["EP-043~048"]} />
        <div className="card">
          <EmptyState
            icon={<ShieldAlert size={22} />}
            title="원장 권한이 필요한 기능입니다"
            desc="계정 생성·수정·잠금은 원장 계정에서만 할 수 있습니다. 비밀번호 변경은 왼쪽 「계정」 메뉴에서 하실 수 있습니다."
          />
        </div>
      </>
    );
  }

  const createUser = () => {
    setError("");
    if (!USERNAME_RE.test(username)) {
      setError("아이디는 영문 소문자·숫자·. _ - 로 3~30자입니다.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상으로 정해 주세요.");
      return;
    }
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    createMutation.mutate(
      { username, password, name: name.trim(), role },
      {
        onSuccess: (u) => {
          toast(`${u.name} 계정을 만들었습니다`);
          setPanel(null);
        },
        onError: onApiError,
      },
    );
  };

  const saveUser = () => {
    if (panel?.mode !== "edit") return;
    setError("");
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    updateMutation.mutate(
      { userId: panel.user.userId, patch: { name: name.trim(), role } },
      {
        onSuccess: () => {
          toast("계정을 수정했습니다");
          setPanel(null);
        },
        onError: onApiError,
      },
    );
  };

  const toggleActive = (user: UserAccount) => {
    setError("");
    updateMutation.mutate(
      { userId: user.userId, patch: { active: true } },
      {
        onSuccess: () => {
          toast("계정을 다시 사용할 수 있습니다");
          setPanel(null);
        },
        onError: onApiError,
      },
    );
  };

  const doLock = () => {
    if (!confirmLock) return;
    lockMutation.mutate(confirmLock.userId, {
      onSuccess: () => {
        toast("계정을 잠갔습니다 — 기록은 그대로 남습니다");
        setConfirmLock(null);
        setPanel(null);
      },
      onError: (e) => {
        setConfirmLock(null);
        onApiError(e);
      },
    });
  };

  const doResetPassword = () => {
    if (panel?.mode !== "password") return;
    setError("");
    if (password.length < 8) {
      setError("비밀번호는 8자 이상으로 정해 주세요.");
      return;
    }
    resetMutation.mutate(
      { userId: panel.user.userId, newPassword: password },
      {
        onSuccess: () => {
          toast("비밀번호를 재설정했습니다 — 새 비밀번호를 전달해 주세요");
          setPanel(null);
        },
        onError: onApiError,
      },
    );
  };

  const users = usersQuery.data ?? [];

  return (
    <>
      <PageHead
        title="계정 관리"
        sub="우리 어린이집 선생님 계정 — 원장 전용"
        right={
          <button
            className="btn primary"
            onClick={() => setPanel({ mode: "create" })}
          >
            <N n={1} />
            <UserPlus size={15} /> 선생님 계정 만들기
          </button>
        }
      />
      <SpecBar
        scr="SCR-017"
        fn={["FN-022"]}
        ep={[
          "EP-043 생성",
          "EP-044 목록",
          "EP-046 수정",
          "EP-047 잠금",
          "EP-048 비밀번호 재설정",
        ]}
      />

      <div className="stack">
        <div className="card">
          <div className="mb-3 flex items-center gap-3">
            {/* ② 기본 목록에는 잠긴 계정도 함께 나온다 — 이 체크는 활성만 보려는 용도 */}
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
              <input
                type="checkbox"
                className="accent-green"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              <N n={2} />
              사용중인 계정만 보기
            </label>
            <div className="flex-1" />
            <span className="text-[12.5px] text-muted">
              총 {users.length}개
            </span>
          </div>

          {usersQuery.isLoading ? (
            <Skeleton lines={4} />
          ) : usersQuery.isError ? (
            <QueryError onRetry={() => usersQuery.refetch()} />
          ) : users.length === 0 ? (
            <EmptyState
              icon={<UserPlus size={22} />}
              title="계정이 없습니다"
              desc="「＋ 선생님 계정 만들기」로 파일럿에 참여할 교사 계정을 만들어 주세요."
            />
          ) : (
            <table className="tbl rowhover">
              <thead>
                <tr>
                  <th className="w-40">
                    <N n={3} />
                    아이디
                  </th>
                  <th>이름</th>
                  <th className="w-28">역할</th>
                  <th className="w-20">상태</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.userId}
                    className="cursor-pointer"
                    onClick={() => setPanel({ mode: "edit", user: u })}
                  >
                    <td className="font-mono text-[12.5px]">{u.username}</td>
                    <td className="font-semibold">
                      {u.name}
                      {u.userId === auth?.userId && (
                        <span className="ml-2 text-[11.5px] text-muted">
                          (나)
                        </span>
                      )}
                    </td>
                    <td>{ROLE_LABEL[u.role]}</td>
                    <td>
                      {u.active ? (
                        <span className="tag dom">사용중</span>
                      ) : (
                        <span className="tag daily">잠김</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ① 계정 만들기 */}
      <Modal
        open={panel?.mode === "create"}
        label="선생님 계정 만들기"
        onClose={() => setPanel(null)}
      >
        <h3>선생님 계정 만들기</h3>
        <div className="mt-4">
          <div className="field">
            <label htmlFor="new-username">아이디</label>
            <input
              id="new-username"
              className="input"
              placeholder="영문 소문자·숫자 3~30자"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="mt-1.5 text-[12px] text-muted">
              만든 뒤에는 바꿀 수 없습니다. 다른 어린이집과도 겹칠 수 없습니다.
            </p>
          </div>
          <div className="field">
            <label htmlFor="new-password">초기 비밀번호</label>
            <input
              id="new-password"
              className="input"
              type="password"
              placeholder="8자 이상"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="new-name">이름</label>
            <input
              id="new-name"
              className="input"
              placeholder="김보육"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="new-role">역할</label>
            <Select
              ariaLabel="역할"
              value={role}
              onChange={(v) => setRole(v as UserRole)}
              options={ROLE_OPTIONS}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="mb-3 text-[12.5px] font-semibold text-coral"
            >
              {error}
            </p>
          )}
          <Notice kind="soft">
            초기 비밀번호는 화면 밖에서 선생님께 직접 전달해 주세요 — 서버는
            비밀번호를 다시 보여 주지 않습니다.
          </Notice>
          <div className="btnrow justify-end">
            <button className="btn ghost" onClick={() => setPanel(null)}>
              취소
            </button>
            <button
              className="btn primary"
              onClick={createUser}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "만드는 중…" : "계정 만들기"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ④ 계정 패널 — 아이디는 읽기 전용 */}
      <Modal
        open={panel?.mode === "edit"}
        label="계정"
        onClose={() => setPanel(null)}
      >
        {panel?.mode === "edit" && (
          <>
            <h3>
              <N n={4} />
              {panel.user.username}
            </h3>
            <div className="desc">아이디는 만든 뒤 바꿀 수 없습니다.</div>
            <div className="mt-4">
              <div className="field">
                <label htmlFor="edit-name">이름</label>
                <input
                  id="edit-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-role">역할</label>
                <Select
                  ariaLabel="역할"
                  value={role}
                  onChange={(v) => setRole(v as UserRole)}
                  options={ROLE_OPTIONS}
                />
              </div>
              {error && (
                <p
                  role="alert"
                  className="mb-3 text-[12.5px] font-semibold text-coral"
                >
                  {error}
                </p>
              )}
              <div className="btnrow">
                <button
                  className="btn"
                  onClick={() =>
                    setPanel({ mode: "password", user: panel.user })
                  }
                >
                  <N n={6} />
                  비밀번호 재설정
                </button>
                {panel.user.active ? (
                  <button
                    className="btn danger"
                    onClick={() => setConfirmLock(panel.user)}
                  >
                    <N n={7} />
                    계정 잠금
                  </button>
                ) : (
                  <button
                    className="btn"
                    onClick={() => toggleActive(panel.user)}
                    disabled={updateMutation.isPending}
                  >
                    사용중으로 되돌리기
                  </button>
                )}
                <div className="flex-1" />
                <button className="btn ghost" onClick={() => setPanel(null)}>
                  닫기
                </button>
                <button
                  className="btn primary"
                  onClick={saveUser}
                  disabled={updateMutation.isPending}
                >
                  <N n={5} />
                  {updateMutation.isPending ? "저장 중…" : "저장"}
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* ⑥ 비밀번호 재설정 — 현재 비밀번호를 묻지 않는 대신 그 계정의 세션을 전부 끊는다 */}
      <Modal
        open={panel?.mode === "password"}
        label="비밀번호 재설정"
        onClose={() => setPanel(null)}
      >
        {panel?.mode === "password" && (
          <>
            <h3>{panel.user.name} 비밀번호 재설정</h3>
            <div className="desc">
              이 선생님이 지금 로그인해 둔 창은 모두 로그아웃됩니다.
            </div>
            <div className="mt-4">
              <div className="field">
                <label htmlFor="reset-password">새 비밀번호</label>
                <input
                  id="reset-password"
                  className="input"
                  type="password"
                  placeholder="8자 이상"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p
                  role="alert"
                  className="mb-3 text-[12.5px] font-semibold text-coral"
                >
                  {error}
                </p>
              )}
              <div className="btnrow justify-end">
                <button
                  className="btn ghost"
                  onClick={() => setPanel({ mode: "edit", user: panel.user })}
                >
                  취소
                </button>
                <button
                  className="btn primary"
                  onClick={doResetPassword}
                  disabled={resetMutation.isPending}
                >
                  {resetMutation.isPending ? "재설정 중…" : "재설정"}
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmLock !== null}
        title="계정을 잠글까요?"
        desc="즉시 로그아웃되고 다시 로그인할 수 없게 됩니다. 남긴 기록은 그대로 유지됩니다."
        confirmLabel="계정 잠금"
        danger
        pending={lockMutation.isPending}
        onConfirm={doLock}
        onClose={() => setConfirmLock(null)}
      />
    </>
  );
}
