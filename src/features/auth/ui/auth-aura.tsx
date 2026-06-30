// 피그마에서 타원들을 블러 + screen 블렌드로 겹친 글로우.
// 색은 파랑/초록/보라/핑크. 45도 간격을 기준으로 회전·크기·위치·블러를
// 타원마다 살짝씩 어긋나게 줘서 기계적인 대칭을 깨고 자연스럽게 흩어 보이게 한다.
const AURA_ELLIPSES = [
  { color: "#2470FF", rotate: -5, w: 62, h: 82, x: -52, y: -47, blur: 22 },
  { color: "#2EEF8A", rotate: 48, w: 57, h: 78, x: -48, y: -53, blur: 18 },
  { color: "#5206FE", rotate: 87, w: 64, h: 84, x: -47, y: -49, blur: 24 },
  { color: "#FE06A3", rotate: 139, w: 56, h: 77, x: -51, y: -52, blur: 19 },
];

// 상단 중앙에 절반쯤 보이게 띄운 회전 글로우. 부모는 검정 배경 — screen 블렌드는
// 검정 위에서 색을 그대로 살리고 겹친 부분만 밝아져 가운데가 청록빛으로 빛난다.
// (auth) 라우트 그룹의 공유 layout에서 한 번만 렌더해 로그인↔회원가입 이동 시
// 리마운트되지 않으므로 auth-orbit 회전이 끊기거나 리셋되지 않는다.
export function AuthAura() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-black">
      {/* 글로우 뒤에 까는 미세한 수직 그라데이션 — 위는 글로우와 어울리게 살짝
          들뜬 남색, 아래로 갈수록 순수 검정으로 떨어져 단조로운 까만 배경을 푼다. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, oklch(0.24 0.04 264) 0%, oklch(0.14 0.025 264) 35%, #000 80%)",
        }}
      />
      {/* 세트 컨테이너 — 중심을 화면 상단 모서리에 두어 아래 절반만 보이고,
          auth-orbit(rotate 프로퍼티)으로 세트 전체가 제자리에서 천천히 돈다. */}
      <div className="auth-orbit absolute top-0 left-1/2 size-100 -translate-x-1/2 -translate-y-2/3">
        {AURA_ELLIPSES.map(({ color, rotate, w, h, x, y, blur }) => (
          <div
            key={color}
            className="absolute top-1/2 left-1/2 rounded-[50%]"
            style={{
              width: `${w}%`,
              height: `${h}%`,
              backgroundColor: color,
              mixBlendMode: "screen",
              filter: `blur(${blur}px)`,
              opacity: 0.9,
              transform: `translate(${x}%, ${y}%) rotate(${rotate}deg)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
