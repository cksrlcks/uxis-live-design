"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { channelName } from "@/lib/realtime/channel";
import type { Identity } from "@/lib/realtime/identity";

export type Participant = { id: string; name: string; color: string };
export type RemoteCursor = { id: string; name: string; color: string; cx: number; cy: number };

type RealtimeContextValue = {
  participants: Participant[];
  cursors: RemoteCursor[];
  sendCursor: (cx: number, cy: number) => void;
  clearCursor: () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}

// useRealtime과 같지만 provider 밖에서는 throw 대신 null 반환.
// 비실시간 에디터 프리뷰에서 캔버스 커서 컴포넌트가 no-op하도록.
export function useRealtimeOptional(): RealtimeContextValue | null {
  return useContext(RealtimeContext);
}

export function RealtimeProvider({ publicId, identity, children }: {
  publicId: string; identity: Identity; children: React.ReactNode;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const identityRef = useRef<Identity>(identity);
  // eslint-disable-next-line react-hooks/refs -- intentional: keep ref in sync with latest identity without triggering re-renders
  identityRef.current = identity;

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);

  // (Re)create the channel only when the room or my stable id changes.
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const ch = supabase.channel(channelName(publicId), {
      config: { presence: { key: identity.id }, broadcast: { self: false } },
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ name: string; color: string }>();
      const ids = Object.keys(state);
      setParticipants(
        ids.map((id) => ({
          id,
          name: state[id][0]?.name ?? "Guest",
          color: state[id][0]?.color ?? "#888888",
        })),
      );
      // Drop cursors of peers who have left the room (disconnect sends no cursor_leave).
      const present = new Set(ids);
      setCursors((prev) => prev.filter((c) => present.has(c.id)));
    });

    ch.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const p = payload as RemoteCursor;
      if (p.id === identityRef.current.id) return; // never render our own cursor
      setCursors((prev) => [...prev.filter((c) => c.id !== p.id), p]);
    });
    ch.on("broadcast", { event: "cursor_leave" }, ({ payload }) => {
      const id = (payload as { id: string }).id;
      setCursors((prev) => prev.filter((c) => c.id !== id));
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ name: identityRef.current.name, color: identityRef.current.color });
      }
    });

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // Intentional: only recreate the channel when the room or stable identity id changes,
    // not on every identity object reference change (name/color updates handled separately below).
  }, [publicId, identity.id]);

  // Re-broadcast presence when the display name/color changes (e.g. rename).
  // Only when already joined; before SUBSCRIBED the subscribe callback tracks the latest identity.
  useEffect(() => {
    const ch = channelRef.current;
    if (ch && ch.state === "joined") ch.track({ name: identity.name, color: identity.color });
  }, [identity.name, identity.color]);

  const sendCursor = useCallback((cx: number, cy: number) => {
    const me = identityRef.current;
    channelRef.current?.send({
      type: "broadcast", event: "cursor",
      payload: { id: me.id, name: me.name, color: me.color, cx, cy },
    });
  }, []);

  const clearCursor = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "cursor_leave", payload: { id: identityRef.current.id } });
  }, []);

  return (
    <RealtimeContext.Provider value={{ participants, cursors, sendCursor, clearCursor }}>
      {children}
    </RealtimeContext.Provider>
  );
}
