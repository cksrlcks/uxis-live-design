import { http } from "@/shared/api/http";
import type { Taxonomy } from "../model/types";

export function getTaxonomy(): Promise<Taxonomy> {
  return http<Taxonomy>("/api/tags/taxonomy");
}
