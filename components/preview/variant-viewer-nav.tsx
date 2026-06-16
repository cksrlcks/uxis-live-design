import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type NavItem = { slug: string; label: string };

export function VariantViewerNav({ publicId, items, activeSlug }: {
  publicId: string; items: NavItem[]; activeSlug: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-2">
      <Link href={`/p/${publicId}`} className="text-sm underline">목록</Link>
      <span className="text-muted-foreground">·</span>
      {items.map((it) => (
        <Link key={it.slug} href={`/p/${publicId}?v=${it.slug}`}>
          <Badge variant={it.slug === activeSlug ? "default" : "outline"}>{it.label}</Badge>
        </Link>
      ))}
      <span className="text-muted-foreground">·</span>
      <Link href={`/p/${publicId}?compare=1`} className="text-sm underline">나란히 보기</Link>
    </div>
  );
}
