"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

// 브라우저 confirm() 대체. Promise를 돌려주므로 호출부에서 `if (!(await confirm({...}))) return;`
// 처럼 기존 분기 흐름을 그대로 유지할 수 있다.
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setOptions(opts);
      }),
    [],
  );

  // 취소/확인/배경클릭/ESC 모두 한 경로로 정리 — resolveRef를 비워 중복 resolve를 막는다.
  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!options} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{options?.title}</DialogTitle>
            {options?.description && <DialogDescription>{options.description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              {options?.cancelLabel ?? "취소"}
            </Button>
            <Button variant="default" onClick={() => settle(true)}>
              {options?.confirmLabel ?? "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
