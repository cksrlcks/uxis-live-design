import "server-only";
import { getProposalDetail } from "./get-proposal-detail.server";
import { buildOfflineHtml, type OfflineVariant } from "../lib/offline-html";
import { zipStream, type ZipEntry } from "@/shared/lib/zip";

// 시안을 오프라인 패키지(zip)로 만든다: index.html + img/ 폴더.
// 압축을 풀고 index.html을 더블클릭하면 서버 없이 바로 열린다.
//
// 담는 범위는 각 안(variant)의 "현재 버전" 페이지만 — 온라인 뷰어의 기본 화면과 같다.
// 버전 히스토리는 담지 않는다(용량이 버전 수만큼 배로 늘어난다).

// 파일명으로 못 쓰는 문자를 걷어낸다. 한글은 그대로 둔다(ZIP 파일명은 UTF-8).
function safeName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function extFromUrl(url: string): string {
  return url.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1].toLowerCase() ?? "png";
}

async function fetchImage(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("OBJECT_MISSING");
  return new Uint8Array(await res.arrayBuffer());
}

export async function exportProposalOffline(
  id: string,
): Promise<{ filename: string; body: ReadableStream<Uint8Array> }> {
  // requireEditor()를 포함하므로 권한 검사가 그대로 따라온다.
  const { proposal, variants } = await getProposalDetail(id);

  const entries: ZipEntry[] = [];
  const offlineVariants: OfflineVariant[] = variants.map((variant, i) => {
    // 안 이름이 겹치거나 비어도 폴더가 충돌하지 않게 순번을 앞에 붙인다.
    const dir = `img/${i + 1}-${safeName(variant.slug || variant.label, "variant")}`;
    const width = Math.max(2, String(variant.pages.length).length);

    const pages = variant.pages.map((page, p) => {
      const file = `${dir}/${String(p + 1).padStart(width, "0")}.${extFromUrl(page.url)}`;
      entries.push({ name: file, load: () => fetchImage(page.url) });
      return { file, width: page.width, height: page.height };
    });

    return { label: variant.label, pages };
  });

  const html = buildOfflineHtml(proposal.title, offlineVariants);
  // index.html을 맨 앞에 둬서 압축을 풀지 않고 열어봐도 먼저 보이게 한다.
  entries.unshift({
    name: "index.html",
    load: async () => new TextEncoder().encode(html),
  });

  return {
    filename: `${safeName(proposal.title, "proposal")}.zip`,
    body: zipStream(entries),
  };
}
