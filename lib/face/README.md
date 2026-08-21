# lib/face — 얼굴인식 연동 모듈

화면에서 쓸 API 호출과 갤러리 관리를 담는다. **UI 컴포넌트는 들어 있지 않다**
(상태 훅 `useGallery`는 등록·분류 화면이 같은 갤러리를 봐야 해서 여기 둔다).

담당: 손승현(ml) · 서버 규약 정본: 백엔드 저장소 `ml/pipeline/INTERFACE.md` v2.1

---

## 알아야 할 전제 하나

**얼굴 임베딩은 서버 DB에 저장되지 않는다.** 서버는 추론만 하고 응답 후 사진·임베딩을
폐기한다. 임베딩(갤러리)은 **클라이언트가 보관**하고, 분류 요청마다 함께 보낸다.

```
[등록] 사진 3~5장 ──▶ 서버 ──임베딩──▶ 앱이 갤러리에 보관
[분류] 사진 1장 + 갤러리 ──▶ 서버 ──matched[]──▶ 앱이 사진함 배정
```

그래서 **갤러리가 없으면 분류가 아예 안 된다.** 갤러리 보관·백업이 화면 설계에서
빠지면 교사가 앱을 다시 깔 때 반 전체를 재등록해야 한다.

---

## 설정

개발 중 얼굴인식 서버를 내 PC에서 따로 띄웠다면 `.env.local`에:

```
NEXT_PUBLIC_FACE_API_BASE_URL=http://127.0.0.1:8000
```

**배포 시에는 비워둔다.** 그러면 `lib/api/client`의 `api` 래퍼를 타고 팀 백엔드로 가며,
Bearer 토큰 부착과 401 자동 갱신을 그대로 물려받는다.

서버 띄우는 법(백엔드 저장소에서):

```bash
uvicorn ml.server.app:app --reload      # http://127.0.0.1:8000/docs
```

---

## 1. 아이 등록

```ts
import { enrollChild, ClassGallery } from "@/lib/face";

const gallery = new ClassGallery();

const res = await enrollChild(files);           // files: File[] (3~5장 권장)
if (res.status === "ok" && res.embedding) {
  gallery.set(childId, res.embedding);
  await store.save(classId, gallery.toEntries());
}
```

- `res.used` / `res.skipped` 를 화면에 보여주면 좋다. 얼굴이 안 잡힌 사진이 몇 장인지 알려준다
- **3~5장을 채우게 유도할 것.** 실측에서 1~2장만 등록한 아이는 유사도가 눈에 띄게 낮았다
- 사진마다 **가장 큰 얼굴**을 그 아이로 간주한다. 여러 명 나온 사진은 피하도록 안내

## 2. 사진 분류

```ts
import { classifyPhotos } from "@/lib/face";

const outcomes = await classifyPhotos(files, gallery.toEntries(), {
  thresh: 0.35,
  onProgress: (p) => setProgress(p),        // { done, total, current, ok, failed }
  signal: abortController.signal,
});

for (const { file, result, error } of outcomes) {
  if (error) continue;                       // 실패한 장만 따로 재시도
  for (const m of result!.matched) {
    assignToChild(m.child_id, file);         // 1장 = 여러 아이
  }
}
```

- **사진 1장당 1요청**이고 약 1초 걸린다. 100장이면 100초 → 진행률 표시가 사실상 필수다
- 개별 사진 실패는 전체를 중단시키지 않는다. `error`가 있는 항목만 재시도하면 된다
- `result.matched`가 비어 있으면 `status`가 `"unmatched"` — 미분류함으로 보낸다

## 3. 교사 검수 · 점진적 등록 (EP-018)

```ts
// classify 응답의 unmatched[i].embedding 을 그대로 쓴다 — 서버 왕복 없음
gallery.set(childId, unmatchedFace.embedding);
await store.save(classId, gallery.toEntries());
```

미분류 얼굴을 `bbox`로 잘라 보여주고 교사가 아이를 지정하면, **네트워크 요청 없이**
갤러리에 반영된다. 쓸수록 정확해지는 동작이 여기서 나온다.

---

## 갤러리 저장 — 지금은 휘발이다

```ts
import { createGalleryStore } from "@/lib/face";

const store = createGalleryStore();
if (!store.persistent) {
  // 새로고침하면 갤러리가 사라진다. 화면에 경고를 띄우는 것이 좋다.
}
```

`createGalleryStore()`는 Electron에 `face` 채널이 있으면 암호화 저장소를, 없으면
메모리 저장소를 준다. **현재 `electron/preload.js`에는 `templates` 채널만 있어서
항상 메모리(휘발)로 동작한다.**

### 지켜야 할 것

- **localStorage·sessionStorage에 임베딩을 넣지 말 것.** 얼굴 임베딩은 개인정보보호법상
  민감정보(생체인식정보)라 평문 저장은 요건 위반이다
- 임베딩을 콘솔·로그·에러리포트에 출력하지 말 것
- 갤러리는 **반 단위**로 유지할 것. 원 전체를 한 갤러리에 넣으면 오배정이 급증한다
  (실측: 15명 오배정 0% → 100명 1.46%)

### 실제 저장을 붙이려면

`electron/main.js` + `preload.js`에 `desktop.face` 채널을 추가해야 한다.
필요한 시그니처는 `gallery.ts`의 `DesktopFaceBridge` 타입에 정의해뒀다.

암·복호화는 백엔드 저장소의 `ml/pipeline/crypto.py`(AES-256-GCM)가 담당하고,
키는 `safeStorage`로 OS 키체인에 보관한다. 상세 규약은 `INTERFACE.md` 7-2절.

---

## 참고 — 알아두면 좋은 수치

| 항목 | 값 |
|---|---|
| 사진 1장 처리 | 약 1초 (서버 CPU 추론 + 왕복) |
| 갤러리 전송량 | 반 20명 기준 약 55KB / 요청 |
| 임베딩 1개 | base64 약 2.7KB |
| 등록 사진 | 아이당 3~5장 권장, 최대 10장 |

`resizeImage()`로 업로드 전 축소가 가능하지만 **기본값은 원본 전송**이다.
1600px로 줄여도 검출 수는 같았으나 유사도가 미세하게 낮아져 임계값 경계의 1건이
뒤집힌 적이 있다. 임계값이 확정되기 전까지는 원본을 보내는 편이 안전하다.

## 아직 미확정

**임계값.** 현재 서버 기본값은 0.35이지만, 실제 사진 테스트에서는 오배정을 막으려고
0.60까지 올려본 상태다. 그 대가로 정상 매칭도 함께 잘려나가고 있어서 재조정이 필요하다.
화면에서는 값을 하드코딩하지 말고 `thresh` 옵션으로 넘길 수 있게 열어두는 편이 좋다.
