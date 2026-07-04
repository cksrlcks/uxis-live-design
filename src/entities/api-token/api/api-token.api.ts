import { http } from "@/shared/api/http";
import type { MyToken } from "../model/types";

export const getMyTokenReq = (): Promise<MyToken> => http<MyToken>("/api/admin/api-token");
export const regenerateTokenReq = (): Promise<{ token: string }> =>
  http<{ token: string }>("/api/admin/api-token", { method: "POST" });
export const revokeTokenReq = (): Promise<void> =>
  http<void>("/api/admin/api-token", { method: "DELETE" });
