import { describe, it, expect } from "vitest";
import { updateRoleSchema } from "@/entities/user/model/role-schema";

describe("updateRoleSchema", () => {
  it("accepts the three valid roles", () => {
    expect(updateRoleSchema.safeParse({ role: "pending" }).success).toBe(true);
    expect(updateRoleSchema.safeParse({ role: "editor" }).success).toBe(true);
    expect(updateRoleSchema.safeParse({ role: "admin" }).success).toBe(true);
  });
  it("rejects an unknown role", () => {
    expect(updateRoleSchema.safeParse({ role: "superuser" }).success).toBe(false);
  });
  it("rejects a missing role", () => {
    expect(updateRoleSchema.safeParse({}).success).toBe(false);
  });
});
