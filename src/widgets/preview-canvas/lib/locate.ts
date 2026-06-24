export type PageBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  pageOrder: number;
};
export type PinLocation = { pageOrder: number; xNorm: number; yNorm: number };

// 콘텐츠 좌표 (cx,cy)를 페이지 기준 정규화 좌표로 변환.
// 박스 안이면 그 페이지 기준(0..1), 어떤 박스에도 들지 않으면 가장 가까운 페이지를
// 기준으로 한다. 시안 밖 클릭도 핀을 찍을 수 있도록 정규화 좌표는 0..1 범위를 벗어날 수 있다.
export function locatePin(cx: number, cy: number, boxes: PageBox[]): PinLocation | null {
  const valid = boxes.filter((b) => b.width > 0 && b.height > 0);
  if (valid.length === 0) return null;

  for (const b of valid) {
    if (cx >= b.left && cx <= b.left + b.width && cy >= b.top && cy <= b.top + b.height) {
      return {
        pageOrder: b.pageOrder,
        xNorm: (cx - b.left) / b.width,
        yNorm: (cy - b.top) / b.height,
      };
    }
  }

  // 시안 밖 — 사각형까지의 거리가 최소인 페이지를 기준으로 삼는다.
  let best = valid[0];
  let bestDist = Infinity;
  for (const b of valid) {
    const dx = cx < b.left ? b.left - cx : cx > b.left + b.width ? cx - (b.left + b.width) : 0;
    const dy = cy < b.top ? b.top - cy : cy > b.top + b.height ? cy - (b.top + b.height) : 0;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return {
    pageOrder: best.pageOrder,
    xNorm: (cx - best.left) / best.width,
    yNorm: (cy - best.top) / best.height,
  };
}

// 정규화 좌표 → 박스 기준 콘텐츠 좌표(placePin은 locatePin의 역). 0..1 밖 값도 그대로
// 환산해 시안 밖 핀 위치를 재현한다.
export function placePin(box: PageBox, xNorm: number, yNorm: number): { x: number; y: number } {
  return { x: box.left + xNorm * box.width, y: box.top + yNorm * box.height };
}

export type AreaLocation = {
  pageOrder: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
};

// 드래그 두 점(콘텐츠 좌표)을 영역으로 변환. 시작점이 속한(또는 가장 가까운) 페이지를
// 기준으로 좌상단(min)·크기(abs)를 정규화한다. 드래그 방향과 무관하게 같은 박스를 만든다.
export function locateArea(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  boxes: PageBox[],
): AreaLocation | null {
  const start = locatePin(ax, ay, boxes);
  if (!start) return null;
  const box = boxes.find((b) => b.pageOrder === start.pageOrder && b.width > 0 && b.height > 0);
  if (!box) return null;
  const left = Math.min(ax, bx);
  const top = Math.min(ay, by);
  const w = Math.abs(bx - ax);
  const h = Math.abs(by - ay);
  return {
    pageOrder: box.pageOrder,
    xNorm: (left - box.left) / box.width,
    yNorm: (top - box.top) / box.height,
    wNorm: w / box.width,
    hNorm: h / box.height,
  };
}

// 정규화 영역 → 박스 기준 콘텐츠 좌표 사각형(placeArea는 locateArea의 역). 0..1 밖도 그대로.
export function placeArea(
  box: PageBox,
  xNorm: number,
  yNorm: number,
  wNorm: number,
  hNorm: number,
): { left: number; top: number; width: number; height: number } {
  const { x, y } = placePin(box, xNorm, yNorm);
  return { left: x, top: y, width: wNorm * box.width, height: hNorm * box.height };
}
