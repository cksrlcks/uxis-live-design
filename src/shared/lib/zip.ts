// 무압축(stored) ZIP 라이터.
//
// 압축하지 않는 이유: 담는 내용이 PNG/JPEG/WebP 이미지라 이미 압축된 바이트다.
// deflate를 걸어도 이득이 사실상 0이므로, 압축 라이브러리(jszip/fflate 등)를 새로
// 들이는 대신 컨테이너 포맷만 직접 쓴다.
//
// 스트리밍이라 엔트리를 하나씩 읽어 흘려보낸다 — 시안 전체(수백 MB)를 서버 메모리에
// 통째로 올리지 않는다. 각 엔트리는 load()로 지연 로딩되고, 다 쓰면 참조가 끊긴다.
//
// ponytail: ZIP64 미지원 — 개별 파일 4GB 또는 전체 4GB를 넘으면 오프셋이 32비트를
// 넘어 깨진다. 시안 이미지는 장당 25MB 상한이라 현실적으로 안 걸린다. 걸리기 시작하면
// ZIP64 end-of-central-directory 레코드를 추가해야 한다.

export type ZipEntry = {
  // ZIP 내부 경로. 디렉터리 구분은 항상 "/".
  name: string;
  load: () => Promise<Uint8Array>;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ZIP은 1980년 기준 DOS 날짜/시간(각 2바이트)을 쓴다.
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// UTF-8 파일명을 쓴다고 알리는 general purpose 플래그(bit 11).
const FLAG_UTF8 = 0x0800;

function localHeader(
  name: Uint8Array,
  crc: number,
  size: number,
  time: number,
  date: number,
): Uint8Array {
  const buf = new Uint8Array(30 + name.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x04034b50, true); // local file header signature
  view.setUint16(4, 20, true); // version needed (2.0 = stored/deflate)
  view.setUint16(6, FLAG_UTF8, true);
  view.setUint16(8, 0, true); // compression method: 0 = stored
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true); // compressed size == uncompressed (stored)
  view.setUint32(22, size, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true); // extra field length
  buf.set(name, 30);
  return buf;
}

function centralHeader(
  name: Uint8Array,
  crc: number,
  size: number,
  offset: number,
  time: number,
  date: number,
): Uint8Array {
  const buf = new Uint8Array(46 + name.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x02014b50, true); // central directory header signature
  view.setUint16(4, 20, true); // version made by
  view.setUint16(6, 20, true); // version needed
  view.setUint16(8, FLAG_UTF8, true);
  view.setUint16(10, 0, true); // stored
  view.setUint16(12, time, true);
  view.setUint16(14, date, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, name.length, true);
  // extra(30) / comment(32) / disk(34) / internal attrs(36) / external attrs(38) 모두 0
  view.setUint32(42, offset, true); // 이 엔트리의 local header 오프셋
  buf.set(name, 46);
  return buf;
}

function endOfCentralDirectory(count: number, cdSize: number, cdOffset: number): Uint8Array {
  const buf = new Uint8Array(22);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x06054b50, true); // EOCD signature
  view.setUint16(8, count, true); // entries on this disk
  view.setUint16(10, count, true); // total entries
  view.setUint32(12, cdSize, true);
  view.setUint32(16, cdOffset, true);
  // disk numbers(4,6)과 comment length(20)는 0
  return buf;
}

// 엔트리들을 순서대로 읽어 ZIP 바이트를 흘려보낸다.
// load()가 실패하면 스트림을 error 처리한다 — 잘린 ZIP을 정상 다운로드인 척
// 내려보내는 대신, 브라우저가 실패한 다운로드로 처리하게 한다.
export function zipStream(entries: ZipEntry[], now = new Date()): ReadableStream<Uint8Array> {
  const { time, date } = dosDateTime(now);
  const encoder = new TextEncoder();
  const central: Uint8Array[] = [];
  let offset = 0;
  let i = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (i < entries.length) {
          const entry = entries[i++];
          const name = encoder.encode(entry.name);
          const data = await entry.load();
          const crc = crc32(data);

          const header = localHeader(name, crc, data.length, time, date);
          controller.enqueue(header);
          controller.enqueue(data);

          central.push(centralHeader(name, crc, data.length, offset, time, date));
          offset += header.length + data.length;
          return;
        }

        const cdSize = central.reduce((sum, c) => sum + c.length, 0);
        for (const c of central) controller.enqueue(c);
        controller.enqueue(endOfCentralDirectory(central.length, cdSize, offset));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
