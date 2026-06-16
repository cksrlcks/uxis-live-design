"use client";
import { useQueryState, parseAsStringEnum } from "nuqs";
import type { PreviewPage } from "@/lib/preview/types";
import { FullscreenSlides } from "./fullscreen-slides";
import { CanvasView } from "./canvas-view";
import { Button } from "@/components/ui/button";

// Remembered in the URL as ?view=canvas (default "fullscreen" is omitted from the URL).
// nuqs defaults to shallow + history:replace → toggling updates the URL without a server round-trip.
const viewParser = parseAsStringEnum(["fullscreen", "canvas"] as const).withDefault("fullscreen");

export function ProposalPreview({ pages }: { pages: PreviewPage[] }) {
  const [view, setView] = useQueryState("view", viewParser);
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <Button size="sm" variant={view === "fullscreen" ? "default" : "outline"} onClick={() => setView("fullscreen")}>풀화면</Button>
        <Button size="sm" variant={view === "canvas" ? "default" : "outline"} onClick={() => setView("canvas")}>캔버스</Button>
      </div>
      <div className="min-h-0 flex-1">
        {view === "fullscreen" ? <FullscreenSlides pages={pages} /> : <CanvasView pages={pages} />}
      </div>
    </div>
  );
}
