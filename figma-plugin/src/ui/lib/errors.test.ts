import { describe, it, expect } from 'vitest';
import { humanize } from './errors';

describe('humanize', () => {
  it('알려진 코드는 한국어 문구로 변환', () => {
    expect(humanize('FORBIDDEN')).toBe('편집 권한이 없습니다.');
    expect(humanize('NO_SELECTION')).toBe('내보낼 프레임을 먼저 선택하세요.');
  });
  it('미지정 코드는 "오류: <code>" fallback', () => {
    expect(humanize('WAT')).toBe('오류: WAT');
  });
});
