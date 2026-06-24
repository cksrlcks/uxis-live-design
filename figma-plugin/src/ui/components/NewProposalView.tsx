import { useEffect, useState } from 'react';

export function NewProposalView({
  visible,
  busy,
  selectionCount,
  resetKey,
  onCreate,
}: {
  visible: boolean;
  busy: boolean;
  selectionCount: number;
  resetKey: number;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState('');

  // 생성 성공 시(App이 resetKey 증가) 제목 입력을 비운다.
  useEffect(() => {
    if (resetKey > 0) setTitle('');
  }, [resetKey]);

  const disabled = busy || selectionCount === 0 || !title.trim();

  return (
    <div className={'view' + (visible ? '' : ' hidden')} id="viewNew">
      <label htmlFor="title">제목</label>
      <input
        id="title"
        placeholder="시안 제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button type="button" id="createBtn" disabled={disabled} onClick={() => onCreate(title.trim())}>
        선택한 프레임으로 새 시안 만들기
      </button>
    </div>
  );
}
