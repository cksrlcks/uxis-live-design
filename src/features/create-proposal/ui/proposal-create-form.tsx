"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import { createProposalSchema } from "@/entities/proposal/model/create-schema";
import { useCreateProposal } from "../api/use-create-proposal";

const formSchema = createProposalSchema.pick({ title: true });
type FormValues = z.infer<typeof formSchema>;

export function ProposalCreateForm() {
  const router = useRouter();
  const createProposal = useCreateProposal();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  async function onSubmit({ title }: FormValues) {
    setFormError(null);
    try {
      const { proposalId } = await createProposal.mutateAsync({ title });
      toast.success("시안을 만들었습니다");
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
          <CardDescription>제목을 입력하면 빈 v1이 자동 생성됩니다.</CardDescription>
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

          {formError && <p className="text-destructive text-sm">{formError}</p>}
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-sm">이미지는 생성 후 추가·교체할 수 있습니다.</p>
          <Button type="submit" size="lg" className="ml-auto" disabled={createProposal.isPending}>
            {createProposal.isPending ? "만드는 중…" : "시안 만들기"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
