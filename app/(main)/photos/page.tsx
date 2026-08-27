"use client";

/**
 * SCR-005 사진함 (FN-006) — 얼굴 등록과 사진 분류를 한 화면에 모은다.
 *
 * ■ 왜 한 화면인가
 * 둘은 같은 **반 갤러리** 하나를 공유한다. 등록이 갤러리를 채우고 분류가 그것을
 * 소비하므로, 화면이 갈리면 교사는 "왜 분류가 안 되지"를 다른 화면에서 찾아야 한다.
 * 반 선택·갤러리 상태·서버 연결 경고를 여기서 한 번만 두고 두 탭이 나눠 쓴다.
 *
 * ■ 탭을 감출 뿐 언마운트하지 않는다
 * 올린 사진과 분류 결과는 이 페이지의 메모리에만 있다. 탭을 옮길 때 언마운트하면
 * 등록하러 갔다 온 사이 분류 결과가 통째로 날아간다.
 *
 * 담당: 손승현(ml)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Images,
  ScanFace,
  ShieldAlert,
  UserRoundPlus,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useChildRoster } from "@/lib/queries";
import { useApp } from "@/lib/store";
import { faceHealth, galleryKey, useGallery, usePhotoRoot } from "@/lib/face";
import {
  N,
  Notice,
  PageHead,
  QueryError,
  Select,
  Skeleton,
  SpecBar,
} from "@/components/ui";
import { ClassifyPanel } from "@/components/face/ClassifyPanel";
import { EnrollPanel } from "@/components/face/EnrollPanel";
import { FolderPanel } from "@/components/face/FolderPanel";
import { PhotoFolderBar } from "@/components/face/PhotoFolderBar";

type Tab = "classify" | "enroll" | "browse";

export default function PhotosPage() {
  const { auth, toast } = useApp();
  const rosterQuery = useChildRoster("enrolled");
  const roster = useMemo(() => rosterQuery.data ?? [], [rosterQuery.data]);

  const [tab, setTab] = useState<Tab>("classify");
  const [className, setClassName] = useState("");
  const [serverDown, setServerDown] = useState<string | null>(null);

  // 사진 폴더는 화면 하나가 아니라 **앱이** 기억한다. 분류한 사진을 내보낼 곳도,
  // 폴더 보기가 훑을 곳도 여기다(`lib/face/photoRoot.ts`).
  const photoRoot = usePhotoRoot();

  const classNames = useMemo(
    () =>
      Array.from(
        new Set(roster.map((c) => c.className ?? "").filter(Boolean)),
      ).sort(),
    [roster],
  );
  // 반이 비어 있는 아이는 갤러리 키를 만들 수 없어 목록에 넣지 않는다
  const unassigned = roster.filter((c) => !c.className).length;

  // 명단이 도착하면 첫 반을 고른다. 고른 반이 사라지면(퇴소 등) 다시 첫 반으로.
  useEffect(() => {
    if (classNames.length === 0) return;
    if (!classNames.includes(className)) setClassName(classNames[0]);
  }, [classNames, className]);

  // 기관이 확정되기 전에는 갤러리를 열지 않는다 — 키가 달라지면 다른 파일이 된다
  const classKey =
    auth && className ? galleryKey(auth.centerId, className) : null;
  const gallery = useGallery(classKey);

  const kids = useMemo(
    () => roster.filter((c) => c.className === className),
    [roster, className],
  );
  const enrolledCount = kids.filter((k) => gallery.isEnrolled(k.id)).length;

  /**
   * 명단에 없는 임베딩을 자동으로 파기한다 (개인정보 즉시 파기 의무).
   *
   * 원아를 삭제·퇴소시켜도 서버 명단만 바뀌고 교사 PC 의 갤러리 파일은 그대로
   * 남는다. 그 아이는 목록에서 사라지므로 화면의 「얼굴 정보 파기」 버튼도 붙지
   * 않아, 손으로 지울 방법이 없어진다. 그래서 여기서 대조해 정리한다.
   *
   * ■ 지우는 것은 되돌릴 수 없다 — 아래 조건을 모두 만족할 때만 지운다
   *   1. 명단 조회가 성공했을 것 (로딩 중·에러면 아무것도 하지 않는다)
   *   2. 명단이 비어 있지 않을 것 (빈 명단은 정상이 아니라 사고 신호로 본다)
   *   3. **기관 전체 재원 명단**과 대조할 것 — 선택한 반(kids)으로 비교하면
   *      반을 옮긴 아이가 퇴소로 오인되어 삭제된다
   *   4. 조용히 지우지 않을 것 — 몇 명을 지웠는지 알린다
   */
  const purgedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!classKey) return;
    if (rosterQuery.isLoading || rosterQuery.isError) return; // 조건 1
    if (roster.length === 0) return; // 조건 2
    if (gallery.loading) return;

    const enrolled = roster.map((c) => c.id); // 조건 3 — 반이 아니라 기관 전체
    // 명단이 바뀌면 다시 검사한다(앱을 켜 둔 채 퇴소 처리한 경우)
    const signature = `${classKey}|${enrolled.slice().sort().join(",")}`;
    if (purgedRef.current === signature) return;
    purgedRef.current = signature; // 비동기 전에 먼저 찍어 중복 실행을 막는다

    const known = new Set(enrolled);
    const orphans = gallery
      .entries()
      .map((e) => e.child_id)
      .filter((id) => !known.has(id));
    if (orphans.length === 0) return;

    void gallery.forgetMany(orphans).then(() => {
      toast(`퇴소·삭제된 아이 ${orphans.length}명의 얼굴 정보를 파기했습니다`); // 조건 4
    });
  }, [classKey, roster, rosterQuery.isLoading, rosterQuery.isError, gallery, toast]);

  // 얼굴인식 서버가 떠 있는지 미리 확인한다 — 사진을 다 고른 뒤에 알게 되면 늦다
  useEffect(() => {
    let cancelled = false;
    faceHealth()
      .then((h) => {
        if (!cancelled)
          setServerDown(h.ok ? null : "모델이 아직 로드되지 않았습니다.");
      })
      .catch((e) => {
        if (cancelled) return;
        setServerDown(
          e instanceof ApiError
            ? e.message
            : "얼굴인식 서버에 연결할 수 없습니다.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHead
        title="사진함"
        sub={
          tab === "classify"
            ? "사진 올리기 → 아이별 자동 분류 → 선택 내보내기"
            : tab === "enroll"
              ? "아이별 사진 3~5장 → 반 갤러리 (임베딩은 이 PC에만 저장됩니다)"
              : "정해 둔 사진 폴더를 아이별·날짜별로 훑어봅니다 — 분류하지 않습니다"
        }
      />
      <SpecBar
        scr="SCR-005"
        fn={["FN-006"]}
        ep={[
          "POST /api/face/enroll",
          "POST /api/face/classify",
          "EP-018 수동 지정",
          "EP-019 내보내기",
        ]}
      />

      <div className="stack">
        {serverDown && (
          <Notice kind="warn">
            ⚠{" "}
            <span>
              {serverDown} 개발 중이라면 백엔드 저장소에서{" "}
              <code>uvicorn ml.server.app:app --reload</code> 로 서버를 띄우고,{" "}
              <code>.env.local</code> 의{" "}
              <code>NEXT_PUBLIC_FACE_API_BASE_URL</code> 을 확인하세요.
            </span>
          </Notice>
        )}

        {!gallery.persistent && (
          <Notice kind="warn">
            <ShieldAlert size={14} className="mr-1 inline" />
            <span>
              <b>이 환경에서는 갤러리가 저장되지 않습니다.</b> 새로고침하거나 앱을
              닫으면 등록한 얼굴이 모두 사라집니다 — 데스크톱 앱에{" "}
              <code>desktop.face</code> 채널을 붙이기 전까지는 시험용으로만
              쓰세요.
            </span>
          </Notice>
        )}

        {gallery.error && (
          <Notice kind="warn">
            ⚠ <span>{gallery.error}</span>
          </Notice>
        )}

        {/* 사진 폴더 — 두 탭과 놀이이야기가 함께 쓰는 한 자리 */}
        <PhotoFolderBar
          root={photoRoot}
          hint="분류한 사진을 내보낼 곳이자, 폴더 보기가 훑을 곳입니다. 한 번 정하면 앱이 기억합니다."
        />

        {/* ---------------- 반 · 갤러리 상태 · 탭 ---------------- */}
        <div className="card">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
            <div className="w-[170px]">
              <div className="mb-2 text-[12.5px] font-bold text-muted">
                <N n={1} /> 반
              </div>
              {rosterQuery.isLoading ? (
                <Skeleton lines={1} />
              ) : rosterQuery.isError ? (
                <QueryError onRetry={() => rosterQuery.refetch()} />
              ) : (
                <Select
                  value={className}
                  onChange={setClassName}
                  options={classNames}
                  ariaLabel="반 선택"
                  placeholder="반 선택"
                />
              )}
            </div>

            <div className="flex-1 text-[13px]">
              {gallery.loading ? (
                <span className="text-muted">갤러리 불러오는 중…</span>
              ) : (
                <span className="text-muted">
                  얼굴 등록 <b className="text-ink">{enrolledCount}</b> /{" "}
                  {kids.length}명
                  {gallery.size > 0 && (
                    <>
                      {" · "}요청당 약{" "}
                      {Math.round((gallery.gallery?.approxBytes ?? 0) / 1024)}KB
                      전송
                    </>
                  )}
                  {gallery.saving && " · 저장 중…"}
                </span>
              )}
            </div>

            <div className="seg">
              <button
                className={tab === "classify" ? "on" : ""}
                onClick={() => setTab("classify")}
              >
                <Camera size={14} className="mr-1.5 inline" />
                사진 분류
              </button>
              <button
                className={tab === "enroll" ? "on" : ""}
                onClick={() => setTab("enroll")}
              >
                <ScanFace size={14} className="mr-1.5 inline" />
                얼굴 등록
              </button>
              <button
                className={tab === "browse" ? "on" : ""}
                onClick={() => setTab("browse")}
              >
                <Images size={14} className="mr-1.5 inline" />
                폴더 보기
              </button>
            </div>
          </div>

          {/* 폴더 보기는 갤러리를 쓰지 않으므로 이 경고가 붙을 자리가 아니다 */}
          {tab !== "browse" && !gallery.loading && gallery.size === 0 && (
            <div className="mt-4">
              <Notice kind="warn">
                ⚠{" "}
                <span>
                  이 반에 등록된 얼굴이 없어 분류할 수 없습니다 —{" "}
                  <button
                    className="font-bold underline"
                    onClick={() => setTab("enroll")}
                  >
                    얼굴 등록
                  </button>
                  부터 해주세요.
                </span>
              </Notice>
            </div>
          )}

          {unassigned > 0 && (
            <div className="mt-2">
              <Notice kind="soft">
                <span>
                  반이 지정되지 않은 아이 {unassigned}명은 여기 보이지 않습니다 —
                  갤러리를 반 단위로 나누기 때문입니다. 아동 관리에서 반을 지정해
                  주세요.
                </span>
              </Notice>
            </div>
          )}
        </div>

        {/*
          탭은 감추기만 한다 — 언마운트하면 올린 사진과 분류 결과가 날아간다.
          두 패널이 같은 gallery 인스턴스를 받으므로 등록 즉시 분류 쪽에 반영된다.
        */}
        <div hidden={tab !== "classify"}>
          <ClassifyPanel kids={kids} gallery={gallery} photoRoot={photoRoot} />
        </div>
        <div hidden={tab !== "enroll"}>
          <EnrollPanel kids={kids} gallery={gallery} />
        </div>
        {/*
          폴더 보기는 반·갤러리와 무관하다 — 고른 폴더를 그냥 보여 줄 뿐이라
          kids 도 gallery 도 받지 않는다.
        */}
        <div hidden={tab !== "browse"}>
          <FolderPanel photoRoot={photoRoot} />
        </div>
      </div>
    </>
  );
}
