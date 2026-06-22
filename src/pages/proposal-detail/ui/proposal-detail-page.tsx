"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { proposalQueries } from "@/entities/proposal";
import { ProposalSettings } from "@/features/edit-proposal-settings";
import { PageHeader } from "@/widgets/studio-shell";
import { VariantTabs } from "./variant-tabs";
import { SectionNav } from "./section-nav";
import { ProposalEditorPreview } from "@/widgets/preview-canvas";

export function ProposalDetailPage({ proposalId }: { proposalId: string }) {
  const { data, isPending, isError } = useQuery(proposalQueries.detail(proposalId));
  // 좌측 메뉴 = 탭. 활성 탭만 본문에 렌더링하고 ?tab으로 URL에 유지한다.
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringEnum(["settings", "variants"] as const)
      .withDefault("settings")
      .withOptions({ history: "push" }),
  );

  if (isPending)
    return (
      <div className="bg-card mx-auto max-w-3xl rounded-2xl border px-6 py-12 text-center text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  if (isError || !data)
    return (
      <div className="bg-card mx-auto max-w-3xl rounded-2xl border px-6 py-12 text-center text-sm text-destructive">
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

  // Mirror the RSC page's `if (variants.length === 0) notFound()` guard: VariantTabs /
  // ProposalEditorPreview read `active.label` unconditionally and crash on an empty list.
  if (variants.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={proposal.title} description={headerDescription} />
        <p className="text-muted-foreground text-sm">표시할 안이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={proposal.title} description={headerDescription} />

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
                domain={proposal.domain}
                visibility={proposal.visibility}
                hasPassword={proposal.hasPassword}
              />
            </section>
          )}

          {/* 좌: 안 선택/추가 · 우: 미리보기(캔버스)+버전 — ?variant URL 파라미터로 연동 */}
          {tab === "variants" && (
            <section>
              <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="self-start lg:sticky lg:top-7">
                  {/* 사이트설정 카드와 동일한 표면 — 회색 셸 배경 위에서 또렷하게 보이도록 */}
                  <div className="bg-card overflow-hidden rounded-xl p-3 ring-1 ring-foreground/10">
                    <VariantTabs
                      proposalId={proposal.id}
                      variants={variants.map((v) => ({ id: v.id, label: v.label, slug: v.slug }))}
                    />
                  </div>
                </aside>

                <div className="min-w-0">
                  <div className="bg-card rounded-xl p-4 ring-1 ring-foreground/10 sm:p-5">
                    <ProposalEditorPreview proposalId={proposal.id} variants={variants} />
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
