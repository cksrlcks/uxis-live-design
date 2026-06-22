"use client";
import { Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { useAddVariant } from "@/features/add-variant";
import { useDeleteVariant, useReorderVariants, useUpdateVariant } from "@/features/manage-variants";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

type VariantTab = { id: string; label: string; slug: string };

// 드롭 위치 표시 — 어떤 행의 위/아래에 꽂힐지.
type DropTarget = { id: string; after: boolean };

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 드래그 정렬 상태 — 잡은 행(dragId)과 현재 드롭 후보(dropTo).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTo, setDropTo] = useState<DropTarget | null>(null);

  const addVariant = useAddVariant(proposalId);
  const updateVariant = useUpdateVariant(proposalId);
  const deleteVariant = useDeleteVariant(proposalId);
  const reorderVariants = useReorderVariants(proposalId);

  const pending = updateVariant.isPending || deleteVariant.isPending || reorderVariants.isPending;
  const active = variants.find((v) => v.id === variantId) ?? variants[0];

  // 빈 안을 만들고 곧바로 선택 — 이미지는 우측 카드 그리드에서 추가한다.
  async function addAndSelect() {
    if (addVariant.isPending) return;
    try {
      const { variantId: newId } = await addVariant.mutateAsync();
      setError(null);
      setVariantId(newId);
    } catch {
      setError("안 추가에 실패했습니다.");
    }
  }

  function rename(id: string, form: HTMLFormElement) {
    if (pending) return;
    const label = (form.elements.namedItem("label") as HTMLInputElement).value.trim();
    if (!label) return;
    updateVariant.mutate(
      { variantId: id, input: { label } },
      {
        onSuccess: () => {
          setError(null);
          setEditingId(null);
        },
        onError: () => setError("이름 변경에 실패했습니다."),
      },
    );
  }

  function remove(target: VariantTab) {
    if (pending || variants.length <= 1) return;
    if (!confirm(`"${target.label}" 안을 삭제할까요? 이 안의 모든 버전이 삭제됩니다.`)) return;
    deleteVariant.mutate(target.id, {
      onSuccess: () => {
        setError(null);
        if (target.id === active.id) {
          const rest = variants.find((v) => v.id !== target.id);
          if (rest) setVariantId(rest.id);
        }
      },
      onError: () => setError("삭제에 실패했습니다."),
    });
  }

  // fromId를 refId의 앞/뒤로 옮긴 새 순서를 만들고, 인덱스가 바뀐 안들의 sortOrder만
  // 한 번에 PATCH한다(useReorderVariants가 모두 끝난 뒤 한 번만 invalidate).
  function reorder(fromId: string, refId: string, after: boolean) {
    if (pending || fromId === refId) return;
    const ids = variants.map((v) => v.id).filter((id) => id !== fromId);
    const at = ids.indexOf(refId) + (after ? 1 : 0);
    ids.splice(at, 0, fromId);
    const pairs = ids
      .map((id, idx) => ({ variantId: id, sortOrder: idx }))
      .filter((p, idx) => variants[idx].id !== p.variantId);
    if (!pairs.length) return;
    reorderVariants.mutate(pairs, {
      onSuccess: () => setError(null),
      onError: () => setError("순서 변경에 실패했습니다."),
    });
  }

  // 화살표 키 정렬 — 드래그를 못 쓰는 환경/키보드 사용자를 위한 대체 경로.
  function nudge(id: string, dir: -1 | 1) {
    const idx = variants.findIndex((v) => v.id === id);
    const target = variants[idx + dir];
    if (!target) return;
    reorder(id, target.id, dir === 1);
  }

  function resetDrag() {
    setDragId(null);
    setDropTo(null);
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {variants.map((v) => {
          const isActive = v.id === active.id;
          const isEditing = v.id === editingId;
          const isDragging = v.id === dragId;
          const showLineTop = dropTo?.id === v.id && !dropTo.after;
          const showLineBottom = dropTo?.id === v.id && dropTo.after;

          return (
            <li
              key={v.id}
              className="relative"
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                if (dropTo?.id !== v.id || dropTo.after !== after) setDropTo({ id: v.id, after });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dropTo) reorder(dragId, dropTo.id, dropTo.after);
                resetDrag();
              }}
            >
              {/* 드롭 위치 인디케이터 */}
              {showLineTop && (
                <span className="bg-primary pointer-events-none absolute -top-0.5 right-0 left-0 z-10 h-0.5 rounded-full" />
              )}
              {showLineBottom && (
                <span className="bg-primary pointer-events-none absolute right-0 -bottom-0.5 left-0 z-10 h-0.5 rounded-full" />
              )}

              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    rename(v.id, e.currentTarget);
                  }}
                  className="border-foreground flex items-center gap-1 rounded-lg border px-1.5 py-1"
                >
                  <Input name="label" defaultValue={v.label} className="h-7 border-0 px-1.5 focus-visible:ring-0" autoFocus />
                  <Button size="icon-sm" type="submit" disabled={pending} aria-label="저장">
                    <Check />
                  </Button>
                  <Button
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    aria-label="취소"
                  >
                    <X />
                  </Button>
                </form>
              ) : (
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-lg border pr-1.5 transition-colors",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/40 hover:bg-foreground/3",
                    isDragging && "opacity-40",
                  )}
                >
                  {/* 그립 — 드래그 핸들 + 화살표 키 정렬 */}
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      setDragId(v.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={resetDrag}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        nudge(v.id, -1);
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        nudge(v.id, 1);
                      }
                    }}
                    disabled={pending || variants.length <= 1}
                    aria-label="순서 변경 — 끌어서 이동하거나 화살표 키 사용"
                    className={cn(
                      "text-muted-foreground/70 group-hover:text-foreground focus-visible:text-foreground flex h-9 shrink-0 cursor-grab touch-none items-center rounded-l-lg pr-0.5 pl-1.5 outline-none active:cursor-grabbing disabled:cursor-default disabled:opacity-0",
                      isActive && "text-background/60 group-hover:text-background",
                    )}
                  >
                    <GripVertical className="size-4" />
                  </button>

                  {/* 선택 */}
                  <button
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center py-2 text-left text-sm outline-none",
                      isActive && "font-medium",
                    )}
                  >
                    <span className="truncate">{v.label}</span>
                  </button>

                  {/* 행 단위 액션 — 항상 노출(비활성은 약하게 상속) */}
                  <div
                    className={cn(
                      "flex shrink-0 items-center gap-0.5",
                      !isActive && "text-muted-foreground",
                    )}
                  >
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setError(null);
                        setEditingId(v.id);
                      }}
                      aria-label={`${v.label} 이름 변경`}
                      className={cn(
                        isActive &&
                          "text-background/80 hover:bg-background/15! hover:text-background!",
                      )}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={pending || variants.length <= 1}
                      onClick={() => remove(v)}
                      aria-label={`${v.label} 삭제`}
                      className={cn(
                        isActive
                          ? "text-background/80 hover:bg-background/15! hover:text-background!"
                          : "hover:text-destructive",
                      )}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Button
        size="lg"
        variant="outline"
        className="w-full border-dashed"
        disabled={addVariant.isPending}
        onClick={addAndSelect}
      >
        <Plus />
        {addVariant.isPending ? "추가 중…" : "안 추가"}
      </Button>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
