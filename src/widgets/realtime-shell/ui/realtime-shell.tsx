"use client";
import { useEffect, useState } from "react";
import { RealtimeProvider } from "@/shared/realtime/realtime-provider";
import { CollaborationDock } from "./collaboration-dock";
import { type Identity, loadOrCreateIdentity, saveIdentity } from "@/shared/realtime/identity";

export function RealtimeShell({
  publicId,
  viewerName,
  viewerId,
  children,
}: {
  publicId: string;
  viewerName: string | null;
  viewerId: string | null;
  children: React.ReactNode;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: localStorage is browser-only; deferring to effect prevents SSR hydration mismatch
    setIdentity(loadOrCreateIdentity(viewerName));
  }, [viewerName]);

  if (!identity) return <>{children}</>;

  function rename(name: string) {
    setIdentity((prev) => {
      if (!prev) return prev;
      const next = { ...prev, name };
      saveIdentity(next);
      return next;
    });
  }

  return (
    <RealtimeProvider publicId={publicId} identity={identity}>
      {children}
      <CollaborationDock
        publicId={publicId}
        identity={identity}
        onRename={rename}
        isAuthed={viewerName != null}
        viewerId={viewerId}
      />
    </RealtimeProvider>
  );
}
