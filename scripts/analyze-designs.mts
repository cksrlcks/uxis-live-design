// COVA 내부 시안 사전 분석 백필.
// proposal_pages를 1회 vision 분석해 proposal_page_analysis / proposal_section_analysis에 저장한다.
// (page_id, analysis_version)로 재분석을 방지하며, 이미 analyzed면 스킵한다.
//
// 사용:
//   npm run analyze:designs                                            # 기본(최대 200페이지)
//   tsx --env-file=.env.local scripts/analyze-designs.mts --limit=20   # 20페이지만
//   tsx --env-file=.env.local scripts/analyze-designs.mts --exposed    # 노출(exposed_to_uxisworks) 시안만
//   tsx --env-file=.env.local scripts/analyze-designs.mts --dry-run    # 대상만 출력(분석 안 함)

import { listPendingPages } from "@/entities/design-analysis/api/list-pending-pages.server";
import { analyzePage } from "@/entities/design-analysis/api/analyze-page.server";
import {
  saveAnalysis,
  markPageFailed,
} from "@/entities/design-analysis/api/analysis-mutations.server";
import { ANALYSIS_MODEL, ANALYSIS_VERSION } from "@/entities/design-analysis/model/constants";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { sendDiscord } from "@/shared/lib/discord";
import { db } from "@/shared/db";

function argValue(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p?.slice(name.length + 3); // "--name=" = 이름 + 3글자
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const limit = Number(argValue("limit")) || 200;
const onlyExposed = hasFlag("exposed");
const dryRun = hasFlag("dry-run");

const startedAt = Date.now();
const pending = await listPendingPages({ limit, onlyExposed });
console.log(
  `[analyze] 대상 페이지: ${pending.length} (version=${ANALYSIS_VERSION}, model=${ANALYSIS_MODEL}` +
    `${onlyExposed ? ", exposed-only" : ""})`,
);

let analyzed = 0;
let failed = 0;
let sectionTotal = 0;
const bySection: Record<string, number> = {};
const failures: string[] = [];

if (dryRun) {
  for (const p of pending) console.log(`  - ${p.proposalTitle} :: ${p.storagePath}`);
  console.log("(dry-run) 실제 분석하려면 --dry-run 없이 실행하세요.");
} else {
  for (const page of pending) {
    const url = publicUrl(page.storagePath);
    try {
      const result = await analyzePage(url, ANALYSIS_MODEL);
      await saveAnalysis(page, result, ANALYSIS_MODEL);
      analyzed += 1;
      sectionTotal += result.sections.length;
      for (const s of result.sections) bySection[s.sectionType] = (bySection[s.sectionType] ?? 0) + 1;
      console.log(`  ✓ ${page.proposalTitle} (${result.sections.length} sections)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "분석 실패";
      await markPageFailed(page, message).catch(() => {});
      failed += 1;
      failures.push(`${page.proposalTitle}: ${message}`);
      console.error(`  ✗ ${page.proposalTitle}: ${message}`);
    }
  }

  const sectionLines = Object.entries(bySection)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `- ${t}: ${n}개`)
    .join("\n");
  const failLines = failures.length
    ? "\n\n실패 항목:\n" + failures.slice(0, 10).map((f) => `- ${f}`).join("\n")
    : "";
  const heading = failed > 0 ? "[COVA 시안 분석 완료(일부 실패)]" : "[COVA 시안 분석 완료]";
  await sendDiscord(
    `${heading}\n\n총 대상: ${pending.length}개\n분석 완료: ${analyzed}개\n실패: ${failed}개\n` +
      `섹션 분석: ${sectionTotal}개` +
      (sectionLines ? `\n\n섹션 분포:\n${sectionLines}` : "") +
      failLines +
      `\n\n버전: ${ANALYSIS_VERSION}`,
  );
}

console.log(
  `[analyze] 완료: analyzed=${analyzed} failed=${failed} sections=${sectionTotal} ms=${Date.now() - startedAt}`,
);

await db.$client.end();
process.exit(0);
