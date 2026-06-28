import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  /** 제목 왼쪽에 붙는 뒤로 가기 화살표 링크의 목적지. */
  backHref?: string;
  /** 타이틀 바로 옆에 인라인으로 붙는 컨트롤(예: 보기 전환 토글). */
  titleAside?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  backHref,
  titleAside,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground -ml-1 mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          목록으로
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && (
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.08em] uppercase">
              {eyebrow}
            </p>
          )}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {titleAside}
          </div>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
