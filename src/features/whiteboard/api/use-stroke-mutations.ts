import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { strokeQueries, type StrokeDTO, type CreateStrokeInput } from "@/entities/whiteboard";

export function useCreateStroke(publicId: string, variantId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStrokeInput) =>
      http<{ stroke: StrokeDTO }>(`/api/p/${publicId}/strokes`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.stroke),
    onSuccess: (stroke) =>
      qc.setQueryData<StrokeDTO[]>(
        strokeQueries.list(publicId, variantId, versionId).queryKey,
        (prev) => (prev && prev.some((s) => s.id === stroke.id) ? prev : [...(prev ?? []), stroke]),
      ),
  });
}

export function useDeleteStroke(publicId: string, variantId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (strokeId: string) =>
      http<{ id: string }>(`/api/p/${publicId}/strokes/${strokeId}`, {
        method: "DELETE",
      }).then((r) => r.id),
    onSuccess: (id) =>
      qc.setQueryData<StrokeDTO[]>(
        strokeQueries.list(publicId, variantId, versionId).queryKey,
        (prev) => prev?.filter((s) => s.id !== id),
      ),
  });
}
