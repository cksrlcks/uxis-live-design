"use client";

import { toast } from "sonner";
import { ROLES, type Role } from "@/shared/auth/roles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useUpdateUserRole } from "../api/use-update-user-role";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: ROLES.PENDING, label: "대기" },
  { value: ROLES.EDITOR, label: "편집자" },
  { value: ROLES.ADMIN, label: "관리자" },
];

export function UserRowActions({ id, role }: { id: string; role: Role }) {
  const updateRole = useUpdateUserRole();

  function handleChange(next: Role) {
    if (next === role) return;
    updateRole.mutate(
      { id, role: next },
      {
        onSuccess: () => toast.success("역할을 변경했습니다"),
        onError: () => toast.error("역할 변경에 실패했습니다"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        items={ROLE_OPTIONS}
        value={role}
        onValueChange={(next) => handleChange(next as Role)}
        disabled={updateRole.isPending}
      >
        <SelectTrigger size="sm" className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
