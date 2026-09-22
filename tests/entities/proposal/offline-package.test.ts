import { describe, it, expect } from "vitest";
import {
  buildOfflinePackagePlan,
  safeName,
  extFromUrl,
} from "@/entities/proposal/lib/offline-package";

function page(url: string, pageOrder = 0) {
  return { id: `p${pageOrder}`, url, width: 1920, height: 1080, pageOrder };
}

describe("safeName", () => {
  it("파일명에 못 쓰는 문자를 걷어내고 한글은 남긴다", () => {
    expect(safeName('A안: 메인/서브*안<>|"?', "fallback")).toBe("A안 메인서브안");
  });

  it("남는 게 없으면 대체 이름을 쓴다", () => {
    expect(safeName("///", "proposal")).toBe("proposal");
    expect(safeName("   ", "proposal")).toBe("proposal");
  });
});

describe("extFromUrl", () => {
  it("확장자를 뽑고, 쿼리스트링은 무시한다", () => {
    expect(extFromUrl("https://x/a/b.png")).toBe("png");
    expect(extFromUrl("https://x/a/b.WEBP?width=640&quality=70")).toBe("webp");
    expect(extFromUrl("https://x/a/b.jpg#frag")).toBe("jpg");
  });

  it("확장자가 없으면 png로 둔다", () => {
    expect(extFromUrl("https://x/a/b")).toBe("png");
  });
});

describe("buildOfflinePackagePlan", () => {
  it("안별 폴더와 순번 파일명을 만든다", () => {
    const plan = buildOfflinePackagePlan("우리 시안", [
      {
        slug: "a-an",
        label: "A안",
        pages: [page("https://x/1.png", 0), page("https://x/2.jpg", 1)],
      },
      { slug: "b-an", label: "B안", pages: [page("https://x/3.webp", 0)] },
    ]);

    expect(plan.filename).toBe("우리 시안.zip");
    expect(plan.files).toEqual([
      { name: "img/1-a-an/01.png", url: "https://x/1.png" },
      { name: "img/1-a-an/02.jpg", url: "https://x/2.jpg" },
      { name: "img/2-b-an/01.webp", url: "https://x/3.webp" },
    ]);
  });

  it("안 이름(slug)이 같아도 폴더가 충돌하지 않는다", () => {
    const plan = buildOfflinePackagePlan("t", [
      { slug: "same", label: "A", pages: [page("https://x/1.png")] },
      { slug: "same", label: "B", pages: [page("https://x/2.png")] },
    ]);

    const dirs = plan.files.map((f) => f.name.split("/").slice(0, 2).join("/"));
    expect(new Set(dirs).size).toBe(2);
  });

  it("페이지가 100장을 넘으면 자릿수를 늘려 정렬 순서를 지킨다", () => {
    const pages = Array.from({ length: 100 }, (_, i) => page(`https://x/${i}.png`, i));
    const plan = buildOfflinePackagePlan("t", [{ slug: "v", label: "V", pages }]);

    expect(plan.files[0].name).toBe("img/1-v/001.png");
    expect(plan.files[99].name).toBe("img/1-v/100.png");
  });

  it("html에는 상대경로만 들어가고 원본 스토리지 URL은 새지 않는다", () => {
    const plan = buildOfflinePackagePlan("t", [
      { slug: "v", label: "V", pages: [page("https://storage.example/secret/1.png")] },
    ]);

    expect(plan.html).toContain("img/1-v/01.png");
    expect(plan.html).not.toContain("storage.example");
  });

  it("페이지가 없는 안도 빠지지 않는다", () => {
    const plan = buildOfflinePackagePlan("t", [{ slug: "v", label: "빈 안", pages: [] }]);

    expect(plan.files).toEqual([]);
    expect(plan.html).toContain("빈 안");
  });
});
