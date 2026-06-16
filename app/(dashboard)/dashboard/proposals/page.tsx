import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals } from "@/drizzle/schema";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ProposalsPage() {
  const rows = await db.select().from(proposals).orderBy(desc(proposals.updatedAt));
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">시안</h1>
        <Link href="/dashboard/proposals/new" className={buttonVariants()}>새 시안</Link>
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
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-muted-foreground">아직 시안이 없습니다.</TableCell></TableRow>
          )}
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link href={`/dashboard/proposals/${p.id}`} className="underline">{p.title}</Link>
              </TableCell>
              <TableCell className="font-mono text-xs">{p.publicId}</TableCell>
              <TableCell>
                <Badge variant={p.visibility === "public" ? "default" : "outline"}>
                  {p.visibility === "public" ? (p.accessPasswordHash ? "공개+비번" : "공개") : "비공개"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/p/${p.publicId}`} className="text-sm underline" target="_blank">뷰어 열기</Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
