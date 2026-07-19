"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as apiFn from "@/lib/api";
import type { DailyRecordInput, DocType, LoginInput } from "@/lib/types";

/** TanStack Query 훅 계층 — 화면은 이 훅만 사용 */

export const queryKeys = {
  children: ["children"] as const,
  recordSummary: ["records", "summary"] as const,
  documentDraft: (type: DocType) => ["documents", "draft", type] as const,
  noticeQueue: ["documents", "notices", "queue"] as const,
  photos: ["photos"] as const,
  observations: (childId: string) => ["observations", childId] as const,
  consult: ["consults", "current"] as const,
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

export const useDocumentDraft = (type: DocType) =>
  useQuery({
    queryKey: queryKeys.documentDraft(type),
    queryFn: () => apiFn.fetchDocumentDraft(type),
  });

export const useNoticeQueue = () =>
  useQuery({
    queryKey: queryKeys.noticeQueue,
    queryFn: apiFn.fetchNoticeQueue,
  });

export const usePhotoInbox = () =>
  useQuery({ queryKey: queryKeys.photos, queryFn: apiFn.fetchPhotoInbox });

export const useObservations = (childId: string) =>
  useQuery({
    queryKey: queryKeys.observations(childId),
    queryFn: () => apiFn.fetchObservations(childId),
  });

export const useConsultData = () =>
  useQuery({ queryKey: queryKeys.consult, queryFn: apiFn.fetchConsultData });

export const useChecklist = () =>
  useQuery({ queryKey: queryKeys.checklist, queryFn: apiFn.fetchChecklist });

export const useMetrics = () =>
  useQuery({ queryKey: queryKeys.metrics, queryFn: apiFn.fetchMetrics });

// ---- Mutations ----

export const useLogin = () =>
  useMutation({ mutationFn: (input: LoginInput) => apiFn.login(input) });

export const useSaveDailyRecord = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DailyRecordInput) => apiFn.saveDailyRecord(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.children });
      qc.invalidateQueries({ queryKey: queryKeys.recordSummary });
    },
  });
};

export const useConfirmDocument = () =>
  useMutation({
    mutationFn: ({ type, content }: { type: DocType; content: string }) =>
      apiFn.confirmDocument(type, content),
  });

export const useSendDocument = () =>
  useMutation({ mutationFn: (type: DocType) => apiFn.sendDocument(type) });

export const useUploadPhotos = () =>
  useMutation({ mutationFn: apiFn.uploadPhotos });

export const useSendPhotos = () =>
  useMutation({ mutationFn: (ids: number[]) => apiFn.sendPhotos(ids) });

export const useConfirmConsult = () =>
  useMutation({
    mutationFn: (summary: string) => apiFn.confirmConsult(summary),
  });

export const useSetReplayMode = () =>
  useMutation({ mutationFn: (on: boolean) => apiFn.setReplayMode(on) });

export const useReloadSeed = () =>
  useMutation({ mutationFn: apiFn.reloadSeed });
