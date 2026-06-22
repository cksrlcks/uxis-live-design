"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { titleSchema } from "@/entities/proposal/model/create-schema";
import { useCreateProposal } from "../api/use-create-proposal";

const schema = z.object({ title: titleSchema });
type FormValues = z.infer<typeof schema>;

export function NewProposalDialog() {
  const router = useRouter();
  const createProposal = useCreateProposal();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
      setFormError(null);
    }
  }

  async function onSubmit({ title }: FormValues) {
    setFormError(null);
    try {
      const { proposalId } = await createProposal.mutateAsync({ title, files: [] });
      onOpenChange(false);
      router.push(`/studio/proposals/${proposalId}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button className="h-9 gap-1.5 rounded-lg px-3.5" />}>
        <Plus className="size-4" />새 시안
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-5 p-6">
        <DialogHeader>
          <DialogTitle>새 시안 만들기</DialogTitle>
          <DialogDescription>
            이름을 입력하세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2.5">
            <Label htmlFor="new-proposal-title" className="text-muted-foreground font-normal">
              시안 이름
            </Label>
            <Input
              id="new-proposal-title"
              autoFocus
              placeholder="예: 메인 페이지 리뉴얼"
              className="h-11 rounded-lg px-4"
              {...register("title")}
            />
            {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
            {formError && <p className="text-destructive text-sm">{formError}</p>}
          </div>

          <DialogFooter showCloseButton={false}>
            <DialogClose render={<Button type="button" variant="outline" className="h-10 rounded-lg" />}>
              취소
            </DialogClose>
            <Button type="submit" className="h-10 rounded-lg" disabled={createProposal.isPending}>
              {createProposal.isPending ? "만드는 중…" : "만들기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
