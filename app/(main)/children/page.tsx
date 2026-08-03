"use client";

import { useEffect, useState } from "react";
import { Baby, Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  useChildProfile,
  useChildRoster,
  useCreateChild,
  useReenrollChild,
  useUpdateChild,
  useWithdrawChild,
} from "@/lib/queries";
import { useApp } from "@/lib/store";
import type { ChildProfile, ChildProfileInput } from "@/lib/types";
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
 * SCR-016 아동 관리 (FN-021) — 명단 조회·등록·인적사항 수정·퇴소.
 * 등록(EP-039)·퇴소(EP-042)는 **원장 전용**이고, 수정(EP-041)은 교사도 쓴다(명세 1.2.1).
 * 화면에서 버튼을 숨기는 것은 편의이고, 판정은 서버의 403이 최후 방어선이다.
 */

const ALL_CLASSES = "__all__";

type PanelState = { mode: "create" } | { mode: "edit"; childId: string } | null;

const emptyForm: ChildProfileInput = {
  name: "",
  birthDate: "",
  className: "",
  gender: null,
  enrolledAt: "",
  memo: "",
};

/**
 * 원본과 달라진 항목만 골라낸다 — EP-041은 부분 수정이라 보내지 않은 키는 그대로
 * 두기 때문이다. 폼 전체를 보내면 손대지 않은 값까지 매번 덮어쓰게 되고, 원본을
 * 못 받은 상태라면 그 덮어쓰기가 곧 삭제가 된다.
 */
function changedFields(
  profile: ChildProfile,
  form: ChildProfileInput,
): Partial<ChildProfileInput> {
  const diff: Partial<ChildProfileInput> = {};
  if (form.name.trim() !== profile.name) diff.name = form.name;
  if ((form.birthDate ?? "") !== profile.birthDate)
    diff.birthDate = form.birthDate;
  if ((form.className ?? "") !== profile.className)
    diff.className = form.className;
  if ((form.gender ?? null) !== profile.gender) diff.gender = form.gender;
  if ((form.enrolledAt ?? "") !== profile.enrolledAt)
    diff.enrolledAt = form.enrolledAt;
  if ((form.memo ?? "") !== profile.memo) diff.memo = form.memo;
  return diff;
}

