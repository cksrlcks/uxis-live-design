import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tagQueries } from "@/entities/tag";
import * as api from "./manage-taxonomy";

function useInvalidateTags() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: tagQueries.all() });
}

export function useCreateGroup() {
  const invalidate = useInvalidateTags();
  return useMutation({ mutationFn: api.createGroup, onSuccess: invalidate });
}
export function useUpdateGroup() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.GroupUpdate }) => api.updateGroup(id, input),
    onSuccess: invalidate,
  });
}
export function useDeleteGroup() {
  const invalidate = useInvalidateTags();
  return useMutation({ mutationFn: (id: string) => api.deleteGroup(id), onSuccess: invalidate });
}
export function useCreateOption() {
  const invalidate = useInvalidateTags();
  return useMutation({ mutationFn: api.createOption, onSuccess: invalidate });
}
export function useUpdateOption() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.OptionUpdate }) => api.updateOption(id, input),
    onSuccess: invalidate,
  });
}
export function useDeleteOption() {
  const invalidate = useInvalidateTags();
  return useMutation({ mutationFn: (id: string) => api.deleteOption(id), onSuccess: invalidate });
}
