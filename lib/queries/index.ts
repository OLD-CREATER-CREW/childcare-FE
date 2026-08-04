"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as apiFn from "@/lib/api";
import type {
  ChildProfileInput,
  ChildStatus,
  DailyRecordInput,
  DevelopmentDomain,
  DocType,
  LoginInput,
  PasswordChangeInput,
  SignupInput,
  UserAccountInput,
  UserAccountPatch,
} from "@/lib/types";

/** TanStack Query 훅 계층 — 화면은 이 훅만 사용 */

export const queryKeys = {
  children: ["children"] as const,
  recordSummary: ["records", "summary"] as const,
  dailyRecord: (childId: string, date: string) =>
    ["records", childId, date] as const,
  dayRecordedIds: (date: string) => ["records", "recorded", date] as const,
  documentDraft: (type: DocType, childId: string | null) =>
    ["documents", "draft", type, childId ?? "class"] as const,
  noticeQueue: ["documents", "notices", "queue"] as const,
  photos: ["photos"] as const,
  observations: (childId: string) => ["observations", childId] as const,
  consults: (childId: string) => ["consults", childId] as const,
  checklist: ["checklist"] as const,
  metrics: ["metrics", "summary"] as const,
  settings: ["settings"] as const,
  /** SCR-016 — 재원/퇴소 필터가 다르면 다른 목록이다 */
  childRoster: (status: ChildStatus | "all") =>
    ["children", "roster", status] as const,
  childProfile: (childId: string) => ["children", "profile", childId] as const,
  users: (activeOnly: boolean) => ["users", "list", activeOnly] as const,
  user: (userId: string) => ["users", "detail", userId] as const,
};

// ---- Queries ----

export const useChildren = () =>
  useQuery({ queryKey: queryKeys.children, queryFn: apiFn.fetchChildren });

export const useRecordSummary = () =>
  useQuery({
    queryKey: queryKeys.recordSummary,
    queryFn: apiFn.fetchRecordSummary,
  });

export const useDailyRecord = (childId: string, date: string) =>
  useQuery({
    queryKey: queryKeys.dailyRecord(childId, date),
    queryFn: () => apiFn.fetchDailyRecord(childId, date),
    staleTime: 0,
    enabled: !!childId,
  });

/** 그날 기록을 남긴 아이들의 id 집합 — 하루 기록 화면의 "기록 완료" 판정 */
export const useDayRecordedIds = (date: string) =>
  useQuery({
    queryKey: queryKeys.dayRecordedIds(date),
    queryFn: () => apiFn.fetchDayRecordChildIds(date),
    staleTime: 0,
  });

export const useDocumentDraft = (type: DocType, childId: string | null) =>
  useQuery({
    queryKey: queryKeys.documentDraft(type, childId),
    queryFn: () => apiFn.fetchDocumentDraft(type, childId),
    retry: false,
  });

export const useNoticeQueue = () =>
  useQuery({
    queryKey: queryKeys.noticeQueue,
    queryFn: apiFn.fetchNoticeQueue,
  });

/** 분류 중 사진이 있으면 2.2초 간격 폴링 — 진행감을 만든다 */
export const usePhotoInbox = () =>
  useQuery({
    queryKey: queryKeys.photos,
    queryFn: apiFn.fetchPhotoInbox,
    refetchInterval: (query) =>
      (query.state.data?.classifying ?? 0) > 0 ? 2200 : false,
  });

export const useObservations = (childId: string) =>
  useQuery({
    queryKey: queryKeys.observations(childId),
    queryFn: () => apiFn.fetchObservations(childId),
    enabled: !!childId,
  });

export const useConsults = (childId: string) =>
  useQuery({
    queryKey: queryKeys.consults(childId),
    queryFn: () => apiFn.fetchConsults(childId),
    enabled: !!childId,
  });

export const useChecklist = () =>
  useQuery({
    queryKey: queryKeys.checklist,
    queryFn: apiFn.fetchChecklist,
    staleTime: 0,
  });

export const useMetrics = () =>
  useQuery({ queryKey: queryKeys.metrics, queryFn: apiFn.fetchMetrics });

// ---- Mutations ----

export const useLogin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => apiFn.login(input),
    // 앞 사용자의 캐시가 남으면 다른 기관 자료가 잠깐 비친다
    onSuccess: () => qc.clear(),
  });
};

/** SCR-018 원장 회원가입(EP-051) — 성공하면 곧바로 로그인 상태가 된다 */
export const useSignup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) => apiFn.signup(input),
    onSuccess: () => qc.clear(),
  });
};

