"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/shared/ui/card";
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
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription>제목을 입력하고 이미지를 올리면 v1이 자동 생성됩니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              placeholder="시안 제목을 입력하세요"
              className="h-9"
              {...register("title")}
            />
            {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="files">이미지</Label>
            <Input
              id="files"
              type="file"
              multiple
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="h-9 py-1.5 file:mr-3 file:h-6 file:rounded-md file:bg-muted file:px-2.5"
            />
            <p className="text-muted-foreground text-xs">
              {files.length > 0
                ? `${files.length}장 선택됨 · 순서대로 페이지가 됩니다`
                : "여러 장 선택 가능 · 순서대로 페이지가 됩니다"}
            </p>
          </div>

          {formError && <p className="text-destructive text-sm">{formError}</p>}
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-sm">이미지는 생성 후에도 추가·교체할 수 있습니다.</p>
          <Button type="submit" size="lg" className="ml-auto" disabled={createProposal.isPending}>
            {createProposal.isPending ? "업로드 중…" : "시안 만들기"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
