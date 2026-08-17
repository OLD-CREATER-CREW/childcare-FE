"use client";

import type { DocType } from "@/lib/types";

/**
 * 양식(서식) 계층 — 각 노트북 로컬 폴더에 놓인 양식 파일을 읽어
 * 문서 초안의 서식을 결정한다.
 *
 * 파일 시스템 접근은 Electron 메인 프로세스만 가능하므로, 렌더러(웹 UI)는
 * preload 브리지(`window.desktop.templates`)를 통해서만 접근한다.
 * 웹(개발) 모드에는 브리지가 없어 항상 기본 내장 서식으로 폴백한다.
 *
 * `applyTemplate` / `fileNameToDocType`는 부수효과 없는 순수 함수라
 * 파일·창 없이 단위 테스트할 수 있다(파일 읽기와 서식 로직 분리).
 */

export type TemplateFileInfo = { name: string; type: DocType | null };
export type TemplateConfig = {
  /** 지정된 양식 폴더 경로 — 미지정이면 null */
  folder: string | null;
  files: TemplateFileInfo[];
};

/** preload가 노출하는 네이티브 브리지 */
type DesktopTemplatesBridge = {
  getConfig: () => Promise<{ folder: string | null; files: string[] }>;
  pickFolder: () => Promise<{ folder: string | null; files: string[] }>;
  readAll: () => Promise<Record<string, string>>;
};
type DesktopBridge = {
  isDesktop?: boolean;
  templates?: DesktopTemplatesBridge;
};

function desktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { desktop?: DesktopBridge }).desktop ?? null;
}

function bridge(): DesktopTemplatesBridge | null {
  return desktop()?.templates ?? null;
}

/** Electron 셸 안에서 실행 중인지 — 웹 개발 모드와 분기하는 기준 */
export function isDesktop(): boolean {
  return Boolean(desktop()?.isDesktop);
}

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  notice: "알림장",
  journal: "보육일지",
  plan: "주간 계획안",
  plan_monthly: "월간 계획안",
  evaluation: "발달평가서",
};

/** 파일명 → 문서 종류 매핑 (확장자 제거 후 키워드로 판정). 순수 함수. */
export function fileNameToDocType(name: string): DocType | null {
  const base = name.replace(/\.[^.]+$/, "");
  if (/알림장/.test(base)) return "notice";
  if (/보육일지|일지/.test(base)) return "journal";
  if (/계획안|주안|월안|계획/.test(base)) return "plan";
  if (/발달|평가서/.test(base)) return "evaluation";
  return null;
}

function toFileInfos(files: string[]): TemplateFileInfo[] {
  return files.map((name) => ({ name, type: fileNameToDocType(name) }));
}

/** 현재 지정된 양식 폴더와 인식된 파일 목록 (없으면 빈 설정) */
export async function getTemplateConfig(): Promise<TemplateConfig> {
  const t = bridge();
  if (!t) return { folder: null, files: [] };
  const res = await t.getConfig();
  return { folder: res.folder, files: toFileInfos(res.files) };
}

/** OS 폴더 선택창을 띄워 양식 폴더를 지정 — 취소하면 기존 설정을 그대로 반환 */
export async function pickTemplateFolder(): Promise<TemplateConfig | null> {
  const t = bridge();
  if (!t) return null;
  const res = await t.pickFolder();
  return { folder: res.folder, files: toFileInfos(res.files) };
}

/** 폴더의 양식 파일을 읽어 DocType별 서식 문자열 맵으로 변환 */
export async function loadTemplateMap(): Promise<
  Partial<Record<DocType, string>>
> {
  const t = bridge();
  if (!t) return {};
  const files = await t.readAll(); // { "알림장.md": "본문…", … }
  const map: Partial<Record<DocType, string>> = {};
  for (const [name, content] of Object.entries(files)) {
    const type = fileNameToDocType(name);
    if (type && !map[type]) map[type] = content;
  }
  return map;
}

/**
 * 서식 문자열의 `{키}` 자리표시자를 값으로 치환한다. 순수 함수(테스트 대상).
 * - 값이 없거나 정의되지 않은 키는 빈 문자열로 지운다.
 * - 중괄호 안 공백은 허용: `{ 이름 }` == `{이름}`.
 */
export function applyTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{\s*([^{}\s]+)\s*\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}
