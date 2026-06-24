export function Tabs({
  tab,
  onChange,
}: {
  tab: 'new' | 'existing';
  onChange: (tab: 'new' | 'existing') => void;
}) {
  return (
    <div className="tabs">
      <button
        id="tabNewBtn"
        type="button"
        className={tab === 'new' ? 'active' : ''}
        onClick={() => onChange('new')}
      >
        새 시안
      </button>
      <button
        id="tabExistingBtn"
        type="button"
        className={tab === 'existing' ? 'active' : ''}
        onClick={() => onChange('existing')}
      >
        기존 시안
      </button>
    </div>
  );
}
