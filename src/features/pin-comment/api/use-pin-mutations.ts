import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { pinQueries, type PinDTO, type CreatePinInput } from "@/entities/pin";

export function useCreatePin(publicId: string, variantId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePinInput) =>
      http<{ pin: PinDTO }>(`/api/p/${publicId}/pins`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.pin),
    onSuccess: (pin) =>
      qc.setQueryData<PinDTO[]>(pinQueries.list(publicId, variantId, versionId).queryKey, (prev) =>
        prev && prev.some((p) => p.id === pin.id) ? prev : [...(prev ?? []), pin],
      ),
  });
}

export function useEditPin(publicId: string, variantId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pinId, body }: { pinId: string; body: string }) =>
      http<{ pin: PinDTO }>(`/api/p/${publicId}/pins/${pinId}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      }).then((r) => r.pin),
    onSuccess: (pin) =>
      qc.setQueryData<PinDTO[]>(pinQueries.list(publicId, variantId, versionId).queryKey, (prev) =>
        prev?.map((p) => (p.id === pin.id ? pin : p)),
      ),
  });
}

export function useToggleResolved(publicId: string, variantId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pinId, resolved }: { pinId: string; resolved: boolean }) =>
      http<{ pin: PinDTO }>(`/api/p/${publicId}/pins/${pinId}`, {
        method: "PATCH",
        body: JSON.stringify({ resolved }),
      }).then((r) => r.pin),
    onSuccess: (pin) =>
      qc.setQueryData<PinDTO[]>(pinQueries.list(publicId, variantId, versionId).queryKey, (prev) =>
        prev?.map((p) => (p.id === pin.id ? pin : p)),
      ),
  });
}

export function useDeletePin(publicId: string, variantId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pinId: string) =>
      http<{ id: string }>(`/api/p/${publicId}/pins/${pinId}`, {
        method: "DELETE",
      }).then((r) => r.id),
    onSuccess: (id) =>
      qc.setQueryData<PinDTO[]>(pinQueries.list(publicId, variantId, versionId).queryKey, (prev) =>
        prev?.filter((p) => p.id !== id),
      ),
  });
}
