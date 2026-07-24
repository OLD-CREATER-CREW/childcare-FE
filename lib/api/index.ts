import { api } from "@/lib/api/client";
import type {
  AppSettings,
  ChecklistData,
  Child,
  ConsultData,
  DailyRecord,
  DailyRecordInput,
  DevelopmentDomain,
  DocType,
  DocumentDraft,
  LoginInput,
  LoginResponse,
  MetricsSummary,
  NoticeQueue,
  ObservationData,
  ObservationEntry,
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

// EP-007-B — 같은 날짜·아이 기록이 있으면 수정 모드
export const fetchDailyRecord = (childId: string, date: string) =>
  api.get<{ record: DailyRecord | null }>(
    `/records?child=${childId}&date=${date}`,
  );

// EP-007
export const saveDailyRecord = (input: DailyRecordInput) =>
  api.post<{ ok: boolean }>("/records", input);

// EP-010
export const fetchDocumentDraft = (
  type: DocType,
  childId: string | null,
  regenerate = false,
) => {
  const params = new URLSearchParams({ type });
  if (childId) params.set("child", childId);
  if (regenerate) params.set("regen", "1");
  return api.get<DocumentDraft>(`/documents/draft?${params}`);
};

// EP-012
export const fetchNoticeQueue = () =>
  api.get<NoticeQueue>("/documents/notices/queue");

// EP-011 — 기록 있는 아이 전원 초안 일괄 생성
export const generateAllNotices = () =>
  api.post<{ created: number; total: number }>(
    "/documents/notices/generate-all",
  );

// EP-013
export const saveWorkingCopy = (
  type: DocType,
  childId: string | null,
  content: string,
) => api.put<{ ok: boolean }>("/documents/working", { type, childId, content });

// EP-014
export const confirmDocument = (
  type: DocType,
  childId: string | null,
  content: string,
) => api.post<DocumentDraft>("/documents/confirm", { type, childId, content });

// EP-015 — 알림장만 사용
export const sendDocument = (type: DocType, childId: string | null) =>
  api.post<{ ok: boolean }>("/documents/send", { type, childId });

// EP-016
export const uploadPhotos = () =>
  api.post<{ ok: boolean; added: number }>("/photos/upload");

// EP-017
export const fetchPhotoInbox = () => api.get<PhotoInbox>("/photos");

// EP-018
export const assignPhoto = (photoId: number, childId: string) =>
  api.post<{ ok: boolean }>("/photos/assign", { photoId, childId });

// EP-019
export const sendPhotos = (ids: number[]) =>
  api.post<{ sent: number }>("/photos/send", { ids });

// EP-005
export const fetchObservations = (childId: string) =>
  api.get<ObservationData>(`/observations?child=${childId}`);

// EP-009
export const updateObservationTag = (
  id: string,
  tag: DevelopmentDomain | null,
) => api.post<ObservationEntry>("/observations/tag", { id, tag });

// EP-020 — 관찰 기록 직접 추가
export const addObservation = (
  childId: string,
  tag: DevelopmentDomain | null,
  memo: string,
) => api.post<ObservationEntry>("/observations", { childId, tag, memo });

// EP-024 · EP-006
export const fetchConsults = (childId: string) =>
  api.get<ConsultData>(`/consults?child=${childId}`);

// EP-025
export const confirmConsult = (id: string, summary: string) =>
  api.post<{ ok: boolean }>("/consults/confirm", { id, summary });

// EP-026
export const fetchChecklist = () => api.get<ChecklistData>("/checklist");

// EP-028
export const fetchMetrics = () => api.get<MetricsSummary>("/metrics/summary");

// EP-032 — 로컬 양식(서식) 동기화: 노트북 폴더에서 읽은 서식을 백엔드에 반영
export const syncTemplates = (templates: Partial<Record<DocType, string>>) =>
  api.post<{ ok: boolean; applied: string[] }>("/templates", { templates });

// EP-029 ~ EP-031
export const fetchSettings = () => api.get<AppSettings>("/settings");
export const setReplayMode = (on: boolean) =>
  api.post<{ ok: boolean }>("/settings/replay", { on });
export const reloadSeed = () => api.post<{ ok: boolean }>("/settings/seed");
