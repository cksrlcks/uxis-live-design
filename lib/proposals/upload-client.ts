"use client";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { PROPOSALS_BUCKET } from "@/lib/proposals/constants";

export type MeasuredFile = { file: File; width: number; height: number };
export type UploadSpec = { pageId: string; path: string; token: string; pageOrder: number };
export type ConfirmPage = { pageId: string; pageOrder: number; path: string; width: number; height: number };

export async function measureImage(file: File): Promise<MeasuredFile> {
  const bitmap = await createImageBitmap(file);
  const measured = { file, width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return measured;
}

export async function measureAll(files: File[]): Promise<MeasuredFile[]> {
  return Promise.all(files.map(measureImage));
}

// Upload each file to its signed URL, returning the confirm payload (pageOrder maps to measured[]).
export async function uploadAll(uploads: UploadSpec[], measured: MeasuredFile[]): Promise<ConfirmPage[]> {
  const supabase = createSupabaseBrowser();
  const pages: ConfirmPage[] = [];
  for (const u of uploads) {
    const m = measured[u.pageOrder];
    const { error } = await supabase.storage.from(PROPOSALS_BUCKET).uploadToSignedUrl(u.path, u.token, m.file);
    if (error) throw new Error(`upload failed (page ${u.pageOrder + 1}): ${error.message}`);
    pages.push({ pageId: u.pageId, pageOrder: u.pageOrder, path: u.path, width: m.width, height: m.height });
  }
  return pages;
}
