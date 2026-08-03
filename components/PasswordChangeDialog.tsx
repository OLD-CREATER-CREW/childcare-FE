"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useChangePassword } from "@/lib/queries";
import { useApp } from "@/lib/store";
import {
  PASSWORD_ERROR,
  PASSWORD_HINT,
  PASSWORD_MIN_LENGTH,
} from "@/lib/constants";
import { Modal, Notice } from "@/components/ui";

/**
 * 본인 비밀번호 변경 (EP-049) — 공통 상단바에서 열린다. 교사·원장 모두 쓴다.
 *
 * 원장의 재설정(EP-048)과 갈리는 지점이 둘이다: **현재 비밀번호를 확인**하고,
 * **지금 쓰는 창의 세션은 남긴다.** 새 액세스 토큰으로 교체하는 일은 seam이
 * 맡는다 — 교체하지 않으면 token_version이 올라가 다음 요청부터 401이다.
 */
export function PasswordChangeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useApp();
  const mutation = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  // 열 때와 **닫을 때** 모두 비운다 — 닫은 뒤 상태에 남은 평문 비밀번호는
  // DevTools·힙 스냅샷에 그대로 노출된다.
  useEffect(() => {
    setCurrentPassword("");
    setNewPassword("");
    setError("");
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // 빈 값을 그대로 보내면 서버가 400 PASSWORD_MISMATCH를 주는데, 그러면
    // "입력 안 함"인데 "비밀번호가 틀렸다"고 오인시킨다.
    if (!currentPassword) {
      setError("현재 비밀번호를 입력해 주세요.");
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(PASSWORD_ERROR);
      return;
    }
    if (newPassword === currentPassword) {
      setError("새 비밀번호가 현재 비밀번호와 같습니다.");
      return;
    }
    mutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: ({ revokedSessions }) => {
          toast(
            revokedSessions > 0
              ? `비밀번호를 바꿨습니다 — 다른 기기 ${revokedSessions}곳에서 로그아웃되었습니다`
              : "비밀번호를 바꿨습니다",
          );
          onClose();
        },
        onError: (e) =>
          setError(
            e instanceof ApiError
              ? e.message
              : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
          ),
      },
    );
  };

  return (
    <Modal open={open} label="비밀번호 변경" onClose={onClose}>
      <h3>비밀번호 변경</h3>
      <div className="desc">
        지금 쓰는 창은 그대로 유지되고, 다른 기기는 로그아웃됩니다.
      </div>
      <form className="mt-4" onSubmit={submit}>
        <div className="field">
          <label htmlFor="current-password">현재 비밀번호</label>
          <input
            id="current-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="next-password">새 비밀번호</label>
          <input
            id="next-password"
            className="input"
            type="password"
            placeholder={PASSWORD_HINT}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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
          비밀번호를 바꾸면 다른 기기에 남아 있던 로그인은 모두 끊깁니다.
        </Notice>
        <div className="btnrow justify-end">
          <button type="button" className="btn ghost" onClick={onClose}>
            취소
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "변경 중…" : "변경"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
