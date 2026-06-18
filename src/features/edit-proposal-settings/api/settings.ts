import { http } from "@/shared/api/http";
import type { UpdateSettingsInput } from "@/entities/proposal/model/edit-schemas";

export function updateSettings(id: string, input: UpdateSettingsInput): Promise<void> {
  return http<void>(`/api/proposals/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteProposal(id: string): Promise<void> {
  return http<void>(`/api/proposals/${id}`, { method: "DELETE" });
}