export const useLogout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: apiFn.logout,
    // 다른 계정으로 다시 로그인해도 이전 세션의 서버 캐시가 남지 않도록 비운다.
    // `clear()`가 아니라 `removeQueries()`인 이유: clear는 마운트된 관찰자를
    // 즉시 재요청시키는데, 이 시점엔 토큰이 이미 없어 401 → 갱신 실패 → 세션
    // 만료 핸들러까지 타면서 정상 로그아웃마다 실패 요청이 남는다.
    onSettled: () => qc.removeQueries(),
  });
};

/** EP-049 본인 비밀번호 변경 — 토큰 교체는 seam이 처리한다 */
export const useChangePassword = () =>
  useMutation({
    mutationFn: (input: PasswordChangeInput) => apiFn.changeMyPassword(input),
  });

// ---- FN-021 아동 인적사항 (SCR-016) ----

export const useChildRoster = (status: ChildStatus | "all") =>
  useQuery({
    queryKey: queryKeys.childRoster(status),
    queryFn: () => apiFn.fetchChildRoster(status),
  });

export const useChildProfile = (childId: string | null) =>
  useQuery({
    queryKey: queryKeys.childProfile(childId ?? ""),
    queryFn: () => apiFn.fetchChildProfile(childId as string),
    enabled: !!childId,
    staleTime: 0,
    // 실패를 빨리 드러낸다 — 이 조회가 실패하면 인적사항 패널은 폼 대신 오류를
    // 보여 줘야 하므로, 재시도로 그 판정을 늦추면 사용자가 그 사이 폼을 채운다.
    retry: false,
  });

/** 명단이 바뀌면 아이 목록에 기대는 화면(홈 현황·알림장 대기열)도 함께 무효화한다 */
function invalidateRoster(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["children"] });
  qc.invalidateQueries({ queryKey: queryKeys.recordSummary });
  qc.invalidateQueries({ queryKey: queryKeys.noticeQueue });
}

export const useCreateChild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChildProfileInput) => apiFn.createChild(input),
    onSuccess: () => invalidateRoster(qc),
  });
};

export const useUpdateChild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      childId,
      input,
    }: {
      childId: string;
      input: Partial<ChildProfileInput>;
    }) => apiFn.updateChild(childId, input),
    onSuccess: (_d, { childId }) => {
      invalidateRoster(qc);
      qc.invalidateQueries({ queryKey: queryKeys.childProfile(childId) });
    },
  });
};

export const useWithdrawChild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (childId: string) => apiFn.withdrawChild(childId),
    onSuccess: (_d, childId) => {
      invalidateRoster(qc);
      qc.invalidateQueries({ queryKey: queryKeys.childProfile(childId) });
    },
  });
};

export const useReenrollChild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (childId: string) => apiFn.reenrollChild(childId),
    onSuccess: (_d, childId) => {
      invalidateRoster(qc);
      qc.invalidateQueries({ queryKey: queryKeys.childProfile(childId) });
    },
  });
};

// ---- FN-022 계정 관리 (SCR-017, 원장 전용) ----

export const useUsers = (activeOnly: boolean, enabled = true) =>
  useQuery({
    queryKey: queryKeys.users(activeOnly),
    queryFn: () => apiFn.fetchUsers(activeOnly),
    enabled,
    retry: false,
  });

/** EP-045 — 원장은 아무 계정이나, 교사는 자기 계정만(내 정보 조회) */
export const useUser = (userId: string | null) =>
  useQuery({
    queryKey: queryKeys.user(userId ?? ""),
    queryFn: () => apiFn.fetchUser(userId as string),
    enabled: !!userId,
    retry: false,
  });

const invalidateUsers = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["users"] });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UserAccountInput) => apiFn.createUser(input),
    onSuccess: () => invalidateUsers(qc),
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      patch,
    }: {
      userId: string;
      patch: UserAccountPatch;
    }) => apiFn.updateUser(userId, patch),
    onSuccess: () => invalidateUsers(qc),
  });
};

export const useLockUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiFn.lockUser(userId),
    onSuccess: () => invalidateUsers(qc),
  });
};

export const useResetUserPassword = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      newPassword,
    }: {
      userId: string;
      newPassword: string;
    }) => apiFn.resetUserPassword(userId, newPassword),
    onSuccess: () => invalidateUsers(qc),
  });
};

