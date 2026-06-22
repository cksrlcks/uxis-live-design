"use client";
import { Plus, Trash2 } from "lucide-react";
import { useQueryState, parseAsString } from "nuqs";
import type { EditorVariant } from "@/entities/proposal";
import { PageGrid } from "@/features/manage-pages";
import { useAddVersion, useDeleteVersion } from "@/features/manage-versions";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

// 활성 안(variant)의 버전 히스토리를 다루는 편집 영역. ?variant는 VariantTabs와,
// ?version은 이 영역이 관리한다(둘 다 shallow → 서버 왕복 없음). 안마다 버전이
// 독립이며, 각 버전의 이미지를 카드 그리드로 직접 편집한다. 복원은 없고 새 버전
// 추가/삭제만 제공한다 — 새 버전은 빈 상태이고 추가 즉시 기본이 된다.
export function ProposalEditorPreview({
  proposalId,
  variants,
}: {
  proposalId: string;
  variants: EditorVariant[];
}) {
  const [variantId] = useQueryState(
    "variant",
    parseAsString.withOptions({ shallow: true, history: "push" }),
  );
  const [versionId, setVersionId] = useQueryState(
    "version",
    parseAsString.withOptions({ shallow: true, history: "push" }),
  );

  const active = variants.find((v) => v.id === variantId) ?? variants[0];

  const addVersion = useAddVersion(proposalId, active?.id ?? "");
  const deleteVersion = useDeleteVersion(proposalId, active?.id ?? "");

  if (!active) return null;

  // ?version이 활성 안에 속하지 않으면(안 전환 직후 등) 현재(최신) 버전으로 복귀.
  const selected =
    active.versions.find((v) => v.id === versionId) ??
    active.versions.find((v) => v.id === active.currentVersionId) ??
    active.versions[active.versions.length - 1];

  if (!selected) return null;

  const busy = addVersion.isPending || deleteVersion.isPending;

  async function addAndSelect() {
    if (busy) return;
    try {
      const { versionId: newId } = await addVersion.mutateAsync();
      setVersionId(newId);
    } catch {
      /* 토스트는 상위에서 다루지 않으므로 조용히 무시 — 실패 시 목록은 그대로 */
    }
  }

  async function removeSelected() {
    if (busy || active.versions.length <= 1) return;
    if (!confirm(`v${selected.versionNo} 버전을 삭제할까요? 이 버전의 이미지가 모두 삭제됩니다.`))
      return;
    try {
      await deleteVersion.mutateAsync(selected.id);
      setVersionId(null); // 서버가 옮긴 최신 current로 복귀
    } catch {
      /* no-op */
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-1 text-lg font-medium">{active.label}</h2>
        {/* 버전 선택 — 안마다 독립 히스토리. 세그먼트 컨트롤로 묶어 시각적 그룹화. */}
        <div className="bg-muted/60 flex flex-wrap items-center gap-0.5 rounded-lg p-0.5">
          {active.versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVersionId(v.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm transition-colors",
                v.id === selected.id
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              v{v.versionNo}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1.5">
          <Button size="default" variant="outline" disabled={busy} onClick={addAndSelect}>
            <Plus />
            {addVersion.isPending ? "추가 중…" : "새 버전"}
          </Button>
          <Button
            size="default"
            variant="ghost"
            disabled={busy || active.versions.length <= 1}
            onClick={removeSelected}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
            버전 삭제
          </Button>
        </div>
      </div>

      <PageGrid
        key={selected.id}
        proposalId={proposalId}
        variantId={active.id}
        versionId={selected.id}
        pages={selected.pages}
      />
    </section>
  );
}
