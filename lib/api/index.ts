import { api } from "@/lib/api/client";
import type {
  AppSettings,
  ChecklistData,
  Child,
  ConsultData,
  DailyRecordInput,
  DocType,
  DocumentDraft,
  LoginInput,
  LoginResponse,
  MetricsSummary,
  NoticeQueue,
  ObservationData,
  PhotoInbox,
  RecordSummary,
} from "@/lib/types";

/** API 함수 계층 — EP 번호는 스토리보드 명세 매핑 */

// EP-001
export const login = (input: LoginInput) =>
  api.post<LoginResponse>("/auth/login", input);

// EP-004
export const fetchChildren = () => api.get<Child[]>("/children");

// EP-008
export const fetchRecordSummary = () =>
  api.get<RecordSummary>("/records/summary");

// EP-007
export const saveDailyRecord = (input: DailyRecordInput) =>
  api.post<{ ok: boolean }>("/records", input);

// EP-010
export const fetchDocumentDraft = (type: DocType) =>
  api.get<DocumentDraft>(`/documents/draft?type=${type}`);

// EP-012
export const fetchNoticeQueue = () =>
  api.get<NoticeQueue>("/documents/notices/queue");

// EP-013
export const saveWorkingCopy = (type: DocType, content: string) =>
  api.put<{ ok: boolean }>("/documents/working", { type, content });

// EP-014
export const confirmDocument = (type: DocType, content: string) =>
  api.post<{ ok: boolean }>("/documents/confirm", { type, content });

// EP-015 — 알림장만 사용
export const sendDocument = (type: DocType) =>
  api.post<{ ok: boolean }>("/documents/send", { type });

// EP-016
export const uploadPhotos = () => api.post<{ ok: boolean }>("/photos/upload");

// EP-017
export const fetchPhotoInbox = () => api.get<PhotoInbox>("/photos");

// EP-019
export const sendPhotos = (ids: number[]) =>
  api.post<{ sent: number }>("/photos/send", { ids });

// EP-005
export const fetchObservations = (childId: string) =>
  api.get<ObservationData>(`/observations?child=${childId}`);

// EP-024 · EP-006
export const fetchConsultData = () => api.get<ConsultData>("/consults/current");
export const confirmConsult = (summary: string) =>
  api.post<{ ok: boolean }>("/consults/confirm", { summary });

// EP-026
export const fetchChecklist = () => api.get<ChecklistData>("/checklist");

// EP-028
export const fetchMetrics = () => api.get<MetricsSummary>("/metrics/summary");

// EP-029 ~ EP-031
export const fetchSettings = () => api.get<AppSettings>("/settings");
export const setReplayMode = (on: boolean) =>
  api.post<{ ok: boolean }>("/settings/replay", { on });
export const reloadSeed = () => api.post<{ ok: boolean }>("/settings/seed");
