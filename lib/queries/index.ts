"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as apiFn from "@/lib/api";
import type {
  DailyRecordInput,
  DevelopmentDomain,
  DocType,
  LoginInput,
} from "@/lib/types";

/** TanStack Query 훅 계층 — 화면은 이 훅만 사용 */

export const queryKeys = {
  children: ["children"] as const,
  recordSummary: ["records", "summary"] as const,
  dailyRecord: (childId: string, date: string) =>
    ["records", childId, date] as const,
  documentDraft: (type: DocType, childId: string | null) =>
    ["documents", "draft", type, childId ?? "class"] as const,
  noticeQueue: ["documents", "notices", "queue"] as const,
  photos: ["photos"] as const,
  observations: (childId: string) => ["observations", childId] as const,
  consults: (childId: string) => ["consults", childId] as const,
  checklist: ["checklist"] as const,
  metrics: ["metrics", "summary"] as const,
  settings: ["settings"] as const,
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
  });

export const useConsults = (childId: string) =>
  useQuery({
    queryKey: queryKeys.consults(childId),
    queryFn: () => apiFn.fetchConsults(childId),
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

export const useLogin = () =>
  useMutation({ mutationFn: (input: LoginInput) => apiFn.login(input) });

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
    mutationFn: apiFn.uploadPhotos,
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
