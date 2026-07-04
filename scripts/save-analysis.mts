// COVA 시안 사전 분석 — Claude Code(로컬 vision) 경로 2/2: 서브에이전트가 만든 분석 JSON을 DB에 저장한다.
// analyses.json = [{ pageId, overall, sections }]  (export의 manifest.json과 pageId로 조인)
// parsePageAnalysis로 검증(알 수 없는 섹션/컴포넌트 타입 드롭) 후 saveAnalysis 호출.
//
// 사용:
//   tsx --env-file=.env.local scripts/save-analysis.mts --manifest=/abs/manifest.json --analyses=/abs/analyses.json --model=claude-code

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { saveAnalysis, markPageFailed } from "@/entities/design-analysis/api/analysis-mutations.server";
import { parsePageAnalysis } from "@/entities/design-analysis/model/schemas";
import type { PendingPage } from "@/entities/design-analysis/model/types";
import { db } from "@/shared/db";

function argValue(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p?.slice(name.length + 3);
}
const manifestPath = argValue("manifest");
const analysesPath = argValue("analyses");
const analysesDir = argValue("analyses-dir");
const model = argValue("model") ?? "claude-code";
if (!manifestPath || (!analysesPath && !analysesDir)) {
  console.error("usage: --manifest=<file> (--analyses=<file> | --analyses-dir=<dir>) [--model=claude-code]");
  process.exit(1);
}

type ManifestItem = {
  pageId: string;
  proposalId: string;
  versionId: string;
  storagePath: string;
  title: string;
};
type AnalysisItem = { pageId: string; overall?: unknown; sections?: unknown };

const manifest: ManifestItem[] = JSON.parse(await readFile(manifestPath, "utf8"));

// 단일 파일(--analyses) 또는 배치 디렉터리(--analyses-dir의 모든 *.json 배열을 합침).
let analyses: AnalysisItem[];
if (analysesDir) {
  const files = (await readdir(analysesDir)).filter((f) => f.endsWith(".json"));
  analyses = [];
  for (const f of files) {
    const arr = JSON.parse(await readFile(join(analysesDir, f), "utf8"));
    if (Array.isArray(arr)) analyses.push(...arr);
  }
  console.log(`[save] ${files.length}개 배치 파일에서 ${analyses.length}개 분석 로드`);
} else {
  analyses = JSON.parse(await readFile(analysesPath!, "utf8"));
}
const byId = new Map(manifest.map((m) => [m.pageId, m]));

let saved = 0;
let failed = 0;
let sectionTotal = 0;
for (const a of analyses) {
  const m = byId.get(a.pageId);
  if (!m) {
    console.error(`  ✗ unknown pageId ${a.pageId}`);
    failed += 1;
    continue;
  }
  const page: PendingPage = {
    pageId: m.pageId,
    proposalId: m.proposalId,
    versionId: m.versionId,
    storagePath: m.storagePath,
    proposalTitle: m.title,
  };
  try {
    const parsed = parsePageAnalysis({ overall: a.overall, sections: a.sections });
    await saveAnalysis(page, parsed, model);
    saved += 1;
    sectionTotal += parsed.sections.length;
    console.log(`  ✓ ${m.title} (${parsed.sections.length} sections)`);
  } catch (err) {
    failed += 1;
    await markPageFailed(page, err instanceof Error ? err.message : "save 실패").catch(() => {});
    console.error(`  ✗ ${m.title}: ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`[save] saved=${saved} failed=${failed} sections=${sectionTotal} model=${model}`);
await db.$client.end();
process.exit(0);
