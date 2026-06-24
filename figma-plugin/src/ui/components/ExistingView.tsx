import { useEffect, useRef, useState } from 'react';
import type { ApiClient, Page, ProposalListItem, Variant } from '../lib/api';
import type { SetStatus } from '../hooks/useUploadRunner';
import type { ExportedImage } from '../../shared/messages';
import { PAGE_SIZE } from '../config';
import { humanize } from '../lib/errors';
import { confirmPages, filesMeta, putToSignedUrl, uploadAll } from '../lib/upload';
import { ProposalList } from './ProposalList';
import { VariantList } from './VariantList';
import { PageList } from './PageList';

type Nav = 'list' | 'detail' | 'pages';

export function ExistingView({
  visible,
  active,
  api,
  run,
  busy,
  selectionCount,
  notify,
  onUploaded,
  reloadKey,
}: {
  visible: boolean;
  active: boolean;
  api: ApiClient;
  run: (label: string, fn: (images: ExportedImage[], setStatus: SetStatus) => Promise<void>) => Promise<void>;
  busy: boolean;
  selectionCount: number;
  notify: (message: string, error?: boolean) => void;
  onUploaded: (proposalId: string) => void;
  reloadKey: number;
}) {
  const [nav, setNav] = useState<Nav>('list');

  // 목록
  const [items, setItems] = useState<ProposalListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const loadedRef = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 상세(안 목록)
  const [detail, setDetail] = useState<{ proposalId: string; title: string } | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // 페이지
  const [pagesCtx, setPagesCtx] = useState<{
    proposalId: string;
    variantId: string;
    versionId: string | null;
    label: string | null;
  } | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [pagesTitle, setPagesTitle] = useState('페이지');
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesError, setPagesError] = useState('');

  /* ── 목록 로드 ── */
  async function loadProposals(p = page, q = query) {
    loadedRef.current = true;
    setListLoading(true);
    setListError('');
    try {
      const data = await api.listProposals(p, PAGE_SIZE, q.trim());
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setItems([]);
      setListError(humanize(e instanceof Error ? e.message : String(e)));
    } finally {
      setListLoading(false);
    }
  }

  // 탭이 처음 활성화될 때 1회 로드(원본 listLoaded 동작).
  useEffect(() => {
    if (!active) return;
    setNav('list'); // 원본 switchTab("existing") → switchExistingView("list")
    if (!loadedRef.current) loadProposals(page, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // 새 시안 생성 등으로 reloadKey가 바뀌면 목록을 무효화 → 다음 활성화 시 page1 재로드.
  useEffect(() => {
    if (reloadKey > 0) {
      loadedRef.current = false;
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  function onQueryChange(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      loadProposals(1, q);
    }, 300);
  }
  function onPage(delta: -1 | 1) {
    const next = page + delta;
    if (next < 1) return;
    setPage(next);
    loadProposals(next, query);
  }

  /* ── 상세(안 목록) ── */
  async function loadDetail(proposalId: string) {
    setDetailLoading(true);
    setDetailError('');
    try {
      const d = await api.getProposal(proposalId);
      setVariants(d.variants || []);
    } catch (e) {
      setVariants([]);
      setDetailError(humanize(e instanceof Error ? e.message : String(e)));
    } finally {
      setDetailLoading(false);
    }
  }
  function openDetail(proposalId: string, title: string) {
    setDetail({ proposalId, title });
    setVariants([]);
    setNav('detail');
    loadDetail(proposalId);
  }

  /* ── 페이지 ── */
  async function loadPages(ctx: { proposalId: string; variantId: string }) {
    setPagesLoading(true);
    setPagesError('');
    try {
      const d = await api.getProposal(ctx.proposalId);
      const v = (d.variants || []).find((x) => x.id === ctx.variantId);
      if (!v) {
        setPages([]);
        setPagesError('안을 찾을 수 없습니다.');
        return;
      }
      const label = v.label || v.slug || '?';
      setPagesCtx({
        proposalId: ctx.proposalId,
        variantId: ctx.variantId,
        versionId: v.currentVersionId ?? null,
        label,
      });
      setPagesTitle('안 ' + label + ' · 현재 버전');
      setPages(v.pages || []);
    } catch (e) {
      setPages([]);
      setPagesError(humanize(e instanceof Error ? e.message : String(e)));
    } finally {
      setPagesLoading(false);
    }
  }
  function openPages(variantId: string) {
    if (!detail) return;
    setPagesCtx({ proposalId: detail.proposalId, variantId, versionId: null, label: null });
    setPagesTitle('페이지');
    setPages([]);
    setNav('pages');
    loadPages({ proposalId: detail.proposalId, variantId });
  }

  /* ── 업로드 플로우 ── */
  async function onNewVersion(variantId: string, label: string) {
    if (!detail) return;
    const pid = detail.proposalId;
    await run('안 ' + label + ' 새 버전', async (images, setStatus) => {
      const ver = await api.addVersion(pid, variantId, '');
      const issued = await api.issuePages(pid, variantId, ver.versionId, filesMeta(images));
      await uploadAll(issued.uploads, images, (d, t) => setStatus('업로드 중 ' + d + '/' + t + '…'));
      await api.confirmPages(pid, variantId, ver.versionId, confirmPages(issued.uploads, images));
      notify('안 ' + label + ' v' + ver.versionNo + ' 업로드됨');
      onUploaded(pid);
      await loadDetail(pid);
    });
  }

  async function onAddVariant() {
    if (!detail) return;
    const pid = detail.proposalId;
    await run('새 안 추가', async (images, setStatus) => {
      const created = await api.addVariant(pid, filesMeta(images));
      await uploadAll(created.uploads, images, (d, t) => setStatus('업로드 중 ' + d + '/' + t + '…'));
      await api.confirmPages(pid, created.variantId, created.versionId, confirmPages(created.uploads, images));
      notify('새 안 ' + created.label + ' 추가됨');
      onUploaded(pid);
      await loadDetail(pid);
    });
  }

  async function onAddPages() {
    const ctx = pagesCtx;
    if (!ctx || !ctx.versionId) return;
    const verId = ctx.versionId;
    await run('이미지 추가', async (images, setStatus) => {
      const issued = await api.issuePages(ctx.proposalId, ctx.variantId, verId, filesMeta(images));
      await uploadAll(issued.uploads, images, (d, t) => setStatus('업로드 중 ' + d + '/' + t + '…'));
      await api.confirmPages(ctx.proposalId, ctx.variantId, verId, confirmPages(issued.uploads, images));
      notify(images.length + '장 추가됨');
      onUploaded(ctx.proposalId);
      await loadPages({ proposalId: ctx.proposalId, variantId: ctx.variantId });
    });
  }

  async function onReplace(pageId: string, ordinal: number) {
    const ctx = pagesCtx;
    if (!ctx || !ctx.versionId) return;
    const verId = ctx.versionId;
    await run(ordinal + '페이지 교체', async (images) => {
      const img = images[0];
      if (!img) throw new Error('NO_SELECTION');
      const issued = await api.replacePageIssue(ctx.proposalId, ctx.variantId, verId, pageId, {
        contentType: img.contentType,
        size: img.bytes.byteLength,
      });
      await putToSignedUrl(issued.signedUrl, img);
      await api.confirmPageReplace(ctx.proposalId, ctx.variantId, verId, pageId, {
        path: issued.path,
        width: img.width,
        height: img.height,
      });
      notify(ordinal + '페이지 교체됨');
      onUploaded(ctx.proposalId);
      await loadPages({ proposalId: ctx.proposalId, variantId: ctx.variantId });
    });
  }

  return (
    <div className={'view' + (visible ? '' : ' hidden')} id="viewExisting">
      {nav === 'list' && (
        <ProposalList
          items={items}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          loading={listLoading}
          errorText={listError}
          query={query}
          onQueryChange={onQueryChange}
          onRefresh={() => loadProposals(page, query)}
          onOpen={openDetail}
          onPage={onPage}
        />
      )}
      {nav === 'detail' && (
        <VariantList
          title={detail?.title || ''}
          variants={variants}
          loading={detailLoading}
          errorText={detailError}
          busy={busy}
          selectionCount={selectionCount}
          onBack={() => {
            setDetail(null);
            setNav('list');
          }}
          onOpenPages={openPages}
          onNewVersion={onNewVersion}
          onAddVariant={onAddVariant}
        />
      )}
      {nav === 'pages' && (
        <PageList
          title={pagesTitle}
          pages={pages}
          loading={pagesLoading}
          errorText={pagesError}
          busy={busy}
          selectionCount={selectionCount}
          onBack={() => {
            setPagesCtx(null);
            setNav('detail');
          }}
          onReplace={onReplace}
          onAddPages={onAddPages}
        />
      )}
    </div>
  );
}
