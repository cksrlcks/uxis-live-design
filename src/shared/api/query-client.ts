import { QueryClient } from "@tanstack/react-query";
import { HttpError } from "./http";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
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
