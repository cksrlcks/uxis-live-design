"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HttpError } from "@/shared/api/http";
import { titleSchema, domainSchema } from "@/entities/proposal/model/create-schema";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/shared/ui/card";
import { checkDomain } from "../api/check-domain";
import { useUpdateSettings, useDeleteProposal } from "../api/use-edit-settings";

const passwordSchema = z.object({
  password: z.string().min(4, "비밀번호는 4자 이상이어야 합니다"),
});
type PasswordValues = z.infer<typeof passwordSchema>;

const titleFormSchema = z.object({ title: titleSchema });
type TitleValues = z.infer<typeof titleFormSchema>;

const participantsFormSchema = z.object({ participants: z.string().trim() });
type ParticipantsValues = z.infer<typeof participantsFormSchema>;

const domainFormSchema = z.object({ domain: domainSchema });
type DomainValues = z.infer<typeof domainFormSchema>;

type DomainCheck = { available: boolean; message: string };

export function ProposalSettings({
  proposalId,
  title,
  participants,
  domain,
  visibility,
  hasPassword,
  whiteboardEnabled,
}: {
  proposalId: string;
  title: string;
  participants: string | null;
  domain: string | null;
  visibility: string;
  hasPassword: boolean;
  whiteboardEnabled: boolean;
}) {
  const router = useRouter();
  const updateSettings = useUpdateSettings(proposalId);
  const deleteProposal = useDeleteProposal(proposalId);
  const [error, setError] = useState<string | null>(null);
  const [domainCheck, setDomainCheck] = useState<DomainCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const titleForm = useForm<TitleValues>({
    resolver: zodResolver(titleFormSchema),
    defaultValues: { title },
  });

  const participantsForm = useForm<ParticipantsValues>({
    resolver: zodResolver(participantsFormSchema),
    defaultValues: { participants: participants ?? "" },
  });

  const domainForm = useForm<DomainValues>({
    resolver: zodResolver(domainFormSchema),
    defaultValues: { domain: domain ?? "" },
  });

  const pending = updateSettings.isPending || deleteProposal.isPending;

  function onSetTitle({ title: next }: TitleValues) {
    setError(null);
    updateSettings.mutate(
      { title: next },
      { onError: () => setError("변경에 실패했습니다.") },
    );
  }

  function onSetParticipants({ participants: next }: ParticipantsValues) {
    setError(null);
    // 빈 값은 null로 보내 해제한다(서버에서도 동일하게 정규화).
    updateSettings.mutate(
      { participants: next.trim() ? next.trim() : null },
      {
        onSuccess: () => participantsForm.reset({ participants: next.trim() }),
        onError: () => setError("변경에 실패했습니다."),
      },
    );
  }

  async function onCheckDomain() {
    setDomainCheck(null);
    const valid = await domainForm.trigger("domain");
    if (!valid) return;
    setChecking(true);
    try {
      const { available } = await checkDomain(domainForm.getValues("domain"), proposalId);
      setDomainCheck({
        available,
        message: available ? "사용 가능한 도메인입니다." : "이미 사용 중인 도메인입니다.",
      });
    } catch {
      setDomainCheck({ available: false, message: "확인에 실패했습니다." });
    } finally {
      setChecking(false);
    }
  }

  function onSetDomain({ domain: next }: DomainValues) {
    setError(null);
    updateSettings.mutate(
      { domain: next },
      {
        onSuccess: () => setDomainCheck(null),
        onError: (err) =>
          setError(
            err instanceof HttpError && err.code === "DOMAIN_TAKEN"
              ? "이미 사용 중인 도메인입니다."
              : "변경에 실패했습니다.",
          ),
      },
    );
  }

  function change(input: Parameters<typeof updateSettings.mutate>[0]) {
    setError(null);
    updateSettings.mutate(input, { onError: () => setError("변경에 실패했습니다.") });
  }

  function onSetPassword({ password }: PasswordValues) {
    setError(null);
    updateSettings.mutate(
      { password },
      { onSuccess: () => reset(), onError: () => setError("변경에 실패했습니다.") },
    );
  }

  function onDelete() {
    if (!confirm("이 시안을 삭제할까요? 모든 버전과 이미지가 사라집니다.")) return;
    setError(null);
    deleteProposal.mutate(undefined, {
      onSuccess: () => router.push("/studio/proposals"),
      onError: () => setError("삭제에 실패했습니다."),
    });
  }

  return (
    <div className="space-y-5">
      {/* 제목 */}
      <form onSubmit={titleForm.handleSubmit(onSetTitle)}>
        <Card>
          <CardHeader>
            <CardTitle>제목</CardTitle>
            <CardDescription>시안 목록과 뷰어에 표시되는 이름입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              aria-label="제목"
              placeholder="시안 제목"
              className="h-9 max-w-md"
              {...titleForm.register("title")}
            />
            {titleForm.formState.errors.title && (
              <p className="text-destructive mt-2 text-sm">
                {titleForm.formState.errors.title.message}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-muted-foreground text-sm">변경하면 즉시 반영됩니다.</p>
            <Button type="submit" size="lg" className="ml-auto" disabled={pending}>
              저장
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* 참여자 */}
      <form onSubmit={participantsForm.handleSubmit(onSetParticipants)}>
        <Card>
          <CardHeader>
            <CardTitle>참여자</CardTitle>
            <CardDescription>
              시안에 참여한 사람을 입력합니다. 목록 표시와 검색에 사용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              aria-label="참여자"
              placeholder="예: 홍길동, 김철수"
              className="h-9 max-w-md"
              {...participantsForm.register("participants")}
            />
            {participantsForm.formState.errors.participants && (
              <p className="text-destructive mt-2 text-sm">
                {participantsForm.formState.errors.participants.message}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-muted-foreground text-sm">쉼표로 구분해 여러 명을 입력할 수 있습니다.</p>
            <Button type="submit" size="lg" className="ml-auto" disabled={pending}>
              저장
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* 공개 상태 */}
      <Card>
        <CardHeader>
          <CardTitle>공개 상태</CardTitle>
          <CardDescription>
            비공개는 관리자만, 공개는 링크를 아는 누구나 볼 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex w-fit cursor-pointer items-center gap-3">
            <Switch
              checked={visibility === "public"}
              disabled={pending}
              onCheckedChange={(checked) =>
                change({ visibility: checked ? "public" : "private" })
              }
            />
            <span className="text-sm font-medium">
              {visibility === "public" ? "공개" : "비공개"}
            </span>
          </label>
        </CardContent>
      </Card>

      {/* 화이트보드 */}
      <Card>
        <CardHeader>
          <CardTitle>화이트보드</CardTitle>
          <CardDescription>
            뷰어 캔버스에서 로그인 사용자가 시안 위에 자유롭게 그릴 수 있게 합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex w-fit cursor-pointer items-center gap-3">
            <Switch
              checked={whiteboardEnabled}
              disabled={pending}
              onCheckedChange={(checked) => change({ whiteboardEnabled: checked })}
            />
            <span className="text-sm font-medium">{whiteboardEnabled ? "사용" : "사용 안 함"}</span>
          </label>
        </CardContent>
      </Card>

      {/* 공개 도메인 */}
      <form onSubmit={domainForm.handleSubmit(onSetDomain)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              공개 도메인
              {domain && (
                <Badge variant="neutral" size="sm">
                  설정됨
                </Badge>
              )}
            </CardTitle>
            <CardDescription>공개 URL에 쓰이는 식별자 · 소문자·숫자·하이픈</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex max-w-md gap-2">
              <Input
                aria-label="공개 도메인"
                placeholder="예: main-renewal"
                className="h-9"
                {...domainForm.register("domain", { onChange: () => setDomainCheck(null) })}
              />
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-9 shrink-0"
                disabled={pending || checking}
                onClick={onCheckDomain}
              >
                {checking ? "확인 중…" : "중복확인"}
              </Button>
            </div>
            {domainForm.formState.errors.domain && (
              <p className="text-destructive text-sm">
                {domainForm.formState.errors.domain.message}
              </p>
            )}
            {domainCheck && (
              <p
                className={
                  domainCheck.available ? "text-sm text-emerald-600" : "text-destructive text-sm"
                }
              >
                {domainCheck.message}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-muted-foreground text-sm">/p/도메인 형태로 접속합니다.</p>
            <div className="ml-auto flex gap-1">
              {domain && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={pending}
                  onClick={() => {
                    domainForm.reset({ domain: "" });
                    setDomainCheck(null);
                    change({ domain: null });
                  }}
                >
                  해제
                </Button>
              )}
              <Button type="submit" size="lg" disabled={pending}>
                설정/변경
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>

      {/* 접근 비밀번호 */}
      <form onSubmit={handleSubmit(onSetPassword)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              접근 비밀번호
              {hasPassword && (
                <Badge variant="neutral" size="sm">
                  설정됨
                </Badge>
              )}
            </CardTitle>
            <CardDescription>비밀번호는 공개 시안에만 적용됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="password"
              aria-label="접근 비밀번호"
              placeholder="4자 이상"
              className="h-9 max-w-md"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-destructive mt-2 text-sm">{errors.password.message}</p>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-muted-foreground text-sm">설정하면 열람 시 비밀번호를 묻습니다.</p>
            <div className="ml-auto flex gap-1">
              {hasPassword && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={pending}
                  onClick={() => change({ password: null })}
                >
                  비번 해제
                </Button>
              )}
              <Button type="submit" size="lg" disabled={pending}>
                설정/변경
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {/* 위험 구역 */}
      <Card className="ring-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">시안 삭제</CardTitle>
          <CardDescription>
            모든 버전과 이미지가 영구 삭제됩니다. 되돌릴 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardFooter className="bg-destructive/5">
          <p className="text-destructive text-sm">이 작업은 취소할 수 없습니다.</p>
          <Button
            variant="destructive"
            size="lg"
            className="ml-auto"
            disabled={pending}
            onClick={onDelete}
          >
            시안 삭제
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
