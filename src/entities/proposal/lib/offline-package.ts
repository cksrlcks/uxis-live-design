import { buildOfflineHtml, type OfflineVariant } from "./offline-html";
import type { ProposalPage } from "../model/types";

// 오프라인 패키지의 "설계도": index.html 내용 + zip 안 경로 ↔ 원본 이미지 URL 매핑.
//
// 서버는 이 설계도만 만들어 내려주고, 이미지를 직접 받지 않는다. 실제 이미지 다운로드와
// zip 조립은 브라우저가 한다(download-offline-package.ts). 그래야 이미지 바이트가
// Vercel 함수를 통과하지 않아 대역폭·실행시간을 쓰지 않는다. proposals 버킷이 public이고
// CORS가 열려 있어 브라우저가 스토리지에서 직접 받을 수 있다.

export type OfflinePackagePlan = {
  // 사용자가 받게 될 zip 파일명.
  filename: string;
  // zip에 index.html로 들어갈 내용.
  html: string;
  // zip 내부 경로 → 받아올 원본 이미지 URL.
  files: { name: string; url: string }[];
};

export type OfflineSourceVariant = { slug: string; label: string; pages: ProposalPage[] };

// 파일명으로 못 쓰는 문자를 걷어낸다. 한글은 그대로 둔다(ZIP 파일명은 UTF-8).
export function safeName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

export function extFromUrl(url: string): string {
  return url.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1].toLowerCase() ?? "png";
}

export function buildOfflinePackagePlan(
  title: string,
  variants: OfflineSourceVariant[],
): OfflinePackagePlan {
  const files: { name: string; url: string }[] = [];

  const offlineVariants: OfflineVariant[] = variants.map((variant, i) => {
    // 안 이름이 겹치거나 비어도 폴더가 충돌하지 않게 순번을 앞에 붙인다.
    const dir = `img/${i + 1}-${safeName(variant.slug || variant.label, "variant")}`;
    const width = Math.max(2, String(variant.pages.length).length);

    const pages = variant.pages.map((page, p) => {
      const name = `${dir}/${String(p + 1).padStart(width, "0")}.${extFromUrl(page.url)}`;
      files.push({ name, url: page.url });
      return { file: name, width: page.width, height: page.height };
    });

    return { label: variant.label, pages };
  });

  return {
    filename: `${safeName(title, "proposal")}.zip`,
    html: buildOfflineHtml(title, offlineVariants),
    files,
  };
}
