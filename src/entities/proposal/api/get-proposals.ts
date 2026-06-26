import { http } from "@/shared/api/http";
import { type Paginated, type ProposalListItem } from "../model/types";

export function getProposals(
  page = 1,
  search = "",
  year?: number,
  visibility?: "public" | "private",
): Promise<Paginated<ProposalListItem>> {
  const qs = new URLSearchParams({ page: String(page) });
  const term = search.trim();
  if (term) qs.set("q", term);
  if (year !== undefined) qs.set("year", String(year));
  if (visibility) qs.set("visibility", visibility);
  return http<Paginated<ProposalListItem>>(`/api/proposals?${qs}`);
}
