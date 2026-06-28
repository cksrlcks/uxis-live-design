"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { HttpError } from "@/shared/api/http";
import { titleSchema, domainSchema, figmaUrlSchema } from "@/entities/proposal/model/create-schema";
import { Button } from "@/shared/ui/button";
import { useConfirm } from "@/shared/ui/confirm";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { checkDomain } from "../api/check-domain";
import { useUpdateSettings, useDeleteProposal } from "../api/use-edit-settings";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2000 + 1 },
  (_, i) => CURRENT_YEAR - i,
);

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

const figmaFormSchema = z.object({ figmaUrl: figmaUrlSchema });
type FigmaValues = z.infer<typeof figmaFormSchema>;

type DomainCheck = { available: boolean; message: string };

export function ProposalSettings({
  proposalId,
  title,
  participants,
  workYear,
  domain,
  figmaUrl,
  visibility,
  hasPassword,
  whiteboardEnabled,
  liveMode,
  exposedToUxisworks,
}: {
  proposalId: string;
  title: string;
  participants: string | null;
  workYear: number | null;
  domain: string | null;
  figmaUrl: string | null;
  visibility: string;
  hasPassword: boolean;
  whiteboardEnabled: boolean;
  liveMode: boolean;
  exposedToUxisworks: boolean;
}) {
  const router = useRouter();
  const updateSettings = useUpdateSettings(proposalId);
  const deleteProposal = useDeleteProposal(proposalId);
  const confirm = useConfirm();
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

  const figmaForm = useForm<FigmaValues>({
    resolver: zodResolver(figmaFormSchema),
    defaultValues: { figmaUrl: figmaUrl ?? "" },
  });
  // 복사 버튼 활성/비활성을 입력값에 따라 갱신(React Compiler 안전한 구독).
  const figmaValue = useWatch({ control: figmaForm.control, name: "figmaUrl" });

  const pending = updateSettings.isPending || deleteProposal.isPending;

  function onSetTitle({ title: next }: TitleValues) {
    setError(null);
    updateSettings.mutate(
      { title: next },
      {
        onSuccess: () => toast.success("저장했습니다"),
        onError: () => setError("변경에 실패했습니다."),
      },
    );
  }

  function onSetParticipants({ participants: next }: ParticipantsValues) {
    setError(null);
    // 빈 값은 null로 보내 해제한다(서버에서도 동일하게 정규화).
    updateSettings.mutate(
      { participants: next.trim() ? next.trim() : null },
      {
        onSuccess: () => {
          participantsForm.reset({ participants: next.trim() });
          toast.success("저장했습니다");
        },
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
        onSuccess: () => {
          setDomainCheck(null);
          toast.success("저장했습니다");
        },
        onError: (err) =>
          setError(
            err instanceof HttpError && err.code === "DOMAIN_TAKEN"
              ? "이미 사용 중인 도메인입니다."
              : "변경에 실패했습니다.",
          ),
      },
    );
  }

  function onSetFigma({ figmaUrl: next }: FigmaValues) {
    setError(null);
    updateSettings.mutate(
      { figmaUrl: next },
      {
        onSuccess: () => {
          figmaForm.reset({ figmaUrl: next });
          toast.success("저장했습니다");
        },
        onError: () => setError("변경에 실패했습니다."),
      },
    );
  }

  async function onCopyFigma() {
    const url = figmaForm.getValues("figmaUrl").trim();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("피그마 링크를 복사했습니다");
    } catch {
      toast.error("복사에 실패했습니다");
    }
  }

  function change(input: Parameters<typeof updateSettings.mutate>[0]) {
    updateSettings.mutate(input, {
      onSuccess: () => toast.success("저장했습니다"),
      onError: () => toast.error("변경에 실패했습니다"),
    });
  }

  function onSetPassword({ password }: PasswordValues) {
    setError(null);
    updateSettings.mutate(
      { password },
      {
        onSuccess: () => {
          reset();
          toast.success("비밀번호를 변경했습니다");
        },
        onError: () => setError("변경에 실패했습니다."),
      },
    );
  }

  async function onDelete() {
    const ok = await confirm({
      title: "이 시안을 삭제할까요?",
      description: "모든 버전과 이미지가 사라집니다.",
      confirmLabel: "삭제",
    });
    if (!ok) return;
    deleteProposal.mutate(undefined, {
      onSuccess: () => {
        toast.success("삭제했습니다");
        router.push("/studio/proposals");
      },
      onError: () => toast.error("삭제에 실패했습니다"),
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

      {/* 작업연도 */}
      <Card>
        <CardHeader>
          <CardTitle>작업연도</CardTitle>
          <CardDescription>이 시안이 제작된 연도를 선택합니다. 목록 표시와 필터에 사용됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select<number | null>
            value={workYear}
            onValueChange={(v) =>
              change({ workYear: v ?? null })
            }
          >
            <SelectTrigger className="w-40">
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
        </CardContent>
        {workYear && (
          <CardFooter>
            <p className="text-muted-foreground text-sm">{workYear}년으로 설정됨</p>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="ml-auto"
              disabled={pending}
              onClick={() => change({ workYear: null })}
            >
              해제
            </Button>
          </CardFooter>
        )}
      </Card>

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

      {/* 라이브 모드 — 협업 마스터 스위치 */}
      <Card>
        <CardHeader>
          <CardTitle>라이브 모드</CardTitle>
          <CardDescription>
            접속자·채팅·핀코멘트·화이트보드 등 실시간 협업이 동작합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex w-fit cursor-pointer items-center gap-3">
            <Switch
              checked={liveMode}
              disabled={pending}
              onCheckedChange={(checked) => change({ liveMode: checked })}
            />
            <span className="text-sm font-medium">{liveMode ? "사용" : "사용 안 함"}</span>
          </label>
        </CardContent>
      </Card>

      {/* 화이트보드 */}
      <Card>
        <CardHeader>
          <CardTitle>화이트보드</CardTitle>
          <CardDescription>
            뷰어 캔버스에서 로그인 사용자가 시안 위에 자유롭게 그릴 수 있게 합니다. 라이브 모드가
            꺼져 있으면 이 설정과 무관하게 동작하지 않습니다.
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

      {/* 유시스웍스 노출 */}
      <Card>
        <CardHeader>
          <CardTitle>유시스웍스 노출</CardTitle>
          <CardDescription>
            켜면 이 시안을 유시스웍스(포트폴리오/갤러리)에 노출합니다. 공개 링크 접근과는 별개입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex w-fit cursor-pointer items-center gap-3">
            <Switch
              checked={exposedToUxisworks}
              disabled={pending}
              onCheckedChange={(checked) => change({ exposedToUxisworks: checked })}
            />
            <span className="text-sm font-medium">{exposedToUxisworks ? "노출" : "노출 안 함"}</span>
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
                <Badge variant="neutral">설정됨</Badge>
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

      {/* 피그마 링크 */}
      <form onSubmit={figmaForm.handleSubmit(onSetFigma)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              피그마 링크
              {figmaUrl && (
                <Badge variant="neutral">설정됨</Badge>
              )}
            </CardTitle>
            <CardDescription>원본 Figma 파일 링크를 연결합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex max-w-md gap-2">
              <Input
                type="url"
                inputMode="url"
                aria-label="피그마 링크"
                placeholder="https://www.figma.com/design/..."
                className="h-9"
                {...figmaForm.register("figmaUrl")}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="피그마 링크 복사"
                className="shrink-0"
                disabled={!figmaValue?.trim()}
                onClick={onCopyFigma}
              >
                <Copy />
              </Button>
            </div>
            {figmaForm.formState.errors.figmaUrl && (
              <p className="text-destructive text-sm">
                {figmaForm.formState.errors.figmaUrl.message}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-muted-foreground text-sm">figma.com 주소만 입력할 수 있습니다.</p>
            <div className="ml-auto flex gap-1">
              {figmaUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={pending}
                  onClick={() => {
                    figmaForm.reset({ figmaUrl: "" });
                    change({ figmaUrl: null });
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
                <Badge variant="neutral">설정됨</Badge>
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