export default function ChildrenPage() {
  const { auth, toast } = useApp();
  const isDirector = auth?.role === "director";

  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [classFilter, setClassFilter] = useState(ALL_CLASSES);
  const [panel, setPanel] = useState<PanelState>(null);
  const [form, setForm] = useState<ChildProfileInput>(emptyForm);
  const [error, setError] = useState("");
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const rosterQuery = useChildRoster(showWithdrawn ? "all" : "enrolled");
  const editingId = panel?.mode === "edit" ? panel.childId : null;
  const profileQuery = useChildProfile(editingId);

  const createMutation = useCreateChild();
  const updateMutation = useUpdateChild();
  const withdrawMutation = useWithdrawChild();
  const reenrollMutation = useReenrollChild();

  const roster = rosterQuery.data ?? [];
  const classNames = Array.from(
    new Set(roster.map((c) => c.className).filter(Boolean) as string[]),
  );
  // 「퇴소 아동 보기」를 끄면 선택 중이던 반이 옵션에서 사라질 수 있다. 그대로 두면
  // 목록이 0명이 되어 사용자는 "아이가 사라졌다"로 읽는다 — 없는 값이면 전체로 되돌린다.
  const activeFilter = classNames.includes(classFilter)
    ? classFilter
    : ALL_CLASSES;
  const rows =
    activeFilter === ALL_CLASSES
      ? roster
      : roster.filter((c) => c.className === activeFilter);

  // 단건 조회(EP-040)가 도착하면 폼을 채운다 — 목록에 없는 입소일·특이사항이 여기 있다
  const profile = profileQuery.data;
  useEffect(() => {
    if (panel?.mode === "edit" && profile) {
      setForm({
        name: profile.name,
        birthDate: profile.birthDate,
        className: profile.className,
        gender: profile.gender,
        enrolledAt: profile.enrolledAt,
        memo: profile.memo,
      });
    }
  }, [panel, profile]);

  const openCreate = () => {
    setForm(emptyForm);
    setError("");
    setPanel({ mode: "create" });
  };

  const openEdit = (childId: string) => {
    setForm(emptyForm);
    setError("");
    setPanel({ mode: "edit", childId });
  };

  const closePanel = () => {
    setPanel(null);
    setError("");
  };

  const onApiError = (e: unknown) =>
    setError(
      e instanceof ApiError
        ? e.message
        : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    );

  const save = () => {
    setError("");
    if (!form.name.trim()) {
      setError("아동 이름을 입력해 주세요.");
      return;
    }
    if (panel?.mode === "create") {
      createMutation.mutate(form, {
        onSuccess: (c) => {
          toast(`${c.name} 원아를 등록했습니다`);
          closePanel();
        },
        onError: onApiError,
      });
    } else if (panel?.mode === "edit") {
      // 원본이 아직 없으면 저장하지 않는다 — 비교할 대상이 없으면 "안 고친 것"과
      // "비운 것"을 구분할 수 없다.
      if (!profile) return;
      const input = changedFields(profile, form);
      if (Object.keys(input).length === 0) {
        closePanel();
        return;
      }
      updateMutation.mutate(
        { childId: panel.childId, input },
        {
          onSuccess: () => {
            toast("인적사항을 저장했습니다");
            closePanel();
          },
          onError: onApiError,
        },
      );
    }
  };

  const doWithdraw = () => {
    if (panel?.mode !== "edit") return;
    withdrawMutation.mutate(panel.childId, {
      onSuccess: () => {
        toast("퇴소 처리했습니다 — 기록·문서는 그대로 남습니다");
        setConfirmWithdraw(false);
        closePanel();
      },
      onError: (e) => {
        setConfirmWithdraw(false);
        onApiError(e);
      },
    });
  };

  const doReenroll = () => {
    if (panel?.mode !== "edit") return;
    reenrollMutation.mutate(panel.childId, {
      onSuccess: () => {
        toast("재원으로 되돌렸습니다");
        closePanel();
      },
      onError: onApiError,
    });
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const withdrawn = profile?.status === "withdrawn";

  return (
    <>
      <PageHead
        title="아동 관리"
        sub="원아 명단·인적사항 — 등록과 퇴소는 원장 권한입니다"
        right={
          // ① 원장에게만 보인다(명세 1.2.1)
          isDirector && (
            <button className="btn primary" onClick={openCreate}>
              <N n={1} />
              <Plus size={15} /> 원아 등록
            </button>
          )
        }
      />
      <SpecBar
        scr="SCR-016"
        fn={["FN-021"]}
        ep={[
          "EP-004 목록",
          "EP-039 등록",
          "EP-040 단건",
          "EP-041 수정",
          "EP-042 퇴소",
        ]}
      />

      <div className="stack">
        <div className="card">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-[12.5px] font-bold text-muted">
              <N n={2} />반
            </span>
            <Select
              className="w-[150px]"
              ariaLabel="반 필터"
              value={activeFilter}
              onChange={setClassFilter}
              options={[
                { value: ALL_CLASSES, label: "전체" },
                ...classNames.map((c) => ({ value: c, label: c })),
              ]}
            />
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
              <input
                type="checkbox"
                className="accent-green"
                checked={showWithdrawn}
                onChange={(e) => setShowWithdrawn(e.target.checked)}
              />
              <N n={3} />
              퇴소 아동 보기
            </label>
            <div className="flex-1" />
            <span className="text-[12.5px] text-muted">총 {rows.length}명</span>
          </div>

          {rosterQuery.isLoading ? (
            <Skeleton lines={5} />
          ) : rosterQuery.isError ? (
            <QueryError onRetry={() => rosterQuery.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Baby size={22} />}
              title="아직 등록된 원아가 없습니다"
              desc={
                isDirector
                  ? "「＋ 원아 등록」으로 시작하거나, 설정에서 합성 데이터를 불러오세요."
                  : "원장님께 원아 등록을 요청하거나, 설정에서 합성 데이터를 불러오세요."
              }
            />
          ) : (
            <table className="tbl rowhover">
              <thead>
                <tr>
                  <th>
                    <N n={4} />
                    이름
                  </th>
                  <th className="w-32">생년월일</th>
                  <th className="w-28">반</th>
                  <th className="w-16">성별</th>
                  <th className="w-20">상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => openEdit(c.id)}
                  >
                    <td className="font-semibold">{c.name}</td>
                    <td className="font-mono text-[12.5px]">
                      {c.birthDate || "—"}
                    </td>
                    <td>{c.className || "—"}</td>
                    <td>{c.gender ?? "—"}</td>
                    <td>
                      {c.status === "withdrawn" ? (
                        <span className="tag daily">퇴소</span>
                      ) : (
                        <span className="tag dom">재원</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ⑤ 인적사항 패널 — 이름만 필수, 나머지는 나중에 채운다 */}
      <Modal
        open={panel !== null}
        wide
        label={panel?.mode === "create" ? "원아 등록" : "인적사항"}
        onClose={closePanel}
      >
        <h3>
          <N n={5} />
          {panel?.mode === "create"
            ? "원아 등록"
            : (profile?.name ?? "인적사항")}
        </h3>

        {/* 수정 모드에서는 원본이 도착하기 전까지 폼을 열지 않는다.
            빈 폼이 열리면 이름만 채워 저장했을 때 나머지 항목이 전부 지워진다
            (EP-041에서 null = 비우기). 조회 실패는 재시도로 되돌린다. */}
        {panel?.mode === "edit" && profileQuery.isError ? (
          <div className="mt-4">
            <QueryError onRetry={() => profileQuery.refetch()} />
          </div>
        ) : panel?.mode === "edit" && !profile ? (
          <Skeleton lines={4} />
        ) : (
          <div className="mt-4">
            <div className="field">
              <label htmlFor="child-name">이름</label>
              <input
                id="child-name"
                className="input"
                placeholder="가상아동_지호"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <div className="field flex-1">
                <label htmlFor="child-birth">생년월일</label>
                <input
                  id="child-birth"
                  className="input"
                  type="date"
                  value={form.birthDate ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, birthDate: e.target.value })
                  }
                />
              </div>
              <div className="field w-[120px]">
                <label htmlFor="child-gender">성별</label>
                <Select
                  ariaLabel="성별"
                  value={form.gender ?? ""}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      gender: v === "" ? null : (v as "남" | "여"),
                    })
                  }
                  options={[
                    { value: "", label: "미입력" },
                    { value: "남", label: "남" },
                    { value: "여", label: "여" },
                  ]}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="field flex-1">
                <label htmlFor="child-class">반</label>
                <input
                  id="child-class"
                  className="input"
                  placeholder="햇님반"
                  value={form.className ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, className: e.target.value })
                  }
                />
              </div>
              <div className="field flex-1">
                <label htmlFor="child-enrolled">입소일</label>
                <input
                  id="child-enrolled"
                  className="input"
                  type="date"
                  value={form.enrolledAt ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, enrolledAt: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="child-memo">특이사항</label>
              <input
                id="child-memo"
                className="input"
                placeholder="알레르기·투약·주의사항"
                value={form.memo ?? ""}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
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
              공모전·파일럿 기간에는 실제 아동 정보를 입력하지 않습니다.
            </Notice>

            <div className="btnrow justify-end">
              {/* ⑦ 퇴소 처리 — 원장에게만 보인다 */}
              {panel?.mode === "edit" &&
                isDirector &&
                (withdrawn ? (
                  <button
                    className="btn"
                    onClick={doReenroll}
                    disabled={reenrollMutation.isPending}
                  >
                    재원으로 되돌리기
                  </button>
                ) : (
                  <button
                    className="btn danger"
                    onClick={() => setConfirmWithdraw(true)}
                  >
                    <N n={7} />
                    퇴소 처리
                  </button>
                ))}
              <div className="flex-1" />
              <button className="btn ghost" onClick={closePanel}>
                닫기
              </button>
              <button className="btn primary" onClick={save} disabled={saving}>
                <N n={6} />
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmWithdraw}
        title="퇴소 처리할까요?"
        desc="퇴소 처리하면 명단에서 빠집니다. 지금까지의 기록·문서는 그대로 남습니다."
        confirmLabel="퇴소 처리"
        danger
        pending={withdrawMutation.isPending}
        onConfirm={doWithdraw}
        onClose={() => setConfirmWithdraw(false)}
      />
    </>
  );
}
