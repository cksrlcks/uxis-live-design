"use client";

import { GripVertical } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ProposalPage } from "@/entities/proposal";
import { cn } from "@/shared/lib/utils";
import { ALLOWED_IMAGE_TYPES } from "@/shared/lib/proposals/constants";
import {
  useAppendPages,
  useReplacePage,
  useDeletePage,
  useReorderPages,
} from "../api/use-manage-pages";

// 안(variant)의 이미지를 카드 그리드로 직접 관리한다 — 추가/교체/삭제/순서.
// 모든 연산은 안의 현재 버전을 대상으로 하며(버전 개념은 숨김), 성공 시 상세
// 쿼리가 무효화돼 그리드가 새 상태로 갱신된다.
export function PageGrid({
  proposalId,
  variantId,
  versionId,
  pages,
}: {
  proposalId: string;
  variantId: string;
  versionId: string;
  pages: ProposalPage[];
}) {
  const append = useAppendPages(proposalId, variantId, versionId);
  const replace = useReplacePage(proposalId, variantId, versionId);
  const remove = useDeletePage(proposalId, variantId, versionId);
  const reorder = useReorderPages(proposalId, variantId, versionId);
  // 드래그 정렬 — 잡은 카드(dragId)와 드롭 후보(dropTo: 어느 카드의 좌/우).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTo, setDropTo] = useState<{ id: string; after: boolean } | null>(null);

  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);

  const busy = append.isPending || replace.isPending || remove.isPending || reorder.isPending;

  function onAddFiles(files: File[]) {
    if (files.length === 0) return;
    append.mutate(files, {
      onError: (e) => toast.error(e instanceof Error ? e.message : "이미지 추가에 실패했습니다."),
    });
  }

  function triggerReplace(pageId: string) {
    replaceTargetRef.current = pageId;
    replaceInputRef.current?.click();
  }
  function onReplaceFile(file: File | undefined) {
    const pageId = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!file || !pageId) return;
    replace.mutate(
      { pageId, file },
      {
        onError: (e) => toast.error(e instanceof Error ? e.message : "이미지 교체에 실패했습니다."),
      },
    );
  }

  function onDelete(pageId: string) {
    if (!confirm("이 이미지를 삭제할까요?")) return;
    remove.mutate(pageId, {
      onSuccess: () => toast.success("삭제했습니다"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다."),
    });
  }

  // 화살표 키 정렬 — 그립 포커스 상태에서 인접 카드와 교환.
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (busy || target < 0 || target >= pages.length) return;
    const ids = pages.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids, {
      onError: (e) => toast.error(e instanceof Error ? e.message : "순서 변경에 실패했습니다."),
    });
  }

  // fromId를 refId의 앞/뒤로 끼워 넣은 새 순서로 재정렬.
  function reorderTo(fromId: string, refId: string, after: boolean) {
    if (busy || fromId === refId) return;
    const ids = pages.map((p) => p.id).filter((id) => id !== fromId);
    const at = ids.indexOf(refId) + (after ? 1 : 0);
    ids.splice(at, 0, fromId);
    reorder.mutate(ids, {
      onError: (e) => toast.error(e instanceof Error ? e.message : "순서 변경에 실패했습니다."),
    });
  }

  function resetDrag() {
    setDragId(null);
    setDropTo(null);
  }

  return (
    <div className="space-y-3">
      {/* 숨은 파일 입력 — 추가(다중) / 교체(단일) */}
      <input
        ref={addInputRef}
        type="file"
        multiple
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          onAddFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          onReplaceFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pages.map((pg, i) => {
          const isDragging = pg.id === dragId;
          const showLeft = dropTo?.id === pg.id && !dropTo.after;
          const showRight = dropTo?.id === pg.id && dropTo.after;

          return (
            <div
              key={pg.id}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const after = e.clientX > rect.left + rect.width / 2;
                if (dropTo?.id !== pg.id || dropTo.after !== after) setDropTo({ id: pg.id, after });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dropTo) reorderTo(dragId, dropTo.id, dropTo.after);
                resetDrag();
              }}
              className={cn(
                "group bg-muted relative aspect-4/3 overflow-hidden rounded-xl border transition-all",
                "border-border/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-foreground/30 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12)]",
                isDragging && "opacity-40",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pg.url} alt="" className="h-full w-full object-contain" />

              {/* 드롭 위치 인디케이터 (좌/우 세로 바) */}
              {showLeft && (
                <span className="bg-primary pointer-events-none absolute inset-y-1 left-1 z-20 w-1 rounded-full" />
              )}
              {showRight && (
                <span className="bg-primary pointer-events-none absolute inset-y-1 right-1 z-20 w-1 rounded-full" />
              )}

              {/* 인덱스 뱃지 — 항상 표시 */}
              <span className="bg-foreground/75 text-background absolute top-2 left-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-mono text-xs tabular-nums backdrop-blur-sm">
                {i + 1}
              </span>

              {/* 그립 — 드래그 핸들 + 화살표 키 정렬 (hover 시 노출) */}
              <button
                type="button"
                draggable={!busy && pages.length > 1}
                onDragStart={(e) => {
                  if (busy || pages.length <= 1) return;
                  setDragId(pg.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={resetDrag}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    move(i, -1);
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    move(i, 1);
                  }
                }}
                disabled={busy || pages.length <= 1}
                aria-label="순서 변경 — 끌어서 이동하거나 화살표 키 사용"
                className="bg-background/85 text-foreground/70 hover:text-foreground absolute top-2 right-2 z-10 flex size-7 cursor-grab items-center justify-center rounded-md opacity-0 shadow-sm backdrop-blur-sm transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing disabled:hidden"
              >
                <GripVertical className="size-4" />
              </button>

              {/* 액션 오버레이 — 교체 / 삭제 (hover 시 하단 스크림 위에 노출, 카드 높이엔 영향 없음) */}
              <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-end gap-1 bg-linear-to-t from-black/55 via-black/20 to-transparent px-2 pt-8 pb-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => triggerReplace(pg.id)}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors outline-none hover:bg-black/70 hover:text-white focus-visible:bg-black/70 disabled:cursor-default disabled:opacity-50"
                >
                  교체
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(pg.id)}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors outline-none hover:bg-black/70 hover:text-red-300 focus-visible:bg-black/70 disabled:cursor-default disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}

        {/* 이미지 추가 타일 */}
        <button
          type="button"
          disabled={busy}
          onClick={() => addInputRef.current?.click()}
          className="border-border text-muted-foreground hover:border-foreground/40 hover:bg-foreground/3 hover:text-foreground flex aspect-4/3 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm transition-colors disabled:opacity-50"
        >
          <span className="text-2xl leading-none">＋</span>
          이미지 추가
        </button>
      </div>

      {busy && <p className="text-muted-foreground text-sm">처리 중…</p>}
    </div>
  );
}
