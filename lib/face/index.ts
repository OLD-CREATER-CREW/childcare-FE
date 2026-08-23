/**
 * 얼굴인식 연동 모듈.
 *
 *   import { enrollChild, classifyPhotos, ClassGallery } from "@/lib/face";
 *
 * 사용법과 주의사항은 같은 폴더의 README.md 를 본다.
 * 서버 규약 정본: 백엔드 저장소 `ml/pipeline/INTERFACE.md` v2.1
 */

export * from "./types";
export {
  DEFAULT_THRESHOLD,
  MAX_ENROLL_FILES,
  classifyPhoto,
  classifyPhotos,
  enrollChild,
  faceHealth,
  resizeImage,
} from "./client";
export {
  ClassGallery,
  MemoryGalleryStore,
  createGalleryStore,
  hasDesktopFaceBridge,
} from "./gallery";
export type { DesktopFaceBridge, GalleryStore } from "./gallery";
export { formatDate, readPhotoDate } from "./exif";
export { galleryKey, resetGalleryCache, useGallery } from "./useGallery";
export type { UseGalleryResult } from "./useGallery";
export {
  FolderCancelledError,
  FolderUnsupportedError,
  MAX_FOLDER_PHOTOS,
  WritePermissionDeniedError,
  browsePhotoFolder,
  draftDates,
  groupByDate,
  pickPhotoFolder,
  recommendFolderName,
  revokeBrowsedPhotos,
  revokeFolderPhotos,
  saveRecommended,
} from "./photoFolder";
export type { BrowsedPhoto, FolderPhoto, RootDirHandle } from "./photoFolder";
