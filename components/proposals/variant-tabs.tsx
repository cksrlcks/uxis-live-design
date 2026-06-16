"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddVariantForm } from "./add-variant-form";

type VariantTab = { id: string; label: string; slug: string };

export function VariantTabs({ proposalId, variants, activeVariantId }: {
  proposalId: string; variants: VariantTab[]; activeVariantId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  const active = variants.find((v) => v.id === activeVariantId) ?? variants[0];

  function selectVariant(id: string) {
    const next = new URLSearchParams(params);
    next.set("variant", id);
    router.push(`${pathname}?${next.toString()}`);
  }

  function patch(id: string, payload: Record<string, unknown>) {
    return fetch(`/api/proposals/${proposalId}/variants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  function rename(form: HTMLFormElement) {
    const label = (form.elements.namedItem("label") as HTMLInputElement).value.trim();
    if (!label) return;
    start(async () => {
      const res = await patch(active.id, { label });
      if (res.ok) { setEditing(false); router.refresh(); }
    });
  }

  function move(dir: -1 | 1) {
    const idx = variants.findIndex((v) => v.id === active.id);
    const swapWith = variants[idx + dir];
    if (!swapWith) return;
    start(async () => {
      await Promise.all([
        patch(active.id, { sortOrder: idx + dir }),
        patch(swapWith.id, { sortOrder: idx }),
      ]);
      router.refresh();
    });
  }

  function remove() {
    if (variants.length <= 1) return;
    if (!confirm(`"${active.label}" 안을 삭제할까요? 이 안의 모든 버전이 삭제됩니다.`)) return;
    start(async () => {
      const res = await fetch(`/api/proposals/${proposalId}/variants/${active.id}`, { method: "DELETE" });
      if (res.ok) {
        const rest = variants.filter((v) => v.id !== active.id)[0];
        if (rest) selectVariant(rest.id);
        router.refresh();
      }
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
    </div>
  );
}
