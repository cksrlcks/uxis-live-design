"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { ArrowUpRight } from "lucide-react";
import { proposalQueries } from "@/entities/proposal";
import { ProposalSettings } from "@/features/edit-proposal-settings";
import { ProposalTagsPanel } from "@/features/assign-proposal-tags";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { PageHeader } from "@/widgets/studio-shell";
import { VariantTabs } from "./variant-tabs";
import { SectionNav } from "./section-nav";
import { ProposalEditorPreview } from "@/widgets/preview-canvas";

export function ProposalDetailPage({ proposalId }: { proposalId: string }) {
  const { data, isPending, isError } = useQuery(proposalQueries.detail(proposalId));
  // 좌측 메뉴 = 탭. 활성 탭만 본문에 렌더링하고 ?tab으로 URL에 유지한다.
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringEnum(["settings", "variants", "tags"] as const)
      .withDefault("settings")
      .withOptions({ history: "push" }),
  );

  // 시안 목록에서 썸네일 뷰로 들어왔으면(?view=thumb) 목록으로 돌아갈 때 그 뷰를 복원한다.
  // 목록에 새로 진입한 경우엔 ?view 가 없어 기본 리스트로 보인다.
  const [fromView] = useQueryState("view", parseAsString);
  const backHref = fromView === "thumb" ? "/studio/proposals?view=thumb" : "/studio/proposals";

  if (isPending)
    return (
      <div className="mx-auto max-w-6xl">
        {/* PageHeader 자리 — 제목 + 설명 */}
        <div className="mb-6">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="mt-2 h-4 w-36" />
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* 좌측 탭 메뉴(SectionNav) 자리 — 버튼 2개 */}
          <aside className="w-full shrink-0 lg:w-48">
            <div className="flex flex-col gap-1 lg:sticky lg:top-7">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          </aside>

          {/* 본문(사이트설정 탭) 자리 — 설정 카드 스택 */}
          <div className="min-w-0 flex-1">
            <div className="space-y-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-56" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-9 w-full max-w-md" />
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="ml-auto h-10 w-16" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  if (isError || !data)
    return (
      <div className="bg-card text-destructive mx-auto max-w-3xl rounded-2xl border px-6 py-12 text-center text-sm">
        시안을 불러오지 못했습니다.
      </div>
    );

  const { proposal, variants } = data;

  // 공개 URL — publicId(+ 지정 시 커스텀 도메인)로 뷰어를 새 창에서 연다.
  const headerDescription = (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <a
        href={`/p/${proposal.publicId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground font-mono text-xs hover:underline"
      >
        /p/{proposal.publicId}
      </a>
      {proposal.domain && (
        <>
          <span className="text-muted-foreground text-base leading-none" aria-hidden>
            ·
          </span>
          <a
            href={`/p/${proposal.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground font-mono text-xs hover:underline"
          >
            /p/{proposal.domain}
          </a>
        </>
      )}
    </span>
  );

  // 상단 우측 액션 — 공개ID/도메인 뷰어를 새 창에서 연다. 도메인 미지정 시 해당 버튼은 숨김.
  const headerActions = (
    <>
      <Button
        variant="outline"
        nativeButton={false}
        render={<a href={`/p/${proposal.publicId}`} target="_blank" rel="noopener noreferrer" />}
      >
        공개ID
        <ArrowUpRight />
      </Button>
      {proposal.domain && (
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={`/p/${proposal.domain}`} target="_blank" rel="noopener noreferrer" />}
        >
          도메인
          <ArrowUpRight />
        </Button>
      )}
    </>
  );

  // Mirror the RSC page's `if (variants.length === 0) notFound()` guard: VariantTabs /
  // ProposalEditorPreview read `active.label` unconditionally and crash on an empty list.
  if (variants.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title={proposal.title}
          backHref={backHref}
          description={headerDescription}
          actions={headerActions}
        />
        <p className="text-muted-foreground text-sm">표시할 안이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={proposal.title}
        backHref={backHref}
        description={headerDescription}
        actions={headerActions}
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* 좌측 탭 메뉴 — 활성 탭만 본문에 표시(?tab) */}
        <aside className="w-full shrink-0 lg:w-48">
          <div className="lg:sticky lg:top-7">
            <SectionNav value={tab} onChange={setTab} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {tab === "settings" && (
            <section>
              <ProposalSettings
                proposalId={proposal.id}
                title={proposal.title}
                participants={proposal.participants}
                workYear={proposal.workYear}
                domain={proposal.domain}
                figmaUrl={proposal.figmaUrl}
                visibility={proposal.visibility}
                hasPassword={proposal.hasPassword}
                whiteboardEnabled={proposal.whiteboardEnabled}
                liveMode={proposal.liveMode}
                exposedToUxisworks={proposal.exposedToUxisworks}
              />
            </section>
          )}

          {/* 좌: 안 선택/추가 · 우: 미리보기(캔버스)+버전 — ?variant URL 파라미터로 연동 */}
          {tab === "variants" && (
            <section>
              <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="self-start lg:sticky lg:top-7">
                  {/* 사이트설정 카드와 동일한 표면 — 회색 셸 배경 위에서 또렷하게 보이도록 */}
                  <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl p-3 ring-1">
                    <VariantTabs
                      proposalId={proposal.id}
                      variants={variants.map((v) => ({ id: v.id, label: v.label, slug: v.slug }))}
                    />
                  </div>
                </aside>

                <div className="min-w-0">
                  <div className="bg-card ring-foreground/10 rounded-xl p-4 ring-1 sm:p-5">
                    <ProposalEditorPreview proposalId={proposal.id} variants={variants} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === "tags" && (
            <section>
              <ProposalTagsPanel proposalId={proposal.id} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
