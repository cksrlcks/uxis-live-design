import { describe, it, expect } from 'vitest';
import { randomKey } from './random';

describe('randomKey', () => {
  it('32자 소문자 hex', () => {
    expect(randomKey()).toMatch(/^[0-9a-f]{32}$/);
  });
  it('호출마다 다름', () => {
    expect(randomKey()).not.toBe(randomKey());
  });
});
