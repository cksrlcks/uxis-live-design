"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ALLOWED_IMAGE_TYPES } from "@/shared/lib/proposals/constants";
import { createVariantSchema } from "@/entities/proposal/model/upload-schemas";
import { useAddVariant } from "../api/use-add-variant";

export function AddVariantForm({
  proposalId,
  onDone,
}: {
  proposalId: string;
  onDone?: () => void;
}) {
  const addVariant = useAddVariant(proposalId);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = createVariantSchema.safeParse({
      files: files.map((f) => ({ contentType: f.type, size: f.size })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "이미지를 확인하세요.");
      return;
    }
    addVariant.mutate(files, {
      onSuccess: () => {
        setFiles([]);
        onDone?.();
      },
      onError: () => setError("안 추가에 실패했습니다."),
    });
  }

  return (
    <form onSubmit={onSubmit} className="border-border space-y-3 rounded-[8px] border p-4">
      <div className="space-y-2">
        <Label htmlFor="variant-files">새 안 이미지 (여러 장 = 페이지)</Label>
        <Input
          id="variant-files"
          type="file"
          multiple
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={addVariant.isPending}>
        {addVariant.isPending ? "업로드 중…" : "안 추가"}
      </Button>
    </form>
  );
}
