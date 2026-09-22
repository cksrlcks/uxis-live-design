import { zipStream, type ZipEntry } from "@/shared/lib/zip";
import type { OfflinePackagePlan } from "./offline-package";

// 오프라인 패키지를 브라우저에서 조립해 내려받는다.
//
// 이미지는 서버를 거치지 않고 스토리지에서 직접 받는다(proposals 버킷이 public이고
// CORS가 열려 있다). 그래서 Vercel 함수는 설계도만 주고 1초 안에 끝나며, 이미지 바이트가
// Vercel 대역폭을 전혀 쓰지 않는다. 덤으로 몇 장 받았는지 알 수 있어 진행률을 띄운다.
//
// ponytail: 이미지를 한 장씩 순차로 받는다(zipStream이 엔트리를 순서대로 당겨간다).
// 페이지가 아주 많아 체감이 느려지면 미리 병렬로 받아두고 load()는 그걸 꺼내 쓰게 바꾸면 된다.

async function fetchImage(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
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
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const res = await fetch(`/api/proposals/${proposalId}/export`);
  if (!res.ok) throw new Error("EXPORT_FAILED");
  const plan: OfflinePackagePlan = await res.json();

  let done = 0;
  const entries: ZipEntry[] = [
    // index.html을 맨 앞에 둬서 압축을 풀지 않고 열어봐도 먼저 보이게 한다.
    { name: "index.html", load: async () => new TextEncoder().encode(plan.html) },
    ...plan.files.map((file) => ({
      name: file.name,
      load: async () => {
        const bytes = await fetchImage(file.url);
        onProgress?.(++done, plan.files.length);
        return bytes;
      },
    })),
  ];

  const url = URL.createObjectURL(await streamToBlob(zipStream(entries)));
  const a = document.createElement("a");
  a.href = url;
  a.download = plan.filename;
  a.click();
  // 즉시 해제하면 일부 브라우저에서 다운로드가 취소된다 — 다음 태스크로 미룬다.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
