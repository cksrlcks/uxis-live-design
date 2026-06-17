"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { buttonVariants } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

export function ProposalsListPage() {
  const { data: rows, isPending, isError } = useQuery(proposalQueries.list());

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">시안</h1>
        <Link href="/dashboard/proposals/new" className={buttonVariants()}>
          새 시안
        </Link>
      </div>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>제목</TableHead>
            <TableHead>공개 ID</TableHead>
            <TableHead>공개 상태</TableHead>
            <TableHead className="text-right">링크</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                불러오는 중…
              </TableCell>
            </TableRow>
          )}

          {isError && (
            <TableRow>
              <TableCell colSpan={4} className="text-destructive">
                목록을 불러오지 못했습니다.
              </TableCell>
            </TableRow>
          )}

          {rows?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                아직 시안이 없습니다.
              </TableCell>
            </TableRow>
          )}

          {rows?.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link href={`/dashboard/proposals/${p.id}`} className="underline">
                  {p.title}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs">{p.publicId}</TableCell>
              <TableCell>
                <Badge variant={p.visibility === "public" ? "default" : "outline"}>
                  {p.visibility === "public"
                    ? p.accessPasswordHash
                      ? "공개+비번"
                      : "공개"
                    : "비공개"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/p/${p.publicId}`} className="text-sm underline" target="_blank">
                  뷰어 열기
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
