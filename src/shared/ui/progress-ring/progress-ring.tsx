import { progressRingColor } from "./progress-color";

// 태깅 완성도용 SVG 도넛. value(0~100)와 색 구간 + 중앙 % 숫자.
// stroke는 CSS 변수를 쓰므로 presentation 속성이 아닌 style로 지정한다.
export function ProgressRing({ value, size = 24 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const color = progressRingColor(clamped);
  const center = size / 2;

  return (
    <span
      className="inline-flex items-center gap-2"
      role="img"
      aria-label={`태깅 완성도 ${clamped}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          style={{ stroke: "var(--color-muted)" }}
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          style={{ stroke: color }}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className="text-xs tabular-nums" style={{ color }}>
        {clamped}%
      </span>
    </span>
  );
}
