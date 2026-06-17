import { describe, it, expect } from "vitest";
import { channelName } from "@/shared/realtime/channel";

describe("channelName", () => {
  it("prefixes the public id with 'proposal:'", () => {
    expect(channelName("AbC123de")).toBe("proposal:AbC123de");
  });
  it("is stable for the same id", () => {
    expect(channelName("x")).toBe(channelName("x"));
  });
});
