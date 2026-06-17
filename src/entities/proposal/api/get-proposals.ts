import { http } from "@/shared/api/http";
import type { Proposal } from "../model/types";

export function getProposals(): Promise<Proposal[]> {
  return http<Proposal[]>("/api/proposals");
}
