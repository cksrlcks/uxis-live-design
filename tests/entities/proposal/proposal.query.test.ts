import { describe, it, expect } from "vitest";
import { proposalQueries } from "@/entities/proposal";

describe("proposalQueries", () => {
  it("builds hierarchical query keys", () => {
    expect(proposalQueries.all()).toEqual(["proposals"]);
    expect(proposalQueries.lists()).toEqual(["proposals", "list"]);
  });

  it("list() returns queryOptions with a page-scoped key and a queryFn", () => {
    expect(proposalQueries.list().queryKey).toEqual(["proposals", "list", 1]);
    expect(proposalQueries.list(3).queryKey).toEqual(["proposals", "list", 3]);
    expect(typeof proposalQueries.list().queryFn).toBe("function");
  });

  it("appends the search term to the key only when non-empty", () => {
    expect(proposalQueries.list(1, "").queryKey).toEqual(["proposals", "list", 1]);
    expect(proposalQueries.list(2, "kim").queryKey).toEqual(["proposals", "list", 2, "kim"]);
  });
});
