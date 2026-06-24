import { describe, it, expect } from 'vitest';
import { parseColor, luminance } from './theme';

describe('parseColor', () => {
  it('3자리 hex 확장', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
  });
  it('6자리 hex', () => {
    expect(parseColor('#080808')).toEqual([8, 8, 8]);
  });
  it('rgb() 문자열', () => {
    expect(parseColor('rgb(18, 110, 245)')).toEqual([18, 110, 245]);
  });
  it('파싱 불가 시 null', () => {
    expect(parseColor('')).toBeNull();
  });
});

describe('luminance', () => {
  it('밝은 색은 임계값(128) 이상', () => {
    expect(luminance([255, 255, 255])).toBeGreaterThanOrEqual(128);
  });
  it('어두운 색은 임계값 미만', () => {
    expect(luminance([8, 8, 8])).toBeLessThan(128);
  });
});
