import { zipStream, type ZipEntry } from "@/shared/lib/zip";
import type { OfflinePackagePlan } from "./offline-package";

// 오프라인 패키지를 브라우저에서 조립해 내려받는다.
//
// 이미지는 서버를 거치지 않고 스토리지에서 직접 받는다(proposals 버킷이 public이고
// CORS가 열려 있다). 그래서 Vercel 함수는 설계도만 주고 1초 안에 끝나며, 이미지 바이트가
// Vercel 대역폭을 전혀 쓰지 않는다. 덤으로 몇 장 받았는지 알 수 있어 진행률을 띄운다.
//
// ZIP은 "쓰는" 순서가 고정이지만(바이트 스트림이라) "받는" 순서는 상관없다. 그래서
// zipStream이 한 장씩 당겨가는 동안, 뒤쪽 이미지를 미리 받아둔다 → 대기시간이
// N×왕복에서 (N/WINDOW)×왕복으로 줄어든다.

// 동시에 받아둘 이미지 수. 무제한으로 열지 않는 이유는 스토리지가 셀프호스팅이라
// 페이지 수백 장짜리 시안에서 요청이 한꺼번에 몰리면 그 부하를 그대로 받기 때문이다.
const FETCH_WINDOW = 6;

export class DownloadAbortedError extends Error {
  constructor() {
    super("DOWNLOAD_ABORTED");
    this.name = "DownloadAbortedError";
  }
}

async function fetchImage(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("IMAGE_FETCH_FAILED");
  return new Uint8Array(await res.arrayBuffer());
}

async function streamToBlob(stream: ReadableStream<Uint8Array>): Promise<Blob> {
  const parts: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  return new Blob(parts as BlobPart[], { type: "application/zip" });
}

export async function downloadOfflinePackage(
  proposalId: string,
  opts: {
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<void> {
  const { signal, onProgress } = opts;

  const res = await fetch(`/api/proposals/${proposalId}/export`, { signal });
  if (!res.ok) throw new Error("EXPORT_FAILED");
  const plan: OfflinePackagePlan = await res.json();

  let done = 0;
  const inflight = new Map<number, Promise<Uint8Array>>();

  function start(i: number) {
    if (i >= plan.files.length || inflight.has(i)) return;
    // signal을 fetch까지 내려보내야 취소가 실제로 통신을 끊는다 — UI만 닫는 게 아니다.
    const pending = fetchImage(plan.files[i].url, signal).then((bytes) => {
      onProgress?.(++done, plan.files.length);
      return bytes;
    });
    // 앞선 장이 먼저 실패하거나 취소되면 뒤쪽 장들은 await되지 않은 채 남는다 —
    // 미처리 거부 경고를 막으려고 여기서 한 번 삼킨다. 원래 promise는 그대로라
    // await하면 정상적으로 throw한다.
    pending.catch(() => {});
    inflight.set(i, pending);
  }

  const entries: ZipEntry[] = [
    // index.html을 맨 앞에 둬서 압축을 풀지 않고 열어봐도 먼저 보이게 한다.
    { name: "index.html", load: async () => new TextEncoder().encode(plan.html) },
    ...plan.files.map((file, i) => ({
      name: file.name,
      load: async () => {
        // 지금 필요한 장 + 뒤이어 쓸 WINDOW장을 미리 띄워둔다.
        for (let k = i; k <= i + FETCH_WINDOW; k++) start(k);
        const bytes = await inflight.get(i)!;
        inflight.delete(i); // 다 쓴 항목은 지워 맵이 계속 커지지 않게 한다.
        return bytes;
      },
    })),
  ];

  let blob: Blob;
  try {
    blob = await streamToBlob(zipStream(entries));
  } catch (error) {
    // 취소는 실패가 아니다 — 호출부가 다른 메시지를 보여줄 수 있게 구분해서 던진다.
    if (signal?.aborted) throw new DownloadAbortedError();
    throw error;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = plan.filename;
  a.click();
  // 즉시 해제하면 일부 브라우저에서 다운로드가 취소된다 — 다음 태스크로 미룬다.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
