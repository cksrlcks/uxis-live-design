import postgres from "postgres";

// current_version_id가 비어 있는 안(variant)을 그 안의 최신 버전으로 채운다.
// createProposal이 초기 안의 current_version_id를 설정하지 않던 시기(Stage 1~)에
// 만들어진 시안은 공개 뷰어 목록에서 빈 안으로 보인다 — 이 백필이 그 데이터를 고친다.
//
// 사용:
//   tsx --env-file=.env.local scripts/backfill-current-version.mts          # dry-run(영향 행 수만)
//   tsx --env-file=.env.local scripts/backfill-current-version.mts --apply  # 실제 갱신

const apply = process.argv.includes("--apply");
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

// 채울 대상: current_version_id가 null이고, 버전이 하나 이상 있는 안 → 그 안의 최신 버전.
const targets = await sql<{ variant_id: string; version_id: string; version_no: number }[]>`
  SELECT DISTINCT ON (pv.id)
    pv.id          AS variant_id,
    ver.id         AS version_id,
    ver.version_no AS version_no
  FROM proposal_variants pv
  JOIN proposal_versions ver ON ver.variant_id = pv.id
  WHERE pv.current_version_id IS NULL
  ORDER BY pv.id, ver.version_no DESC
`;

console.log(`current_version_id가 비어 있어 채울 안: ${targets.length}개`);

if (targets.length === 0) {
  console.log("백필할 데이터가 없습니다.");
  await sql.end();
  process.exit(0);
}

if (!apply) {
  console.log("(dry-run) 실제 갱신하려면 --apply 를 붙여 다시 실행하세요.");
  await sql.end();
  process.exit(0);
}

let updated = 0;
for (const t of targets) {
  await sql`
    UPDATE proposal_variants
    SET current_version_id = ${t.version_id}
    WHERE id = ${t.variant_id} AND current_version_id IS NULL
  `;
  updated += 1;
}

console.log(`백필 완료: ${updated}개 안의 current_version_id를 채웠습니다.`);
await sql.end();
