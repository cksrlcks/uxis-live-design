"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function UserRowActions({ id, role }: { id: string; role: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const setRole = (next: string) =>
    start(async () => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (res.ok) router.refresh();
    });

  return (
    <div className="flex justify-end gap-2">
      {role === "pending" && <Button size="sm" disabled={pending} onClick={() => setRole("editor")}>승인(편집자)</Button>}
      {role !== "admin" && <Button size="sm" variant="outline" disabled={pending} onClick={() => setRole("admin")}>관리자로</Button>}
      {role !== "pending" && <Button size="sm" variant="outline" disabled={pending} onClick={() => setRole("pending")}>권한 회수</Button>}
    </div>
  );
}
