import type { StrokeDTO, StoredStroke } from "../model/types";

// DB 레이어 row의 평탄화 입력 형태(서버 조회 결과를 이 모양으로 맞춰 넘긴다).
export type LayerRow = {
  variantId: string;
  versionId: string;
  pageOrder: number;
  authorId: string;
  authorName: string;
  authorColor: string;
  strokes: StoredStroke[];
  updatedAt: Date;
};

// 레이어 row들을 렌더용 획 단위(StrokeDTO[])로 펼친다. 각 획에 row의 작성자 신원·updatedAt 부여.
export function flattenLayers(rows: LayerRow[]): StrokeDTO[] {
  const out: StrokeDTO[] = [];
  for (const row of rows) {
    const createdAt = row.updatedAt.toISOString();
    for (const s of row.strokes) {
      out.push({
        id: s.drawId,
        variantId: row.variantId,
        versionId: row.versionId,
        pageOrder: row.pageOrder,
        points: s.points,
        color: s.color,
        width: s.width,
        authorId: row.authorId,
        authorName: row.authorName,
        authorColor: row.authorColor,
        createdAt,
      });
    }
  }
  return out;
}
