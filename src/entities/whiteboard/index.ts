export { strokeQueries } from "./api/stroke.query";
export type { StrokeDTO, StrokePoint, StoredStroke, WhiteboardContext } from "./model/types";
export {
  MAX_STROKE_POINTS,
  MAX_LAYER_STROKES,
  strokeInputSchema,
  layerUpsertInputSchema,
  type StrokeInput,
  type LayerUpsertInput,
} from "./model/stroke-schema";
