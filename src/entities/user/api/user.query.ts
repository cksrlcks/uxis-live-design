import { queryOptions } from "@tanstack/react-query";
import { getUsers } from "./get-users";

export const userQueries = {
  all: () => ["users"] as const,
  lists: () => [...userQueries.all(), "list"] as const,
  list: () =>
    queryOptions({
      queryKey: userQueries.lists(),
      queryFn: getUsers,
    }),
};
