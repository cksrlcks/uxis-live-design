// COVA 시안 사전 분석 — Claude Code(로컬 vision) 경로 1/2: 대기 페이지 이미지를 로컬로 내려받고 매니페스트를 만든다.
// 이후 Workflow/서브에이전트가 이 이미지들을 vision으로 읽어 분석하고, save-analysis.mts로 DB에 저장한다.
// (API 과금 대신 Claude Code 사용량으로 분석하는 방식. 야간 자동화는 기존 analyze-designs.mts 사용.)
//
// 사용:
//   tsx --env-file=.env.local scripts/export-pending-images.mts --out=/abs/dir --limit=200
//   tsx --env-file=.env.local scripts/export-pending-images.mts --out=/abs/dir --exposed

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { listPendingPages } from "@/entities/design-analysis/api/list-pending-pages.server";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { db } from "@/shared/db";

function argValue(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p?.slice(name.length + 3);
}
const limit = Number(argValue("limit")) || 200;
const onlyExposed = process.argv.includes("--exposed");
const out = argValue("out") ?? join(process.cwd(), ".analyze-cache");

await mkdir(out, { recursive: true });
const pending = await listPendingPages({ limit, onlyExposed });
console.log(`[export] 대기 페이지: ${pending.length} → ${out}`);

type ManifestItem = {
  pageId: string;
  proposalId: string;
  versionId: string;
  storagePath: string;
  title: string;
  file: string;
};
const manifest: ManifestItem[] = [];

for (const p of pending) {
  const ext = p.storagePath.split(".").pop() || "png";
  const file = join(out, `${p.pageId}.${ext}`);
  try {
    const res = await fetch(publicUrl(p.storagePath));
    if (!res.ok) {
      console.error(`  ✗ ${p.proposalTitle}: fetch ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(file, buf);
    manifest.push({
      pageId: p.pageId,
      proposalId: p.proposalId,
      versionId: p.versionId,
      storagePath: p.storagePath,
      title: p.proposalTitle,
      file,
    });
    console.log(`  ✓ ${p.proposalTitle} (${(buf.length / 1024).toFixed(0)}KB)`);
  } catch (err) {
    console.error(`  ✗ ${p.proposalTitle}: ${err instanceof Error ? err.message : err}`);
  }
}

await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`[export] 이미지 ${manifest.length}장 + manifest.json 기록 완료`);
await db.$client.end();
process.exit(0);
