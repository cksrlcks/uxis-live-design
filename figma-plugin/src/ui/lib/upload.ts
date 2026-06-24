import type { ExportedImage } from '../../shared/messages';

export type FileMeta = { contentType: string; size: number };
export type Upload = { signedUrl: string; pageId: string; pageOrder: number; path: string };
export type ConfirmPage = {
  pageId: string;
  pageOrder: number;
  path: string;
  width: number;
  height: number;
};

export function filesMeta(images: ExportedImage[]): FileMeta[] {
  return images.map((im) => ({ contentType: im.contentType, size: im.bytes.byteLength }));
}

export function confirmPages(uploads: Upload[], images: ExportedImage[]): ConfirmPage[] {
  return uploads.map((u, i) => ({
    pageId: u.pageId,
    pageOrder: u.pageOrder,
    path: u.path,
    width: images[i].width,
    height: images[i].height,
  }));
}

// 이미지를 서명 URL(절대 URL, 토큰 포함)로 Supabase 에 직접 PUT.
export async function putToSignedUrl(signedUrl: string, img: ExportedImage): Promise<void> {
  let res: Response;
  try {
    res = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'content-type': img.contentType,
        'cache-control': 'max-age=3600',
        'x-upsert': 'false',
      },
      body: img.bytes,
    });
  } catch {
    throw new Error('UPLOAD_NETWORK');
  }
  if (!res.ok) throw new Error('UPLOAD_FAILED');
}

export async function uploadAll(
  uploads: Upload[],
  images: ExportedImage[],
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < uploads.length; i++) {
    onProgress(i + 1, uploads.length);
    await putToSignedUrl(uploads[i].signedUrl, images[i]);
  }
}
