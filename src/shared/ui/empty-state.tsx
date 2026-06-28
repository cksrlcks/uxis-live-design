import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** 빈/제로결과 표준 블록. 테이블 상태 행, 카드 그리드 빈 상태 공용. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      {icon && <div className="text-muted-foreground/50 [&_svg]:size-8">{icon}</div>}
      <div className="space-y-1">
        <p className="text-subtitle text-foreground">{title}</p>
        {description && <p className="text-body text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
