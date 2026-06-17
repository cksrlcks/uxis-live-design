"use client";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Button } from "@/legacy/components/ui/button";

export function UserRowActions({ id, role }: { id: string; role: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const setRole = (next: string) =>
    start(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: next }),
        });
        if (!res.ok) {
          setError("작업 실패 (" + res.status + ")");
          return;
        }
        router.refresh();
      } catch {
        setError("네트워크 오류");
      }
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        {role === "pending" && <Button size="sm" disabled={pending} onClick={() => setRole("editor")}>승인(편집자)</Button>}
        {role !== "admin" && <Button size="sm" variant="outline" disabled={pending} onClick={() => setRole("admin")}>관리자로</Button>}
        {role !== "pending" && <Button size="sm" variant="outline" disabled={pending} onClick={() => setRole("pending")}>권한 회수</Button>}
      </div>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
