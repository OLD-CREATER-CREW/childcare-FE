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
  TemplateDocType,
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
  checklist: ["checklist"] as const,
  metrics: ["metrics", "summary"] as const,
  settings: ["settings"] as const,
  /** SCR-016 — 재원/퇴소 필터가 다르면 다른 목록이다 */
  childRoster: (status: ChildStatus | "all") =>
    ["children", "roster", status] as const,
  childProfile: (childId: string) => ["children", "profile", childId] as const,
  users: (activeOnly: boolean) => ["users", "list", activeOnly] as const,
  user: (userId: string) => ["users", "detail", userId] as const,
  activityRecommendations: (className: string | null) =>
    ["activities", "recommend", className ?? "all"] as const,
  /** SCR-015 — 문서 타입별 목록. 타입을 안 주면 전 타입. */
  templates: (docType: TemplateDocType | null) =>
    ["templates", "list", docType ?? "all"] as const,
  /**
   * 템플릿 상세(칸 구조). 문서 화면의 표 구조 캐시도 **이 키를 공유한다** —
   * 문서마다 같은 템플릿을 다시 받지 않기 위해서다.
   */
  template: (id: number) => ["templates", "detail", id] as const,
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

/**
 * EP-027 활동 추천. 계획안 주제를 정할 때 참고한다.
 *
 * 서버가 실패해도 200 + 빈 목록으로 답하도록 돼 있어(FN-013 예외 2) 재시도하지
 * 않는다 — 추천은 참고용이라 없다고 화면이 막히면 안 된다.
 */
export const useActivityRecommendations = (className: string | null) =>
  useQuery({
    queryKey: queryKeys.activityRecommendations(className),
    queryFn: () => apiFn.fetchActivityRecommendations(className),
    retry: false,
    staleTime: 5 * 60 * 1000,
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
      topic,
      className,
    }: {
      type: DocType;
      childId: string | null;
      /** 계획안·놀이이야기에서 교사가 정한 놀이 주제. 다른 문서는 쓰지 않는다. */
      topic?: string;
      /** 놀이이야기의 대상 반. 반 단위 문서라 이 값이 범위를 정한다. */
      className?: string | null;
    }) => apiFn.generateDocumentDraft(type, childId, topic, className),
    onSuccess: (data, { type, childId }) => {
      qc.setQueryData(queryKeys.documentDraft(type, childId), data);
      // 알림장 대기열의 "생성 전/검토 대기" 표시는 초안 존재 여부에서 나온다.
      // 새로 만들었으면 그 목록도 다시 읽어야 칩이 바뀐다.
      if (type === "notice") {
        qc.invalidateQueries({ queryKey: queryKeys.noticeQueue });
      }
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
      /** null이면 서버가 저장해 둔 작업본으로 확정한다(칸 단위 편집 문서) */
      content: string | null;
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

/**
 * 칸 단위 저장(EP-013). **바뀐 칸만** 넘긴다.
 *
 * 저장 후 문서를 다시 읽지 않는다 — 교사가 타이핑하는 도중에 서버 값이 덮어쓰면
 * 커서가 튄다. 화면이 낙관적으로 들고 있다가 확정·재조회 때 맞춘다.
 */
export const useSaveDocumentCells = () =>
  useMutation({
    mutationFn: ({
      type,
      childId,
      cells,
    }: {
      type: DocType;
      childId: string | null;
      cells: Record<string, string>;
    }) => apiFn.saveDocumentCells(type, childId, cells),
  });

// ---- 완성 문서 파일 (EP-036·038) ----

export const useRenderDocumentFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      childId,
    }: {
      type: DocType;
      childId: string | null;
    }) => apiFn.renderDocumentFile(type, childId),
    // `file_key`·`file_render_status`가 바뀌었으니 문서를 다시 읽어야
    // 「내려받기」 버튼이 나타난다.
    onSuccess: (_res, { type, childId }) =>
      qc.invalidateQueries({
        queryKey: queryKeys.documentDraft(type, childId),
      }),
  });
};

export const useDownloadDocumentFile = () =>
  useMutation({
    mutationFn: ({
      type,
      childId,
    }: {
      type: DocType;
      childId: string | null;
    }) => apiFn.downloadDocumentFile(type, childId),
  });

// ---- 양식 템플릿 (SCR-015) ----

export const useTemplates = (docType: TemplateDocType | null) =>
  useQuery({
    queryKey: queryKeys.templates(docType),
    queryFn: () => apiFn.fetchTemplates(docType ?? undefined),
  });

/**
 * 이 문서 종류에 활성 서식이 있는가.
 *
 * 문서 화면이 **생성 전에** 알아야 하는 값이다 — 서식이 있으면 칸마다 모델을
 * 부르느라 2~5분이 걸리고, 없으면 한 덩어리라 20~40초다. 안내 문구가 달라진다.
 * 놀이이야기처럼 서식 대상이 아닌 타입은 아예 묻지 않는다.
 */
export const useActiveTemplate = (docType: DocType) => {
  const templateType =
    docType === "play_story" ? null : (docType as TemplateDocType);
  return useQuery({
    queryKey: [...queryKeys.templates(templateType), "active"] as const,
    queryFn: () => apiFn.fetchTemplates(templateType as TemplateDocType, true),
    enabled: templateType !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
    select: (list) => list[0] ?? null,
  });
};

/**
 * 템플릿 상세(칸 구조).
 *
 * 표 구조는 문서가 아니라 템플릿에 속하므로 **한 번 받아 오래 캐시한다** —
 * 문서 화면이 문서마다 이걸 다시 받으면 같은 값을 반복 전송하게 된다.
 * 템플릿은 등록 후 바뀌지 않으므로 `staleTime: Infinity`가 안전하다.
 */
export const useTemplate = (id: number | null) =>
  useQuery({
    queryKey: queryKeys.template(id ?? 0),
    queryFn: () => apiFn.fetchTemplate(id as number),
    enabled: id != null,
    staleTime: Infinity,
    retry: false,
  });

/** EP-032. 실패는 화면이 `ApiError.code`로 갈라 처리한다(415 두 갈래·422). */
export const useUploadTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docType, file }: { docType: TemplateDocType; file: File }) =>
      apiFn.uploadTemplate(docType, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
};

export const useActivateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFn.activateTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      // 활성 양식이 바뀌면 이후 만드는 문서의 칸 구성이 달라진다 —
      // 열려 있던 문서 화면이 옛 구조를 들고 있지 않도록 함께 비운다.
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
};

export const useDeactivateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFn.deactivateTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
};

/** EP-052 문체 예시 토글 — 화면이 경고를 보인 뒤에만 부른다(개인정보). */
export const useSetTemplateStyle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiFn.setTemplateStyleEnabled(id, enabled),
    onSuccess: (t) => {
      qc.setQueryData(queryKeys.template(t.id), t);
      qc.invalidateQueries({ queryKey: queryKeys.templates(null) });
      qc.invalidateQueries({ queryKey: queryKeys.templates(t.docType) });
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
    mutationFn: ({ id, tags }: { id: string; tags: DevelopmentDomain[] }) =>
      apiFn.updateObservationTag(id, tags),
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
      tags,
      memo,
    }: {
      childId: string;
      tags: DevelopmentDomain[];
      memo: string;
    }) => apiFn.addObservation(childId, tags, memo),
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
