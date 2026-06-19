"use client";
import { useQueryState, parseAsString } from "nuqs";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { AddVariantForm } from "@/features/add-variant";
import { useUpdateVariant, useDeleteVariant, useReorderVariants } from "@/features/manage-variants";

type VariantTab = { id: string; label: string; slug: string };

export function VariantTabs({
  proposalId,
  variants,
}: {
  proposalId: string;
  variants: VariantTab[];
}) {
  // ?variant (variant id) is the single source of truth for the active 안, shared
  // with ProposalEditorPreview. Shallow → switching tabs doesn't re-run the server.
  const [variantId, setVariantId] = useQueryState(
    "variant",
    parseAsString.withOptions({ shallow: true, history: "push" }),
  );
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateVariant = useUpdateVariant(proposalId);
  const deleteVariant = useDeleteVariant(proposalId);
  const reorderVariants = useReorderVariants(proposalId);

  const pending = updateVariant.isPending || deleteVariant.isPending || reorderVariants.isPending;

  const active = variants.find((v) => v.id === variantId) ?? variants[0];

  function selectVariant(id: string) {
    setVariantId(id);
  }

  function rename(form: HTMLFormElement) {
    if (pending) return;
    const label = (form.elements.namedItem("label") as HTMLInputElement).value.trim();
    if (!label) return;
    updateVariant.mutate(
      { variantId: active.id, input: { label } },
      {
        onSuccess: () => {
          setError(null);
          setEditing(false);
        },
        onError: () => setError("이름 변경에 실패했습니다."),
      },
    );
  }

  function move(dir: -1 | 1) {
    if (pending) return;
    const idx = variants.findIndex((v) => v.id === active.id);
    const swapWith = variants[idx + dir];
    if (!swapWith) return;
    reorderVariants.mutate(
      [
        { variantId: active.id, sortOrder: idx + dir },
        { variantId: swapWith.id, sortOrder: idx },
      ],
      { onSuccess: () => setError(null), onError: () => setError("순서 변경에 실패했습니다.") },
    );
  }

  function remove() {
    if (pending) return;
    if (variants.length <= 1) return;
    if (!confirm(`"${active.label}" 안을 삭제할까요? 이 안의 모든 버전이 삭제됩니다.`)) return;
    deleteVariant.mutate(active.id, {
      onSuccess: () => {
        const rest = variants.filter((v) => v.id !== active.id)[0];
        if (rest) selectVariant(rest.id);
      },
      onError: () => setError("삭제에 실패했습니다."),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {variants.map((v) => (
          <Button
            key={v.id}
            size="sm"
            variant={v.id === active.id ? "default" : "outline"}
            onClick={() => selectVariant(v.id)}
          >
            {v.label}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => setAdding((s) => !s)}>
          ＋ 안 추가
        </Button>
      </div>

      {adding && <AddVariantForm proposalId={proposalId} onDone={() => setAdding(false)} />}

      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              rename(e.currentTarget);
            }}
            className="flex items-center gap-2"
          >
            <Input name="label" defaultValue={active.label} className="h-8 w-40" autoFocus />
            <Button size="sm" type="submit" disabled={pending}>
              저장
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setEditing(false)}>
              취소
            </Button>
          </form>
        ) : (
          <>
            <span className="text-muted-foreground text-sm">
              현재 안: <strong>{active.label}</strong> ({active.slug})
            </span>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              이름 변경
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => move(-1)}>
              ◀ 앞으로
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => move(1)}>
              뒤로 ▶
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || variants.length <= 1}
              onClick={remove}
            >
              안 삭제
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
