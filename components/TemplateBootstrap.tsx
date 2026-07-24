"use client";

import { useEffect } from "react";
import { isDesktop, loadTemplateMap } from "@/lib/templates";
import { useSyncTemplates } from "@/lib/queries";

/**
 * 부팅 시 로컬 양식 동기화 — 데스크톱(Electron)에서만 동작한다.
 * 지정된 폴더의 양식 파일을 읽어 백엔드(목)에 반영하면, 이후 생성되는
 * 문서 초안이 그 어린이집 서식을 따른다. 웹 개발 모드에서는 아무 것도 하지 않는다.
 */
export function TemplateBootstrap() {
  const sync = useSyncTemplates();

  useEffect(() => {
    if (!isDesktop()) return;
    loadTemplateMap()
      .then((map) => {
        if (Object.keys(map).length) sync.mutate(map);
      })
      .catch(() => {
        /* 폴더 미지정·읽기 실패는 조용히 기본 서식 사용 */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
