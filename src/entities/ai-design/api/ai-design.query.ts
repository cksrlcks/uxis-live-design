import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { fetchAiDesignDetail, fetchAiDesigns } from "./ai-design.api";
import type { AiDesignDetail, PaginatedAiDesigns } from "../model/types";

export const aiDesignQueries = {
  all: () => ["ai-designs"] as const,
  lists: () => [...aiDesignQueries.all(), "list"] as const,
  // 검색어가 없으면 기존 키([...,page]) 그대로 — 빈 검색은 키에 포함하지 않는다.
  list: (page = 1, search = "") =>
    queryOptions({
      queryKey: search
        ? [...aiDesignQueries.lists(), page, search]
        : [...aiDesignQueries.lists(), page],
      queryFn: () => fetchAiDesigns(page, search),
      placeholderData: keepPreviousData,
      // 현재 페이지에 'working' 행이 하나라도 있으면 3초마다 폴링, 전부 끝나면 중단.
      refetchInterval: (query) => {
        const data = query.state.data as PaginatedAiDesigns | undefined;
        return data?.items.some((d) => d.status === "working") ? 3000 : false;
      },
    }),
  details: () => [...aiDesignQueries.all(), "detail"] as const,
  detail: (id: string) =>
    queryOptions({
      queryKey: [...aiDesignQueries.details(), id],
      queryFn: () => fetchAiDesignDetail(id),
      // 아직 작업중이면 완료될 때까지 3초마다 폴링한다.
      refetchInterval: (query) => {
        const data = query.state.data as AiDesignDetail | undefined;
        return data?.status === "working" ? 3000 : false;
      },
    }),
};
