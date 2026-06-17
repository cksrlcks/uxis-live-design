"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ALLOWED_IMAGE_TYPES } from "@/shared/lib/proposals/constants";
import { measureAll, uploadAll } from "@/legacy/lib/proposals/upload-client";

export function AddVersionForm({ proposalId, variantId }: { proposalId: string; variantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const note = (form.elements.namedItem("note") as HTMLInputElement).value.trim();
    const files = Array.from((form.elements.namedItem("files") as HTMLInputElement).files ?? []);
    if (files.length === 0) { setError("이미지를 1개 이상 선택하세요."); return; }

    setBusy(true);
    try {
      const measured = await measureAll(files);
      const res = await fetch(`/api/proposals/${proposalId}/variants/${variantId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, files: files.map((f) => ({ contentType: f.type, size: f.size })) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "버전 생성 실패");
      const { versionId, uploads } = await res.json();
      const pages = await uploadAll(uploads, measured);
      const confirm = await fetch(`/api/proposals/${proposalId}/variants/${variantId}/versions/${versionId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
      });
      if (!confirm.ok) throw new Error((await confirm.json()).error ?? "페이지 저장 실패");
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="note">변경 메모 (선택)</Label>
        <Input id="note" name="note" placeholder="예: 메인 컬러 변경" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="files">새 버전 이미지</Label>
        <Input id="files" name="files" type="file" multiple accept={ALLOWED_IMAGE_TYPES.join(",")} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "업로드 중…" : "새 버전 올리기"}</Button>
    </form>
  );
}
