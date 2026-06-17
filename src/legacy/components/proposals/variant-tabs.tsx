"use client";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsString } from "nuqs";
import { useState, useTransition } from "react";
import { Button } from "@/legacy/components/ui/button";
import { Input } from "@/legacy/components/ui/input";
import { AddVariantForm } from "./add-variant-form";

type VariantTab = { id: string; label: string; slug: string };

export function VariantTabs({ proposalId, variants }: {
  proposalId: string; variants: VariantTab[];
}) {
  const router = useRouter();
  // ?variant (variant id) is the single source of truth for the active 안, shared
  // with ProposalEditorPreview. Shallow → switching tabs doesn't re-run the server.
  const [variantId, setVariantId] = useQueryState("variant", parseAsString.withOptions({ shallow: true, history: "push" }));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = variants.find((v) => v.id === variantId) ?? variants[0];

  function selectVariant(id: string) {
    setVariantId(id);
  }

  function patch(id: string, payload: Record<string, unknown>) {
    return fetch(`/api/proposals/${proposalId}/variants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  function rename(form: HTMLFormElement) {
    if (pending) return;
    const label = (form.elements.namedItem("label") as HTMLInputElement).value.trim();
    if (!label) return;
    start(async () => {
      const res = await patch(active.id, { label });
      if (res.ok) { setError(null); setEditing(false); router.refresh(); }
      else setError("이름 변경에 실패했습니다.");
    });
  }

  function move(dir: -1 | 1) {
    if (pending) return;
    const idx = variants.findIndex((v) => v.id === active.id);
    const swapWith = variants[idx + dir];
    if (!swapWith) return;
    start(async () => {
      const results = await Promise.all([
        patch(active.id, { sortOrder: idx + dir }),
        patch(swapWith.id, { sortOrder: idx }),
      ]);
      if (results.every((r) => r.ok)) { setError(null); router.refresh(); }
      else setError("순서 변경에 실패했습니다.");
    });
  }

  function remove() {
    if (pending) return;
    if (variants.length <= 1) return;
    if (!confirm(`"${active.label}" 안을 삭제할까요? 이 안의 모든 버전이 삭제됩니다.`)) return;
    start(async () => {
      const res = await fetch(`/api/proposals/${proposalId}/variants/${active.id}`, { method: "DELETE" });
      if (res.ok) {
        const rest = variants.filter((v) => v.id !== active.id)[0];
        if (rest) selectVariant(rest.id);
        router.refresh();
      } else setError("삭제에 실패했습니다.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {variants.map((v) => (
          <Button key={v.id} size="sm" variant={v.id === active.id ? "default" : "outline"}
            onClick={() => selectVariant(v.id)}>
            {v.label}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => setAdding((s) => !s)}>＋ 안 추가</Button>
      </div>

      {adding && <AddVariantForm proposalId={proposalId} onDone={() => setAdding(false)} />}

      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); rename(e.currentTarget); }} className="flex items-center gap-2">
            <Input name="label" defaultValue={active.label} className="h-8 w-40" autoFocus />
            <Button size="sm" type="submit" disabled={pending}>저장</Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setEditing(false)}>취소</Button>
          </form>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">현재 안: <strong>{active.label}</strong> ({active.slug})</span>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>이름 변경</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => move(-1)}>◀ 앞으로</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => move(1)}>뒤로 ▶</Button>
            <Button size="sm" variant="outline" disabled={pending || variants.length <= 1} onClick={remove}>안 삭제</Button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
