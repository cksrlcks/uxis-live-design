import { http } from "@/shared/api/http";
import type { AiDesignDetail, PaginatedAiDesigns } from "../model/types";

export function fetchAiDesigns(page = 1, search = ""): Promise<PaginatedAiDesigns> {
  const qs = new URLSearchParams({ page: String(page) });
  const term = search.trim();
  if (term) qs.set("q", term);
  return http<PaginatedAiDesigns>(`/api/admin/ai-designs?${qs}`);
}

export function fetchAiDesignDetail(id: string): Promise<AiDesignDetail> {
  return http<AiDesignDetail>(`/api/admin/ai-designs/${id}`);
}

export function createAiDesignReq(body: {
  title: string;
  company?: string | null;
  pageType: string;
  optionIds: string[];
  extraNotes?: string | null;
}): Promise<{ id: string }> {
  return http<{ id: string }>("/api/admin/ai-designs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteAiDesignReq(id: string): Promise<void> {
  return http<void>(`/api/admin/ai-designs/${id}`, { method: "DELETE" });
}

export function retryAiDesignReq(id: string): Promise<void> {
  return http<void>(`/api/admin/ai-designs/${id}/retry`, { method: "POST" });
}