export const useSaveDailyRecord = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DailyRecordInput) => apiFn.saveDailyRecord(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.children });
      qc.invalidateQueries({ queryKey: queryKeys.recordSummary });
      qc.invalidateQueries({ queryKey: queryKeys.noticeQueue });
      qc.invalidateQueries({
        queryKey: queryKeys.dailyRecord(input.childId, input.date),
      });
      // 그날 "기록 완료" 목록 갱신 → 방금 저장한 아이가 완료로 표시됨
      qc.invalidateQueries({
        queryKey: queryKeys.dayRecordedIds(input.date),
      });
      // 원천 기록 변경 → 미확정 알림장 초안 무효화
      qc.invalidateQueries({
        queryKey: queryKeys.documentDraft("notice", input.childId),
      });
    },
  });
};

export const useRegenerateDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      childId,
    }: {
      type: DocType;
      childId: string | null;
    }) => apiFn.fetchDocumentDraft(type, childId, true),
    onSuccess: (data, { type, childId }) => {
      qc.setQueryData(queryKeys.documentDraft(type, childId), data);
    },
  });
};

export const useSaveWorkingCopy = () =>
  useMutation({
    mutationFn: ({
      type,
      childId,
      content,
    }: {
      type: DocType;
      childId: string | null;
      content: string;
    }) => apiFn.saveWorkingCopy(type, childId, content),
  });

export const useConfirmDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      childId,
      content,
    }: {
      type: DocType;
      childId: string | null;
      content: string;
    }) => apiFn.confirmDocument(type, childId, content),
    onSuccess: (doc, { type, childId }) => {
      qc.setQueryData(queryKeys.documentDraft(type, childId), doc);
      qc.invalidateQueries({ queryKey: queryKeys.noticeQueue });
      qc.invalidateQueries({ queryKey: queryKeys.recordSummary });
      qc.invalidateQueries({ queryKey: queryKeys.checklist });
      qc.invalidateQueries({ queryKey: queryKeys.metrics });
    },
  });
};

export const useSendDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      childId,
    }: {
      type: DocType;
      childId: string | null;
    }) => apiFn.sendDocument(type, childId),
    onSuccess: (_data, { type, childId }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.documentDraft(type, childId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.noticeQueue });
      qc.invalidateQueries({ queryKey: queryKeys.checklist });
    },
  });
};

export const useUploadPhotos = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => apiFn.uploadPhotos(files),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.photos }),
  });
};

export const useAssignPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, childId }: { photoId: number; childId: string }) =>
      apiFn.assignPhoto(photoId, childId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.photos });
      qc.invalidateQueries({ queryKey: queryKeys.recordSummary });
    },
  });
};

export const useSendPhotos = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => apiFn.sendPhotos(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.photos }),
  });
};

export const useUpdateObservationTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: DevelopmentDomain | null }) =>
      apiFn.updateObservationTag(id, tag),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["observations"] });
      qc.invalidateQueries({ queryKey: queryKeys.metrics });
    },
  });
};

export const useAddObservation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      childId,
      tag,
      memo,
    }: {
      childId: string;
      tag: DevelopmentDomain | null;
      memo: string;
    }) => apiFn.addObservation(childId, tag, memo),
    onSuccess: () => {
      // 관찰이 늘면 발달평가서 원료·태깅률·체크리스트가 함께 움직인다
      qc.invalidateQueries({ queryKey: ["observations"] });
      qc.invalidateQueries({ queryKey: queryKeys.metrics });
      qc.invalidateQueries({ queryKey: queryKeys.checklist });
    },
  });
};

export const useGenerateAllNotices = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: apiFn.generateAllNotices,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.noticeQueue });
      qc.invalidateQueries({ queryKey: ["documents", "draft", "notice"] });
    },
  });
};

export const useConfirmConsult = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, summary }: { id: string; summary: string }) =>
      apiFn.confirmConsult(id, summary),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consults"] });
      qc.invalidateQueries({ queryKey: queryKeys.checklist });
    },
  });
};

export const useSetReplayMode = () =>
  useMutation({ mutationFn: (on: boolean) => apiFn.setReplayMode(on) });

export const useSyncTemplates = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templates: Partial<Record<DocType, string>>) =>
      apiFn.syncTemplates(templates),
    onSuccess: () => {
      // 서식이 바뀌면 미확정 초안이 새 서식으로 다시 생성돼야 한다
      qc.invalidateQueries({ queryKey: ["documents", "draft"] });
      qc.invalidateQueries({ queryKey: queryKeys.noticeQueue });
    },
  });
};

export const useReloadSeed = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: apiFn.reloadSeed,
    onSuccess: () => qc.invalidateQueries(),
  });
};
