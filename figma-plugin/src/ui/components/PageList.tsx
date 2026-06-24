import type { Page } from '../lib/api';

export function PageList({
  title,
  pages,
  loading,
  errorText,
  busy,
  selectionCount,
  onBack,
  onReplace,
  onAddPages,
}: {
  title: string;
  pages: Page[];
  loading: boolean;
  errorText: string;
  busy: boolean;
  selectionCount: number;
  onBack: () => void;
  onReplace: (pageId: string, ordinal: number) => void;
  onAddPages: () => void;
}) {
  const needsSelDisabled = busy || selectionCount === 0;
  return (
    <div id="pagesView">
      <div className="detailhead">
        <button className="ghost sm" id="pagesBackBtn" type="button" onClick={onBack}>
          ← 안 목록
        </button>
        <div className="detailtitle" id="pagesTitle">
          {title}
        </div>
      </div>
      <div className="hint">교체는 첫 프레임을, 이미지 추가는 선택한 모든 프레임을 사용합니다.</div>
      <div id="pages">
        {loading ? (
          <div className="loading">불러오는 중…</div>
        ) : errorText ? (
          <div className="empty">{errorText}</div>
        ) : pages.length === 0 ? (
          <div className="empty">이미지가 없습니다.</div>
        ) : (
          pages.map((p, idx) => (
            <div className="page" key={p.id}>
              <img
                src={p.url || undefined}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                }}
                alt=""
              />
              <div className="info">
                <div className="title">{idx + 1 + '페이지'}</div>
                <div className="meta">{(p.width || '?') + ' × ' + (p.height || '?')}</div>
              </div>
              <button
                className="sm"
                type="button"
                disabled={needsSelDisabled}
                onClick={() => onReplace(p.id, idx + 1)}
              >
                교체
              </button>
            </div>
          ))
        )}
      </div>
      <button
        className="sm"
        id="addPagesBtn"
        type="button"
        disabled={needsSelDisabled}
        onClick={onAddPages}
      >
        ＋ 이미지 추가 (선택 프레임)
      </button>
    </div>
  );
}
