"use client";
import { useState } from "react";
import { useRealtime } from "@/shared/realtime/realtime-provider";
import type { Identity } from "@/shared/realtime/identity";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";

export function PresenceBar({ identity, onRename }: {
  identity: Identity; onRename: (name: string) => void;
}) {
  const { participants } = useRealtime();
  const [editing, setEditing] = useState(false);

  // Show others first, then me (presence includes my own key).
  const others = participants.filter((p) => p.id !== identity.id);

  return (
    <div className="fixed right-3 top-3 z-50 flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 shadow-sm backdrop-blur">
      <div className="flex -space-x-1.5">
        {others.slice(0, 6).map((p) => (
          <span key={p.id} title={p.name}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-background text-[10px] font-medium text-white"
            style={{ backgroundColor: p.color }}>
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
        {others.length === 0 && <span className="text-xs text-muted-foreground">혼자 보는 중</span>}
        {others.length > 6 && <span className="text-xs text-muted-foreground">+{others.length - 6}</span>}
      </div>
      <span className="mx-1 h-4 w-px bg-border" />
      {editing ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          const name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement).value.trim();
          if (name) onRename(name);
          setEditing(false);
        }} className="flex items-center gap-1">
          <Input name="name" defaultValue={identity.name} autoFocus className="h-7 w-28" />
          <Button size="sm" type="submit" className="h-7">저장</Button>
        </form>
      ) : (
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: identity.color }} />
          <span className="font-medium">{identity.name}</span>
          <span className="text-muted-foreground">(나)</span>
        </button>
      )}
    </div>
  );
}
