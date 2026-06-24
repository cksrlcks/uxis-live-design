import { http } from "@/shared/api/http";
import { type Paginated, type ProposalListItem } from "../model/types";

export function getProposals(page = 1, search = ""): Promise<Paginated<ProposalListItem>> {
  const qs = new URLSearchParams({ page: String(page) });
  const term = search.trim();
  if (term) qs.set("q", term);
  return http<Paginated<ProposalListItem>>(`/api/proposals?${qs}`);
}
