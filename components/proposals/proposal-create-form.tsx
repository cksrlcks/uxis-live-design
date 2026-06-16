"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_IMAGE_TYPES } from "@/lib/proposals/constants";
import { measureAll, uploadAll } from "@/lib/proposals/upload-client";

export function ProposalCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
    const files = Array.from((form.elements.namedItem("files") as HTMLInputElement).files ?? []);
    if (!title) { setError("제목을 입력하세요."); return; }
    if (files.length === 0) { setError("이미지를 1개 이상 선택하세요."); return; }

    setBusy(true);
    try {
      const measured = await measureAll(files);
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, files: files.map((f) => ({ contentType: f.type, size: f.size })) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "생성 실패");
      const { proposalId, versionId, uploads } = await res.json();
      const pages = await uploadAll(uploads, measured);
      const confirm = await fetch(`/api/proposals/${proposalId}/versions/${versionId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
      });
      if (!confirm.ok) throw new Error((await confirm.json()).error ?? "페이지 저장 실패");
      router.push(`/dashboard/proposals/${proposalId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="files">이미지 (여러 장 선택 가능, 순서대로 페이지가 됩니다)</Label>
        <Input id="files" name="files" type="file" multiple accept={ALLOWED_IMAGE_TYPES.join(",")} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "업로드 중…" : "시안 만들기"}</Button>
    </form>
  );
}
