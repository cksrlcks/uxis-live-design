"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import type { Role } from "@/shared/auth/roles";
import { useUpdateUserRole } from "../api/use-update-user-role";

export function UserRowActions({ id, role }: { id: string; role: Role }) {
  const updateRole = useUpdateUserRole();
  const [error, setError] = useState<string | null>(null);

  function setRole(next: Role) {
    setError(null);
    updateRole.mutate({ id, role: next }, { onError: () => setError("작업에 실패했습니다.") });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        {role === "pending" && (
          <Button size="sm" disabled={updateRole.isPending} onClick={() => setRole("editor")}>
            승인(편집자)
          </Button>
        )}
        {role !== "admin" && (
          <Button
            size="sm"
            variant="outline"
            disabled={updateRole.isPending}
            onClick={() => setRole("admin")}
          >
            관리자로
          </Button>
        )}
        {role !== "pending" && (
          <Button
            size="sm"
            variant="outline"
            disabled={updateRole.isPending}
            onClick={() => setRole("pending")}
          >
            권한 회수
          </Button>
        )}
      </div>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
