"use client";
import { Badge } from "@/shared/ui/badge";

type NavItem = { slug: string; label: string };

// Pure presentational nav for the public viewer. Switching is handled by the
// parent in client state (no <Link>/server round-trip) so variants swap instantly.
export function VariantViewerNav({
  items,
  activeSlug,
  onList,
  onSelect,
  onCompare,
}: {
  items: NavItem[];
  activeSlug: string;
  onList: () => void;
  onSelect: (slug: string) => void;
  onCompare: () => void;
}) {
  return (
    <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b p-2">
      <button type="button" onClick={onList} className="text-sm underline">
        목록
      </button>
      <span className="text-muted-foreground">·</span>
      {items.map((it) => (
        <button
          key={it.slug}
          type="button"
          onClick={() => onSelect(it.slug)}
          className="cursor-pointer"
        >
          <Badge variant={it.slug === activeSlug ? "default" : "outline"}>{it.label}</Badge>
        </button>
      ))}
      <span className="text-muted-foreground">·</span>
      <button type="button" onClick={onCompare} className="text-sm underline">
        나란히 보기
      </button>
    </div>
  );
}
