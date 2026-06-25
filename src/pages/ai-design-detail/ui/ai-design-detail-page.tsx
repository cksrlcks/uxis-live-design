"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, RotateCw } from "lucide-react";
import {
  aiDesignQueries,
  AiDesignStatusBadge,
  PageTypeCards,
  type AiDesignDetail,
  type AiDesignReferenceProposal,
} from "@/entities/ai-design";
import { useRetryAiDesign } from "@/entities/ai-design/api/use-ai-design-mutations";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import { PageHeader } from "@/widgets/studio-shell";
import { cn } from "@/shared/lib/utils";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 생성 모달의 Input/textarea와 같은 테두리·여백을 쓰되, 읽기전용 값 표시용 박스.
function ReadonlyField({
  children,
  empty = false,
  multiline = false,
}: {
  children: React.ReactNode;
  empty?: boolean;
  multiline?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-input bg-muted/30 w-full rounded-lg border px-3 py-2 text-sm",
        multiline ? "min-h-16 whitespace-pre-wrap" : "min-h-9",
        empty && "text-muted-foreground/60",
      )}
    >
      {children}
    </div>
  );
}

export function AiDesignDetailPage({ id }: { id: string }) {
  const { data, isPending, isError } = useQuery(aiDesignQueries.detail(id));
  const retry = useRetryAiDesign();

  const backLink = (
    <Link
      href="/studio/ai-designs"
      className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
    >
      <ArrowLeft className="size-4" />
      AI 시안 목록
    </Link>
  );

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <Skeleton className="h-8 w-60" />
        <Skeleton className="mt-2 h-4 w-40" />
        <Skeleton className="mt-6 h-[28rem] w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <div className="bg-card text-destructive rounded-2xl border px-6 py-12 text-center text-sm">
          시안을 불러오지 못했습니다.
        </div>
      </div>
    );
  }

  const design: AiDesignDetail = data;
  const viewerHref = `/studio/ai-designs/${design.id}/raw`;
  const canOpen = design.status === "done" && design.hasHtml;

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}

      <PageHeader
        title={design.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <AiDesignStatusBadge status={design.status} errorMessage={design.errorMessage} size="sm" />
            {design.requestedBy && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span>요청자 {design.requestedBy}</span>
              </>
            )}
            <span className="text-muted-foreground/60">·</span>
            <span className="tabular-nums">{formatDateTime(design.createdAt)}</span>
          </span>
        }
        actions={
          <>
            {canOpen && (
              <a
                href={viewerHref}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <ExternalLink />
                뷰어 열기
              </a>
            )}
            {design.status === "failed" && (
              <Button
                type="button"
                variant="outline"
                disabled={retry.isPending}
                onClick={() =>
                  retry.mutate(design.id, {
                    onSuccess: () => toast.success("다시 생성을 시작했습니다"),
                    onError: () => toast.error("재시도에 실패했습니다"),
                  })
                }
              >
                <RotateCw />
                재시도
              </Button>
            )}
          </>
        }
      />

      {design.status === "failed" && design.errorMessage && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive mb-4 rounded-xl border px-4 py-3 text-sm">
          생성 실패: {design.errorMessage}
        </div>
      )}

      {/* AI가 참고 시안을 분석하고 어떻게 반영했는지 설명. 생성 완료 시 채워진다. */}
      {(design.analysis || design.approach) && (
        <div className="bg-card mb-4 space-y-4 rounded-xl border p-6">
          {design.analysis && (
            <div className="space-y-1.5">
              <Label>AI 분석</Label>
              <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                {design.analysis}
              </p>
            </div>
          )}
          {design.approach && (
            <div className="space-y-1.5">
              <Label>참고 시안 도입</Label>
              <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                {design.approach}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 생성 모달과 동일한 폼 레이아웃을 읽기전용으로 재현한다. */}
      <div className="bg-card space-y-6 rounded-xl border p-6">
        <div className="space-y-1.5">
          <Label>제목(회사명)</Label>
          <ReadonlyField>{design.title}</ReadonlyField>
        </div>

        {/* 회사명 필드 비활성화(필요 시 주석 해제하여 복구)
        <div className="space-y-1.5">
          <Label>회사명</Label>
          <ReadonlyField empty={!design.company}>{design.company || "입력 안 함"}</ReadonlyField>
        </div>
        */}

        <div className="space-y-2">
          <Label>페이지 유형</Label>
          <PageTypeCards value={design.pageType} readOnly />
        </div>

        <div className="space-y-3">
          <Label>참고 태그</Label>
          {design.tagGroups.length === 0 ? (
            <ReadonlyField empty>선택한 태그가 없습니다</ReadonlyField>
          ) : (
            <div className="space-y-3">
              {design.tagGroups.map((g) => (
                <div key={g.groupLabel} className="space-y-1.5">
                  <p className="text-muted-foreground text-xs">{g.groupLabel}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.options.map((o) => (
                      <span
                        key={o.label}
                        className="border-primary bg-primary/10 text-primary rounded-full border px-2.5 py-1 text-xs"
                      >
                        {o.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>추가 요청사항</Label>
          <ReadonlyField empty={!design.extraNotes} multiline>
            {design.extraNotes || "입력 안 함"}
          </ReadonlyField>
        </div>

        {design.model && (
          <p className="text-muted-foreground/70 text-xs">
            생성 모델 <span className="font-mono">{design.model}</span>
          </p>
        )}
      </div>

      {design.referenceProposals.length > 0 && (
        <ReferenceProposalsSection refs={design.referenceProposals} />
      )}
    </div>
  );
}

function ReferenceProposalsSection({ refs }: { refs: AiDesignReferenceProposal[] }) {
  return (
    <div className="bg-card mt-4 space-y-3 rounded-xl border p-6">
      <Label>참고한 시안 ({refs.length}개)</Label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {refs.map((ref) => (
          <div key={ref.sortOrder} className="group flex flex-col gap-1.5">
            <div className="bg-muted relative aspect-[3/4] overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ref.imageUrl}
                alt={ref.proposalTitle}
                className="h-full w-full object-cover object-top"
              />
            </div>
            <p className="text-muted-foreground line-clamp-1 text-xs">{ref.proposalTitle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
