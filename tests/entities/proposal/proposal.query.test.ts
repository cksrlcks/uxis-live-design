import { describe, it, expect } from "vitest";
import { proposalQueries } from "@/entities/proposal";

describe("proposalQueries", () => {
  it("builds hierarchical query keys", () => {
    expect(proposalQueries.all()).toEqual(["proposals"]);
    expect(proposalQueries.lists()).toEqual(["proposals", "list"]);
  });

  it("list() returns queryOptions with the list key and a queryFn", () => {
    const opts = proposalQueries.list();
    expect(opts.queryKey).toEqual(["proposals", "list"]);
    expect(typeof opts.queryFn).toBe("function");
  });
});
