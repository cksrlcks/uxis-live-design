import { useState } from 'react';
import type { Variant } from '../lib/api';
import { DeleteButton } from './DeleteButton';

export function VariantList({
  title,
  variants,
  loading,
  errorText,
  busy,
  selectionCount,
  onBack,
  onOpenPages,
  onNewVersion,
  onAddVariant,
  onDeleteVariant,
}: {
  title: string;
  variants: Variant[];
  loading: boolean;
  errorText: string;
  busy: boolean;
  selectionCount: number;
  onBack: () => void;
  onOpenPages: (variantId: string) => void;
  onNewVersion: (variantId: string, label: string) => void;
  onAddVariant: () => void;
  onDeleteVariant: (variantId: string, label: string) => void;
}) {
  const needsSelDisabled = busy || selectionCount === 0;
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return (
    <div id="detailView">
      <div className="detailhead">
        <button className="ghost sm" id="backBtn" type="button" onClick={onBack}>
          ← 목록
        </button>
        <div className="detailtitle" id="detailTitle">
          {title}
        </div>
      </div>
      <div id="variants">
        {loading ? (
          <div className="loading">불러오는 중…</div>
        ) : errorText ? (
          <div className="empty">{errorText}</div>
        ) : variants.length === 0 ? (
          <div className="empty">안이 없습니다.</div>
        ) : (
          variants.map((v) => {
            const label = v.label || v.slug || '?';
            const pageCount = v.pages ? v.pages.length : 0;
            const versionCount = v.versions ? v.versions.length : 0;
            return (
              <div className="item clickable" key={v.id} onClick={() => onOpenPages(v.id)}>
                <div className="info">
                  <div className="title">{'안 ' + label}</div>
                  <div className="meta">
                    {versionCount + '개 버전 · 현재 ' + pageCount + '장'}
                  </div>
                </div>
                <button
                  className="sm"
                  type="button"
                  disabled={needsSelDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewVersion(v.id, label);
                  }}
                >
                  새 버전
                </button>
                <DeleteButton
                  armed={confirmId === v.id}
                  disabled={busy}
                  onArm={() => setConfirmId(v.id)}
                  onConfirm={() => {
                    setConfirmId(null);
                    onDeleteVariant(v.id, label);
                  }}
                />
                <div className="chev">›</div>
              </div>
            );
          })
        )}
      </div>
      <button
        className="sm"
        id="addVariantBtn"
        type="button"
        disabled={needsSelDisabled}
        onClick={onAddVariant}
      >
        ＋ 새 안 추가 (선택 프레임)
      </button>
    </div>
  );
}
