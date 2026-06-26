"use client";
import { useState, useEffect } from "react";
import { Maximize2, Frame } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

const STORAGE_KEY = "viewer_help_dismissed_at";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function ViewerHelpModal() {
  const [open, setOpen] = useState(false);
  const [noShowWeek, setNoShowWeek] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const dismissedAt = parseInt(raw, 10);
      if (Date.now() - dismissedAt < ONE_WEEK_MS) return;
    }
    setOpen(true);
  }, []);

  const close = () => {
    if (noShowWeek) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>뷰어 사용 안내</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex gap-3 rounded-lg bg-muted/60 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background">
              <Maximize2 className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">풀화면 모드</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                클릭하거나 방향키(← →)를 누르면 슬라이드가 순환합니다.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg bg-muted/60 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background">
              <Frame className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">캔버스 모드</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                마우스 휠로 확대/축소하고,
                <br />
                휠 버튼을 누르거나 일반 모드에서 좌클릭으로 드래그합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={noShowWeek}
              onChange={(e) => setNoShowWeek(e.target.checked)}
              className="size-4 cursor-pointer accent-foreground"
            />
            <span className="text-xs text-muted-foreground">일주일 동안 보지 않기</span>
          </label>
          <Button size="sm" onClick={close}>
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
