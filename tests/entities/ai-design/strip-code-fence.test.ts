import { describe, it, expect } from "vitest";
import { stripCodeFence } from "@/entities/ai-design/lib/strip-code-fence";

describe("stripCodeFence", () => {
  it("```html 펜스를 제거한다", () => {
    expect(stripCodeFence("```html\n<h1>hi</h1>\n```")).toBe("<h1>hi</h1>");
  });
  it("언어 없는 펜스도 제거한다", () => {
    expect(stripCodeFence("```\n<p>x</p>\n```")).toBe("<p>x</p>");
  });
  it("펜스가 없으면 trim만 한다", () => {
    expect(stripCodeFence("  <html></html>  ")).toBe("<html></html>");
  });
});
