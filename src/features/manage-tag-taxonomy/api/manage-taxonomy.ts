import { http } from "@/shared/api/http";
import type { TagGroup, TagOption } from "@/entities/tag";

export type GroupCreate = { code: string; label: string; description?: string | null; sortOrder?: number };
export type GroupUpdate = { label?: string; description?: string | null; sortOrder?: number };
export type OptionCreate = {
  groupId: string;
  code: string;
  label: string;
  description?: string | null;
  sortOrder?: number;
};
export type OptionUpdate = { label?: string; description?: string | null; sortOrder?: number };

export const createGroup = (input: GroupCreate) =>
  http<TagGroup>("/api/admin/tags/groups", { method: "POST", body: JSON.stringify(input) });
export const updateGroup = (id: string, input: GroupUpdate) =>
  http<void>(`/api/admin/tags/groups/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteGroup = (id: string) =>
  http<void>(`/api/admin/tags/groups/${id}`, { method: "DELETE" });

export const createOption = (input: OptionCreate) =>
  http<TagOption>("/api/admin/tags/options", { method: "POST", body: JSON.stringify(input) });
export const updateOption = (id: string, input: OptionUpdate) =>
  http<void>(`/api/admin/tags/options/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteOption = (id: string) =>
  http<void>(`/api/admin/tags/options/${id}`, { method: "DELETE" });
