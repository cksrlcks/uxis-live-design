import type { Status } from '../hooks/useUploadRunner';

export function StatusBar({
  status,
  openVisible,
  onOpen,
}: {
  status: Status;
  openVisible: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="statusbar">
      <div className={'status' + (status.kind ? ' ' + status.kind : '')} id="status">
        {status.text}
      </div>
      <button
        className={'sm' + (openVisible ? '' : ' hidden')}
        id="openBtn"
        type="button"
        onClick={onOpen}
      >
        관리화면 열기 ↗
      </button>
    </div>
  );
}
