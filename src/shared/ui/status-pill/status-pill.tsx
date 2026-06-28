import type { ReactNode } from "react";
import { Badge } from "@/shared/ui/badge";
import { statusPillVariant, type StatusTone } from "./tone";

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <Badge variant={statusPillVariant(tone)}>{children}</Badge>;
}
