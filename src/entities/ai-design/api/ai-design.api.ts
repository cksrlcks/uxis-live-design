import { http } from "@/shared/api/http";
import type { AiDesignListItem } from "../model/types";

export function fetchAiDesigns(): Promise<AiDesignListItem[]> {
  return http<AiDesignListItem[]>("/api/admin/ai-designs");
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
