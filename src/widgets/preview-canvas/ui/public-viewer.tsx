"use client";
import { useMemo } from "react";
import { useQueryStates, parseAsString, parseAsStringEnum } from "nuqs";
import type { ViewerVariant } from "@/entities/proposal";
import type { PinContext } from "@/entities/pin";
import { useViewerChrome } from "@/shared/viewer-chrome/viewer-chrome";
import { ProposalPreview } from "./proposal-preview";
import { CompareView } from "./compare-view";
import { ViewerDock } from "./viewer-dock";
import { VariantList } from "./variant-list";
import { ViewerHelpModal } from "./viewer-help-modal";
import { usePrefetchImages } from "../lib/use-prefetch-images";

// The whole public viewer runs client-side. The server renders this once with
// EVERY variant's pages already signed; switching list ↔ 안 ↔ 나란히 here only
// updates the URL (shallow → no server round-trip) and swaps already-loaded,
// already-cached images, so it's instant. The URL contract is unchanged
// (?v=slug single, ?compare=1 side-by-side, neither = list) so shared/deep links
// and the back button still work.
export function PublicViewer({
  variants,
  publicId,
  viewer,
  proposalTitle,
  whiteboardEnabled = false,
}: {
  variants: ViewerVariant[];
  publicId: string;
  viewer: { id: string } | null;
  proposalTitle: string;
  // 시안별 화이트보드 on/off 설정. 기본 꺼짐.
  whiteboardEnabled?: boolean;
}) {
  const [{ v, compare, ver, view }, setQuery] = useQueryStates(
    {
      v: parseAsString,
      compare: parseAsString,
      ver: parseAsString,
      view: parseAsStringEnum(["fullscreen", "canvas"] as const)
        .withDefault("fullscreen")
        .withOptions({ history: "replace" }),
    },
    { shallow: true, history: "push" },
  );

  // 하단 컨트롤러 접기 상태 — dock과 캔버스의 일반/코멘트 컨트롤러, 그리고 우측 협업 dock을
  // 함께 숨긴다. 우측 dock은 다른 트리(layout shell)에 있어 context로 상태를 공유한다.
  const { collapsed: dockCollapsed, setCollapsed: setDockCollapsed } = useViewerChrome();

  // 시안이 한 종류뿐이면 나란히보기는 의미가 없어 dock에서 숨긴다.
  const comparable = variants.length > 1;

  // Warm every version's images in the background so the first switch is cached.
  const allUrls = useMemo(
    () => variants.flatMap((vr) => vr.versions.flatMap((vv) => vv.pages.map((p) => p.url))),
    [variants],
  );
  usePrefetchImages(allUrls);

  const navItems = useMemo(
    () => variants.map((vr) => ({ slug: vr.slug, label: vr.label })),
    [variants],
  );

  // 안을 열거나 목록/나란히로 갈 때 버전 선택(?ver)은 초기화 → 안의 기본(최신) 버전.
  // 목록으로 돌아갈 때는 view까지 비워 쿼리스트링을 완전히 초기화한다.
  const showList = () => setQuery({ v: null, compare: null, ver: null, view: null });
  const showVariant = (slug: string) => setQuery({ v: slug, compare: null, ver: null });
  const showCompare = () => setQuery({ v: null, compare: "1", ver: null });

  if (compare) {
    const columns = variants.map((vr) => ({ slug: vr.slug, label: vr.label, pages: vr.pages }));
    return (
      <div className="relative h-screen w-screen">
        <div className="absolute inset-0">
          <CompareView columns={columns} />
        </div>
        <ViewerDock
          items={navItems}
          activeSlug=""
          compareActive
          comparable={comparable}
          onList={showList}
          onSelect={showVariant}
          onCompare={showCompare}
          collapsed={dockCollapsed}
          onCollapsedChange={setDockCollapsed}
        />
      </div>
    );
  }

  const active = v ? variants.find((vr) => vr.slug === v) : null;
  if (active) {
    // ?ver이 이 안에 속하지 않으면 현재(최신) 버전으로 복귀.
    const selectedVer =
      active.versions.find((vv) => vv.id === ver) ??
      active.versions.find((vv) => vv.id === active.currentVersionId) ??
      active.versions[active.versions.length - 1];
    const pages = selectedVer?.pages ?? active.pages;
    const pin: PinContext | undefined = selectedVer?.id
      ? {
          publicId,
          variantId: active.id,
          versionId: selectedVer.id,
          viewerId: viewer?.id ?? null,
        }
      : undefined;

    return (
      <div className="relative h-screen w-screen">
        <ViewerHelpModal />
        {/* key resets per-version view state (slide index, canvas zoom); the
            fullscreen/canvas choice lives in ?view so it survives the remount. */}
        <div className="absolute inset-0">
          <ProposalPreview
            key={selectedVer?.id ?? active.slug}
            pages={pages}
            pin={pin}
            view={view}
            controlsHidden={dockCollapsed}
            whiteboardEnabled={whiteboardEnabled}
          />
        </div>
        <ViewerDock
          items={navItems}
          activeSlug={active.slug}
          compareActive={false}
          comparable={comparable}
          onList={showList}
          onSelect={showVariant}
          onCompare={showCompare}
          view={view}
          onView={(next) => setQuery({ view: next })}
          versions={active.versions.map((vv) => ({ id: vv.id, versionNo: vv.versionNo }))}
          activeVersionId={selectedVer?.id}
          onVersion={(id) => setQuery({ ver: id })}
          collapsed={dockCollapsed}
          onCollapsedChange={setDockCollapsed}
        />
      </div>
    );
  }

  // Default: list of 안. (Includes the case where ?v points to an unknown slug.)
  const cards = variants.map((vr) => ({
    slug: vr.slug,
    label: vr.label,
    thumb: vr.pages[0] ?? null,
    pageCount: vr.pages.length,
  }));
  return <VariantList title={proposalTitle} items={cards} onOpen={showVariant} />;
}
