import type { ProposalListItem } from '../lib/api';

export function ProposalList({
  items,
  total,
  page,
  pageSize,
  loading,
  errorText,
  query,
  onQueryChange,
  onRefresh,
  onOpen,
  onPage,
}: {
  items: ProposalListItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  errorText: string;
  query: string;
  onQueryChange: (q: string) => void;
  onRefresh: () => void;
  onOpen: (id: string, title: string) => void;
  onPage: (delta: -1 | 1) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showPager = total > pageSize;

  return (
    <div id="listView">
      <div className="toolbar">
        <input
          id="search"
          placeholder="시안 검색…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <button className="soft sm" id="refreshBtn" type="button" onClick={onRefresh}>
          새로고침
        </button>
      </div>
      <div className="count" id="count">
        {loading || errorText ? '' : total + '개'}
      </div>
      <div id="list">
        {loading ? (
          <div className="loading">불러오는 중…</div>
        ) : errorText ? (
          <div className="empty">{errorText}</div>
        ) : items.length === 0 ? (
          <div className="empty">시안이 없습니다.</div>
        ) : (
          items.map((it) => {
            const title = it.title || '(제목 없음)';
            const parts: string[] = [];
            if (it.domain) parts.push(it.domain);
            if (it.publicId) parts.push('/' + it.publicId);
            return (
              <div className="item clickable" key={it.id} onClick={() => onOpen(it.id, title)}>
                <div className="info">
                  <div className="title">{title}</div>
                  <div className="meta">{parts.join(' · ')}</div>
                </div>
                <div className="chev">›</div>
              </div>
            );
          })
        )}
      </div>
      {showPager && !loading && !errorText && (
        <div className="pager" id="pager">
          <button
            className="soft sm"
            id="prevBtn"
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(-1)}
          >
            이전
          </button>
          <span id="pageInfo">{page + ' / ' + totalPages}</span>
          <button
            className="soft sm"
            id="nextBtn"
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPage(1)}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
