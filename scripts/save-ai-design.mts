// (repo 도구) Claude Code가 만든 HTML을 ai_designs에 저장. 로직은 공유 서버함수(saveGeneratedDesign) 재사용.
// payload JSON: { title, company?, pageType(main|dashboard|subpage), extraNotes?, optionIds?[], html|htmlFile, analysis?, approach?, model? }
//
// 사용:
//   tsx --env-file=.env.local scripts/save-ai-design.mts --payload=/abs/payload.json

import { readFile } from "node:fs/promises";
import { saveGeneratedDesign } from "@/entities/design-analysis/api/save-generated-design.server";
import type { SaveDesignInput } from "@/entities/design-analysis/api/save-generated-design.server";
import { db } from "@/shared/db";

function argValue(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p?.slice(name.length + 3);
}
const payloadPath = argValue("payload");
if (!payloadPath) {
  console.error("usage: --payload=<file.json>");
  process.exit(1);
}

const payload: SaveDesignInput & { htmlFile?: string } = JSON.parse(await readFile(payloadPath, "utf8"));
const html = payload.htmlFile ? await readFile(payload.htmlFile, "utf8") : payload.html;

const { id } = await saveGeneratedDesign({ ...payload, html });
console.log(`[save-ai-design] inserted id=${id} title="${payload.title}" model=${payload.model ?? "claude-code"}`);
console.log(`뷰어: /studio/ai-designs/${id}/raw`);
await db.$client.end();
process.exit(0);
