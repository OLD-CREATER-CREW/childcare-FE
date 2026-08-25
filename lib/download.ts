/**
 * 받은 파일을 사용자의 디스크에 저장시킨다.
 *
 * 완성 문서는 `Authorization` 헤더가 있어야 받을 수 있어 `<a href>`로 걸 수 없다 —
 * 반드시 fetch로 받아 blob으로 들고 있다가 여기서 저장한다. 파일명은 서버가
 * `Content-Disposition`으로 정해 준 값을 그대로 쓴다(확장자가 .hwpx일 수도
 * .docx일 수도 있다).
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
