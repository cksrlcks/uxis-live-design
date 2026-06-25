"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";
import { tagQueries } from "@/entities/tag";
import { MODAL_TAG_GROUP_CODES, PageTypeCards, type PageType } from "@/entities/ai-design";
import { useCreateAiDesign } from "@/entities/ai-design/api/use-ai-design-mutations";

export function CreateAiDesignModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateAiDesign();
  const { data: taxonomy } = useQuery(tagQueries.taxonomy());

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [pageType, setPageType] = useState<PageType | null>(null);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [extraNotes, setExtraNotes] = useState("");

  // 화이트리스트 그룹만 노출. 매칭되는 코드가 없으면(시드 코드 불일치) 전체 그룹을 노출.
  const allGroups = taxonomy ?? [];
  const whitelisted = allGroups.filter((g) => MODAL_TAG_GROUP_CODES.includes(g.code));
  const shownGroups = whitelisted.length > 0 ? whitelisted : allGroups;

  function toggleOption(id: string) {
    setOptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function reset() {
    setTitle("");
    setCompany("");
    setPageType(null);
    setOptionIds([]);
    setExtraNotes("");
  }

  function submit() {
    if (!title.trim()) return toast.error("제목(회사명)을 입력하세요");
    if (!pageType) return toast.error("페이지 유형을 선택하세요");
    create.mutate(
      {
        title: title.trim(),
        company: company.trim() || null,
        pageType,
        optionIds,
        extraNotes: extraNotes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("생성을 시작했습니다. 완료되면 목록에 표시됩니다.");
          onOpenChange(false);
          reset();
        },
        onError: () => toast.error("생성 요청에 실패했습니다"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI 시안 생성</DialogTitle>
          <DialogDescription>
            제목과 페이지 유형은 필수입니다. 참고 태그·추가 요청사항으로 방향을 더 좁힐 수 있어요.
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 max-h-[60vh] space-y-6 overflow-y-auto pr-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-title">제목(회사명)</Label>
            <Input id="ai-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ACME Inc." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-company">회사명(선택, 제목과 다를 때)</Label>
            <Input id="ai-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>페이지 유형</Label>
            <PageTypeCards value={pageType} onChange={setPageType} />
          </div>

          {shownGroups.length > 0 && (
            <div className="space-y-3">
              <Label>참고 태그(선택)</Label>
              <div className="space-y-3">
                {shownGroups.map((g) => (
                  <div key={g.id} className="space-y-1.5">
                    <p className="text-muted-foreground text-xs">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.options.map((o) => {
                        const active = optionIds.includes(o.id);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => toggleOption(o.id)}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs transition-colors",
                              active
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ai-notes">추가 요청사항(선택)</Label>
            <textarea
              id="ai-notes"
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              rows={3}
              placeholder="예: 모던하고 미니멀하게, 파란 계열 톤"
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>취소</DialogClose>
          <Button type="button" onClick={submit} disabled={create.isPending}>
            {create.isPending ? "요청 중…" : "생성하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
