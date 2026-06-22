"use client";
import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Columns2,
  Frame,
  LayoutGrid,
  type LucideIcon,
  Maximize2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

type NavItem = { slug: string; label: string };
type VersionItem = { id: string; versionNo: number };

// 프리뷰 페이지의 모든 컨트롤을 하나로 묶는 하단 중앙 플로팅 블랙 독.
// 우측 상단 협업 dock(presence-bar)과 같은 톤(bg-foreground/95 + backdrop-blur)으로
// 통일했다. 컴포넌트는 순수 표현용 — 상태/전환은 부모(public-viewer)가 관리한다.
export function ViewerDock({
  items,
  activeSlug,
  compareActive,
  comparable = true,
  onList,
  onSelect,
  onCompare,
  view,
  onView,
  versions,
  activeVersionId,
  onVersion,
  collapsed,
  onCollapsedChange,
}: {
  items: NavItem[];
  activeSlug: string;
  compareActive: boolean;
  // 시안이 한 종류뿐이면 나란히보기는 의미가 없어 버튼을 숨긴다.
  comparable?: boolean;
  onList: () => void;
  onSelect: (slug: string) => void;
  onCompare: () => void;
  // 안이 활성일 때만 노출되는 부가 컨트롤
  view?: "fullscreen" | "canvas";
  onView?: (v: "fullscreen" | "canvas") => void;
  versions?: VersionItem[];
  activeVersionId?: string;
  onVersion?: (id: string) => void;
  // 접기/펴기 상태는 부모(public-viewer)가 관리한다 — 같은 화면의 캔버스
  // 일반/코멘트 컨트롤러도 함께 숨겨야 하기 때문.
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  if (collapsed) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          aria-label="컨트롤러 펼치기"
          className="pointer-events-auto flex h-6 w-14 cursor-pointer items-center justify-center rounded-t-full bg-foreground/95 text-white/70 shadow-lg backdrop-blur-md transition-colors hover:text-white"
        >
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="no-scrollbar pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-full bg-foreground/95 px-1.5 py-1.5 shadow-lg backdrop-blur-md">
        <DockButton active={false} icon={LayoutGrid} onClick={onList}>
          목록
        </DockButton>

        <Divider />

        {items.map((it) => (
          <DockButton
            key={it.slug}
            active={it.slug === activeSlug}
            onClick={() => onSelect(it.slug)}
          >
            {it.label}
          </DockButton>
        ))}

        {versions && versions.length > 1 && onVersion && (
          <>
            <Divider />
            <VersionSelect
              versions={versions}
              activeVersionId={activeVersionId}
              onVersion={onVersion}
            />
          </>
        )}

        {comparable && (
          <>
            <Divider />
            <DockButton active={compareActive} icon={Columns2} onClick={onCompare}>
              나란히
            </DockButton>
          </>
        )}

        {view && onView && (
          <>
            <Divider />
            <DockButton
              active={view === "fullscreen"}
              icon={Maximize2}
              onClick={() => onView("fullscreen")}
            >
              풀화면
            </DockButton>
            <DockButton active={view === "canvas"} icon={Frame} onClick={() => onView("canvas")}>
              캔버스
            </DockButton>
          </>
        )}

        <Divider />

        <button
          type="button"
          onClick={() => onCollapsedChange(true)}
          aria-label="컨트롤러 숨기기"
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function DockButton({
  active,
  icon: Icon,
  onClick,
  children,
}: {
  active: boolean;
  icon?: LucideIcon;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-white text-foreground shadow-sm"
          : "text-white/60 hover:bg-white/10 hover:text-white",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}

// 버전은 개수가 많아질 수 있어 버튼 나열 대신 셀렉트로 압축한다.
// 트리거는 dock 톤(어두운 배경 + 흰 텍스트)에 맞춰 오버라이드한다.
function VersionSelect({
  versions,
  activeVersionId,
  onVersion,
}: {
  versions: VersionItem[];
  activeVersionId?: string;
  onVersion: (id: string) => void;
}) {
  const active = versions.find((vv) => vv.id === activeVersionId);
  return (
    <Select value={activeVersionId ?? ""} onValueChange={(v) => onVersion(v as string)}>
      <SelectTrigger
        size="sm"
        aria-label="버전 선택"
        className="h-auto shrink-0 gap-1.5 rounded-full border-transparent bg-transparent py-1.5 pr-2 pl-3 text-xs font-medium text-white/80 shadow-none hover:bg-white/10 hover:text-white focus-visible:ring-0 [&_svg]:text-white/50"
      >
        {active ? `v${active.versionNo}` : "버전"}
      </SelectTrigger>
      <SelectContent>
        {versions.map((vv) => (
          <SelectItem key={vv.id} value={vv.id}>
            v{vv.versionNo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-white/15" />;
}
