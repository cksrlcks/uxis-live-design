import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { reactToAuthError } from "@/shared/auth/session-expiry";
import { HttpError } from "./http";

// 쿼리/뮤테이션 에러를 한 곳에서 받아, 401 세션 만료면 로그인으로 리다이렉트.
const onError = (error: unknown) => reactToAuthError(error);

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount: number, error: unknown) => {
          if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
