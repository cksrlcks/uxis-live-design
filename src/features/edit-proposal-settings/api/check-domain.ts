import { http } from "@/shared/api/http";

export function checkDomain(domain: string, excludeId: string): Promise<{ available: boolean }> {
  const qs = new URLSearchParams({ domain, exclude: excludeId });
  return http<{ available: boolean }>(`/api/proposals/domain-available?${qs}`);
}
