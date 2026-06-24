export function SelectionBar({ count }: { count: number }) {
  const has = count > 0;
  return (
    <div className={'selbar' + (has ? ' has' : '')} id="selbar">
      {has ? '선택된 프레임: ' + count + '개' : 'Figma에서 올릴 프레임을 선택하세요'}
    </div>
  );
}
