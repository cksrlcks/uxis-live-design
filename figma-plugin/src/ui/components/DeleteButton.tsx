// 인라인 2단계 삭제 버튼. armed 여부는 부모가 관리(목록당 하나만 armed → 다른 항목 클릭 시 취소).
// 첫 클릭: onArm → '확인?'(빨강)으로 바뀜. 두 번째 클릭: onConfirm → 실제 삭제.
export function DeleteButton({
  armed,
  disabled,
  onArm,
  onConfirm,
}: {
  armed: boolean;
  disabled: boolean;
  onArm: () => void;
  onConfirm: () => void;
}) {
  return (
    <button
      className={'sm' + (armed ? ' danger' : ' soft')}
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation(); // 부모 행이 clickable일 수 있음(VariantList)
        if (armed) onConfirm();
        else onArm();
      }}
    >
      {armed ? '확인?' : '삭제'}
    </button>
  );
}
