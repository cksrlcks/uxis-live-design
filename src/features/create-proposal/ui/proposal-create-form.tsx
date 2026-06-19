"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ALLOWED_IMAGE_TYPES } from "@/shared/lib/proposals/constants";
import { createProposalSchema } from "@/entities/proposal/model/create-schema";
import { useCreateProposal } from "../api/use-create-proposal";

const formSchema = createProposalSchema.pick({ title: true });
type FormValues = z.infer<typeof formSchema>;

export function ProposalCreateForm() {
  const router = useRouter();
  const createProposal = useCreateProposal();
  const [files, setFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  async function onSubmit({ title }: FormValues) {
    setFormError(null);

    // RHF validated title; re-validate the full payload (files live outside RHF state).
    const parsed = createProposalSchema.safeParse({
      title,
      files: files.map((f) => ({ contentType: f.type, size: f.size })),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "입력을 확인하세요.");
      return;
    }

    try {
      const { proposalId } = await createProposal.mutateAsync({ title, files });
      router.push(`/studio/proposals/${proposalId}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="files">이미지 (여러 장 선택 가능, 순서대로 페이지가 됩니다)</Label>
        <Input
          id="files"
          type="file"
          multiple
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {formError && <p className="text-destructive text-sm">{formError}</p>}

      <Button type="submit" disabled={createProposal.isPending}>
        {createProposal.isPending ? "업로드 중…" : "시안 만들기"}
      </Button>
    </form>
  );
}
