"use client";

import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ALLOWED_IMAGE_TYPES } from "@/shared/lib/proposals/constants";
import { createVersionSchema } from "@/entities/proposal/model/upload-schemas";
import { useAddVersion } from "../api/use-add-version";

export function AddVersionForm({
  proposalId,
  variantId,
}: {
  proposalId: string;
  variantId: string;
}) {
  const addVersion = useAddVersion(proposalId, variantId);
  const { register, handleSubmit, reset } = useForm<{ note: string }>({
    defaultValues: { note: "" },
  });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function onSubmit({ note }: { note: string }) {
    setError(null);
    const parsed = createVersionSchema.safeParse({
      note,
      files: files.map((f) => ({ contentType: f.type, size: f.size })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "이미지를 확인하세요.");
      return;
    }
    addVersion.mutate(
      { note: note.trim(), files },
      {
        onSuccess: () => {
          setFiles([]);
          reset();
          toast.success("새 버전을 만들었습니다");
        },
        onError: () => setError("버전 생성에 실패했습니다."),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="note">변경 메모 (선택)</Label>
        <Input id="note" placeholder="예: 메인 컬러 변경" {...register("note")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="version-files">새 버전 이미지</Label>
        <Input
          id="version-files"
          type="file"
          multiple
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={addVersion.isPending}>
        {addVersion.isPending ? "업로드 중…" : "새 버전 올리기"}
      </Button>
    </form>
  );
}
