"use client";

import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { createProposalSchema } from "@/entities/proposal/model/create-schema";
import { useCreateProposal } from "../api/use-create-proposal";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2000 + 1 },
  (_, i) => CURRENT_YEAR - i,
);

const formSchema = createProposalSchema.pick({ title: true, workYear: true });
type FormValues = z.infer<typeof formSchema>;

export function ProposalCreateForm() {
  const router = useRouter();
  const createProposal = useCreateProposal();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  async function onSubmit({ title, workYear }: FormValues) {
    setFormError(null);
    try {
      const { proposalId } = await createProposal.mutateAsync({ title, workYear });
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

          <div className="space-y-2">
            <Label htmlFor="workYear">작업연도</Label>
            <Controller
              control={control}
              name="workYear"
              render={({ field }) => (
                <Select<number | undefined>
                  value={field.value}
                  onValueChange={(v) => field.onChange(v)}
                >
                  <SelectTrigger id="workYear" className="w-40">
                    <SelectValue>{(v) => (v == null ? "연도 선택" : `${v}년`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
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
