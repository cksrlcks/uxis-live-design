// 캔버스 첫 진입 시 모든 페이지(가로 한 줄 strip 전체)가 뷰포트 안에 들어오도록
// 가로·세로 둘 다 fit 되는 줌 배율을 계산한다.
//
// - 가로/세로 중 더 빡빡한 쪽에 맞춰(min) strip 전체가 보이게 한다. 세로까지
//   fit 하므로 콘텐츠가 위로 넘쳐 상단이 잘리는 일이 없다.
// - margin: 1보다 작게 두어 가장자리에 약간의 여백을 남긴다(0.9 = 상하좌우 ~5%).
// - maxScale 기본 1: 콘텐츠가 작아도 100%를 넘겨 확대하지 않는다(스크린샷 뭉개짐 방지).
export function computeFitScale({
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
  margin = 0.9,
  minScale = 0.1,
  maxScale = 1,
}: {
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
  minScale?: number;
  maxScale?: number;
}): number {
  // 아직 레이아웃 전이라 크기를 못 잰 경우 안전한 최소 배율로 반환한다.
  if (contentWidth <= 0 || contentHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return minScale;
  }
  const fit = Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight) * margin;
  return Math.min(maxScale, Math.max(minScale, fit));
}
