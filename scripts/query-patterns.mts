// (repo 디버그용) 태그 택소노미/패턴 조회 CLI. 실제 배포 스킬은 공개 API를 curl로 호출한다.
// 로직은 공유 서버함수(query-patterns.server.ts)를 재사용한다.
//
// 사용:
//   tsx --env-file=.env.local scripts/query-patterns.mts --list
//   tsx --env-file=.env.local scripts/query-patterns.mts --tags=제안,관광/레저

import { getTagTaxonomy, resolvePatternsByTags } from "@/entities/design-analysis/api/query-patterns.server";
import { db } from "@/shared/db";

function argValue(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p?.slice(name.length + 3);
}

if (process.argv.includes("--list")) {
  const tax = await getTagTaxonomy();
  for (const g of tax.groups) {
    console.log(`\n[${g.label}] (${g.code})`);
    for (const o of g.options) console.log(`  - ${o.label} (${o.code})`);
  }
  await db.$client.end();
  process.exit(0);
}

const tokens = (argValue("tags") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (tokens.length === 0) {
  console.error("사용법: --tags=<라벨 또는 코드 콤마구분>  또는  --list");
  process.exit(1);
}

const res = await resolvePatternsByTags(tokens, { maxSections: 30 });
console.log(
  JSON.stringify(
    {
      matchedTags: res.matchedTags,
      unmatchedTokens: res.unmatchedTokens,
      optionIds: res.optionIds,
      patternCount: res.patterns.patternSnippets.length,
      patterns: res.patterns,
    },
    null,
    2,
  ),
);
await db.$client.end();
process.exit(0);
