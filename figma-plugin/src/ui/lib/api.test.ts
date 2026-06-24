import { describe, it, expect } from 'vitest';
import { variantsPath, versionsPath, pagesPath, signInUrl } from './api';

describe('path builders', () => {
  it('variantsPath', () => {
    expect(variantsPath('P')).toBe('/api/plugin/proposals/P/variants');
  });
  it('versionsPath', () => {
    expect(versionsPath('P', 'V')).toBe('/api/plugin/proposals/P/variants/V/versions');
  });
  it('pagesPath', () => {
    expect(pagesPath('P', 'V', 'X')).toBe(
      '/api/plugin/proposals/P/variants/V/versions/X/pages',
    );
  });
});

describe('signInUrl', () => {
  it('key를 k 쿼리로, base 끝 슬래시 제거', () => {
    expect(signInUrl('https://x.dev/', 'abc')).toBe('https://x.dev/plugin-auth?k=abc');
  });
  it('key를 URL 인코딩', () => {
    expect(signInUrl('https://x.dev', 'a/b')).toBe('https://x.dev/plugin-auth?k=a%2Fb');
  });
});
