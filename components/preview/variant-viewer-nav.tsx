import { Badge } from "@/components/ui/badge";

type NavItem = { slug: string; label: string };

export function VariantViewerNav({ publicId, items, activeSlug }: {
  publicId: string; items: NavItem[]; activeSlug: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-2">
      <a href={`/p/${publicId}`} className="text-sm underline">목록</a>
      <span className="text-muted-foreground">·</span>
      {items.map((it) => (
        <a key={it.slug} href={`/p/${publicId}?v=${it.slug}`}>
          <Badge variant={it.slug === activeSlug ? "default" : "outline"}>{it.label}</Badge>
        </a>
      ))}
      <span className="text-muted-foreground">·</span>
      <a href={`/p/${publicId}?compare=1`} className="text-sm underline">나란히 보기</a>
    </div>
  );
}
