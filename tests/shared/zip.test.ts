import { describe, it, expect } from "vitest";
import { crc32, zipStream, type ZipEntry } from "@/shared/lib/zip";

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// central directory를 읽어 엔트리를 되꺼내는 최소 unzip — 실제 압축 해제 도구가
// ZIP을 읽는 경로(EOCD → central directory → local header 오프셋)를 그대로 따라간다.
function unzip(buf: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const decoder = new TextDecoder();

  let eocd = buf.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  expect(eocd).toBeGreaterThanOrEqual(0);

  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);

  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(buf.subarray(at + 46, at + 46 + nameLen));

    expect(view.getUint32(offset, true)).toBe(0x04034b50);
    expect(view.getUint16(offset + 8, true)).toBe(0); // stored
    const localNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const start = offset + 30 + localNameLen + extraLen;
    const data = buf.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);

    files.set(name, data);
    at += 46 + nameLen + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return files;
}

describe("crc32", () => {
  it("matches the standard CRC-32 check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("zipStream", () => {
  it("writes entries an unzipper can read back", async () => {
    const html = new TextEncoder().encode("<html>시안</html>");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);
    const entries: ZipEntry[] = [
      { name: "index.html", load: async () => html },
      { name: "img/1-안-가/01.png", load: async () => png },
    ];

    const files = unzip(await collect(zipStream(entries)));

    expect([...files.keys()]).toEqual(["index.html", "img/1-안-가/01.png"]);
    expect(files.get("index.html")).toEqual(html);
    expect(files.get("img/1-안-가/01.png")).toEqual(png);
  });

  it("handles an empty archive", async () => {
    expect(unzip(await collect(zipStream([]))).size).toBe(0);
  });

  it("errors the stream when an entry fails to load", async () => {
    const stream = zipStream([
      {
        name: "boom.png",
        load: async () => {
          throw new Error("IMAGE_FETCH_FAILED");
        },
      },
    ]);
    await expect(collect(stream)).rejects.toThrow("IMAGE_FETCH_FAILED");
  });
});
