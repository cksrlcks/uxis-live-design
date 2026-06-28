"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isDarkRoute } from "@/shared/lib/theme-routes";
import { Toaster } from "@/shared/ui/sonner";

// Route-driven theme owner. The studio/admin surface renders dark; the home and
// viewer surfaces stay light. Toggling the `dark` class on <html> (rather than a
// scoped wrapper) means body-level portals — dialogs, dropdowns, selects, toasts
// — inherit the correct theme automatically. First paint is handled by the inline
// script in the root layout; this keeps it in sync across client navigations.
export function RouteTheme() {
  const pathname = usePathname() ?? "";
  const dark = isDarkRoute(pathname);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return <Toaster theme={dark ? "dark" : "light"} />;
}
