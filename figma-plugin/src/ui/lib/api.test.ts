import { describe, it, expect } from 'vitest';
import { variantsPath, versionsPath, pagesPath } from './api';

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
