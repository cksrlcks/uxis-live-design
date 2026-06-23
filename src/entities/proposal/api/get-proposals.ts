import { http } from "@/shared/api/http";
import { type Paginated, type Proposal } from "../model/types";

export function getProposals(page = 1, search = ""): Promise<Paginated<Proposal>> {
  const qs = new URLSearchParams({ page: String(page) });
  const term = search.trim();
  if (term) qs.set("q", term);
  return http<Paginated<Proposal>>(`/api/proposals?${qs}`);
}
