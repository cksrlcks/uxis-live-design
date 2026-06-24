export function luminance(rgb: [number, number, number]): number {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

export function parseColor(input: string): [number, number, number] | null {
  let c = input.trim();
  if (c.charAt(0) === '#') {
    if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return [
      parseInt(c.slice(1, 3), 16),
      parseInt(c.slice(3, 5), 16),
      parseInt(c.slice(5, 7), 16),
    ];
  }
  const m = c.match(/\d+/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : null;
}

// Figma 테마(라이트/다크)에 맞춰 서비스 다크 토큰(html.dark)을 적용한다.
export function applyFigmaTheme(): void {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--figma-color-bg');
  const rgb = bg ? parseColor(bg) : null;
  const dark = rgb
    ? luminance(rgb) < 128
    : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
}
