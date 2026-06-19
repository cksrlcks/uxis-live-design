"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/shared/supabase/client";
import { channelName } from "@/shared/realtime/channel";
import type { Identity } from "@/shared/realtime/identity";

// The channel is a generic transport — the relayed payloads are opaque here;
// consumers (chat-panel / pin-layer) cast them to their entity DTOs.
export type PinEvent =
  | { type: "pin"; pin: unknown }
  | { type: "pin_updated"; pin: unknown }
  | { type: "pin_deleted"; id: string };

export type Participant = { id: string; name: string; color: string };
export type RemoteCursor = {
  id: string;
  name: string;
  color: string;
  cx: number;
  cy: number;
};

type RealtimeContextValue = {
  participants: Participant[];
  cursors: RemoteCursor[];
  sendCursor: (cx: number, cy: number) => void;
  clearCursor: () => void;
  subscribeChat: (handler: (message: unknown) => void) => () => void;
  broadcastChat: (message: unknown) => void;
  myColor: string;
  subscribePins: (handler: (e: PinEvent) => void) => () => void;
  broadcastPin: (pin: unknown) => void;
  broadcastPinUpdated: (pin: unknown) => void;
  broadcastPinDeleted: (id: string) => void;
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

export function RealtimeProvider({
  publicId,
  identity,
  children,
}: {
  publicId: string;
  identity: Identity;
  children: React.ReactNode;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const identityRef = useRef<Identity>(identity);
  // eslint-disable-next-line react-hooks/refs -- intentional: keep ref in sync with latest identity without triggering re-renders
  identityRef.current = identity;

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);
  const chatSubsRef = useRef(new Set<(m: unknown) => void>());
  const pinSubsRef = useRef(new Set<(e: PinEvent) => void>());

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

    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      const m = payload as { id?: string };
      if (!m?.id) return; // public channel: drop malformed/garbage chat payloads
      chatSubsRef.current.forEach((h) => h(payload));
    });

    ch.on("broadcast", { event: "pin" }, ({ payload }) => {
      const p = payload as { id?: string };
      if (!p?.id) return;
      pinSubsRef.current.forEach((h) => h({ type: "pin", pin: payload }));
    });
    ch.on("broadcast", { event: "pin_updated" }, ({ payload }) => {
      const p = payload as { id?: string };
      if (!p?.id) return;
      pinSubsRef.current.forEach((h) => h({ type: "pin_updated", pin: payload }));
    });
    ch.on("broadcast", { event: "pin_deleted" }, ({ payload }) => {
      const id = (payload as { id?: string }).id;
      if (!id) return;
      pinSubsRef.current.forEach((h) => h({ type: "pin_deleted", id }));
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
    // 핀 구독 Set은 provider가 비우지 않는다 — 각 소비자(pin-layer bridge effect)가 자기 effect cleanup으로
    // 핸들러를 제거하고, subscribePins는 안정 참조라 채널 재생성과 무관하게 구독이 유지된다.
    // Intentional: only recreate the channel when the room or stable identity id changes,
    // not on every identity object reference change (name/color updates handled separately below).
  }, [publicId, identity.id]);

  // Re-broadcast presence when the display name/color changes (e.g. rename).
  // Only when already joined; before SUBSCRIBED the subscribe callback tracks the latest identity.
  useEffect(() => {
    const ch = channelRef.current;
    if (ch && ch.state === "joined") ch.track({ name: identity.name, color: identity.color });
  }, [identity.name, identity.color]);

  // WebSocket-only delivery: skip when the channel isn't joined (pre-subscribe or
  // dropped). send() would otherwise auto-fall back to REST — now deprecated, and
  // wrong for high-frequency cursors (one HTTP request per move while disconnected).
  const sendCursor = useCallback((cx: number, cy: number) => {
    const ch = channelRef.current;
    if (ch?.state !== "joined") return;
    const me = identityRef.current;
    ch.send({
      type: "broadcast",
      event: "cursor",
      payload: { id: me.id, name: me.name, color: me.color, cx, cy },
    });
  }, []);

  const clearCursor = useCallback(() => {
    const ch = channelRef.current;
    if (ch?.state !== "joined") return;
    ch.send({ type: "broadcast", event: "cursor_leave", payload: { id: identityRef.current.id } });
  }, []);

  const subscribeChat = useCallback((handler: (m: unknown) => void) => {
    chatSubsRef.current.add(handler);
    return () => {
      chatSubsRef.current.delete(handler);
    };
  }, []);

  // 저장 성공(BFF) 후 호출. self:false라 송신자는 자기 broadcast를 못 받으므로
  // 피어에게만 전달. 채널이 joined가 아니면 broadcast는 건너뛴다.
  const broadcastChat = useCallback((message: unknown) => {
    const ch = channelRef.current;
    if (ch?.state === "joined") ch.send({ type: "broadcast", event: "chat", payload: message });
  }, []);

  const subscribePins = useCallback((handler: (e: PinEvent) => void) => {
    pinSubsRef.current.add(handler);
    return () => {
      pinSubsRef.current.delete(handler);
    };
  }, []);

  const broadcastPin = useCallback((pin: unknown) => {
    const ch = channelRef.current;
    if (ch?.state === "joined") ch.send({ type: "broadcast", event: "pin", payload: pin });
  }, []);
  const broadcastPinUpdated = useCallback((pin: unknown) => {
    const ch = channelRef.current;
    if (ch?.state === "joined") ch.send({ type: "broadcast", event: "pin_updated", payload: pin });
  }, []);
  const broadcastPinDeleted = useCallback((id: string) => {
    const ch = channelRef.current;
    if (ch?.state === "joined")
      ch.send({ type: "broadcast", event: "pin_deleted", payload: { id } });
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        participants,
        cursors,
        sendCursor,
        clearCursor,
        subscribeChat,
        broadcastChat,
        myColor: identity.color,
        subscribePins,
        broadcastPin,
        broadcastPinUpdated,
        broadcastPinDeleted,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}
