type Matched = { proposalId: string; matches: number };
type Variant = { proposalId: string; currentVersionId: string | null; sortOrder: number };
type Page = { versionId: string; storagePath: string; pageOrder: number };

// matched(매칭수 desc 정렬됨)의 순서를 보존하며, 각 시안에서 sortOrder가 빠른 안의
// currentVersion 첫 페이지(pageOrder 최소)를 커버로 고른다. 이미지가 없는 시안은 건너뛴다.
export function pickCoverPaths(
  matched: Matched[],
  variants: Variant[],
  pages: Page[],
): { proposalId: string; storagePath: string }[] {
  const versionsByProposal = new Map<string, string[]>();
  for (const v of [...variants].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!v.currentVersionId) continue;
    const list = versionsByProposal.get(v.proposalId) ?? [];
    list.push(v.currentVersionId);
    versionsByProposal.set(v.proposalId, list);
  }

  const firstPathByVersion = new Map<string, string>();
  for (const p of [...pages].sort((a, b) => a.pageOrder - b.pageOrder)) {
    if (!firstPathByVersion.has(p.versionId)) firstPathByVersion.set(p.versionId, p.storagePath);
  }

  const out: { proposalId: string; storagePath: string }[] = [];
  for (const m of matched) {
    for (const versionId of versionsByProposal.get(m.proposalId) ?? []) {
      const path = firstPathByVersion.get(versionId);
      if (path) {
        out.push({ proposalId: m.proposalId, storagePath: path });
        break;
      }
    }
  }
  return out;
}
