import { describe, it, expect, vi, afterEach } from 'vitest';
import { createApiClient, variantsPath, versionsPath, pagesPath, signInUrl } from './api';

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

// 부팅 시 저장된 세션 검증의 핵심. "서버가 거부"와 "통신 실패"를 구분해야
// 죽은 세션만 로그아웃되고 오프라인은 유지된다.
describe('refreshWith', () => {
  afterEach(() => vi.unstubAllGlobals());

  const client = () =>
    createApiClient({
      baseUrl: 'https://x.dev',
      getTokens: () => ({ accessToken: null, refreshToken: null }),
      onTokens: () => {},
    });

  it('성공이면 새 토큰을 돌려준다', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ accessToken: 'A', refreshToken: 'R', expiresAt: 1 }),
    }));
    expect(await client().refreshWith('old')).toEqual({
      accessToken: 'A',
      refreshToken: 'R',
      expiresAt: 1,
    });
  });

  it('서버가 거부하면 null (→ 세션 비움)', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 401, json: async () => ({}) }));
    expect(await client().refreshWith('dead')).toBeNull();
  });

  it('네트워크 실패는 throw (→ 세션 유지)', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    await expect(client().refreshWith('x')).rejects.toThrow();
  });
});
