"use client";
import { useCallback, useEffect, useState } from "react";
import { useRealtimeOptional } from "@/components/realtime/realtime-provider";
import type { PinContext, PinDTO } from "@/lib/pins/types";

export function usePins(pin: PinContext) {
  const rt = useRealtimeOptional();
  const [pins, setPins] = useState<PinDTO[]>([]);
  const { publicId, variantId, versionId } = pin;

  // 활성 버전 핀 로드(버전 전환마다).
  useEffect(() => {
    let alive = true;
    fetch(`/api/p/${publicId}/pins?variant=${variantId}&version=${versionId}`)
      .then((r) => (r.ok ? r.json() : { pins: [] }))
      .then((d) => { if (alive) setPins(d.pins ?? []); })
      .catch(() => { if (alive) setPins([]); });
    return () => { alive = false; };
  }, [publicId, variantId, versionId]);

  // 실시간 병합(현재 버전 대상만).
  useEffect(() => {
    if (!rt) return;
    return rt.subscribePins((e) => {
      if (e.type === "pin_deleted") { setPins((prev) => prev.filter((p) => p.id !== e.id)); return; }
      const p = e.pin;
      if (p.variantId !== variantId || p.versionId !== versionId) return;
      setPins((prev) => {
        const exists = prev.some((x) => x.id === p.id);
        return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
      });
    });
  }, [rt, variantId, versionId]);

  const createPin = useCallback(async (input: { pageOrder: number; xNorm: number; yNorm: number; body: string }) => {
    const res = await fetch(`/api/p/${publicId}/pins`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, versionId, authorColor: rt?.myColor ?? "#3b82f6", ...input }),
    });
    if (!res.ok) return false;
    const { pin: saved } = await res.json();
    setPins((prev) => (prev.some((x) => x.id === saved.id) ? prev : [...prev, saved]));
    rt?.broadcastPin(saved);
    return true;
  }, [rt, publicId, variantId, versionId]);

  const editPin = useCallback(async (id: string, body: string) => {
    const res = await fetch(`/api/p/${publicId}/pins/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
    });
    if (!res.ok) return false;
    const { pin: saved } = await res.json();
    setPins((prev) => prev.map((x) => (x.id === id ? saved : x)));
    rt?.broadcastPinUpdated(saved);
    return true;
  }, [rt, publicId]);

  const toggleResolved = useCallback(async (id: string, resolved: boolean) => {
    const res = await fetch(`/api/p/${publicId}/pins/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolved }),
    });
    if (!res.ok) return false;
    const { pin: saved } = await res.json();
    setPins((prev) => prev.map((x) => (x.id === id ? saved : x)));
    rt?.broadcastPinUpdated(saved);
    return true;
  }, [rt, publicId]);

  const deletePin = useCallback(async (id: string) => {
    const res = await fetch(`/api/p/${publicId}/pins/${id}`, { method: "DELETE" });
    if (!res.ok) return false;
    setPins((prev) => prev.filter((x) => x.id !== id));
    rt?.broadcastPinDeleted(id);
    return true;
  }, [rt, publicId]);

  return { pins, createPin, editPin, toggleResolved, deletePin };
}
