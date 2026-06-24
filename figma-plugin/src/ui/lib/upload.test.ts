import { describe, it, expect } from 'vitest';
import { filesMeta, confirmPages } from './upload';
import type { ExportedImage } from '../../shared/messages';

function img(w: number, h: number, n = 4): ExportedImage {
  return { name: 'f', bytes: new Uint8Array(n), width: w, height: h, contentType: 'image/png' };
}

describe('filesMeta', () => {
  it('contentType + byteLength 매핑', () => {
    expect(filesMeta([img(10, 20, 7)])).toEqual([{ contentType: 'image/png', size: 7 }]);
  });
});

describe('confirmPages', () => {
  it('uploads와 images를 인덱스로 합쳐 페이지 메타 생성', () => {
    const uploads = [{ signedUrl: 's', pageId: 'p1', pageOrder: 0, path: 'a/b' }];
    expect(confirmPages(uploads, [img(10, 20)])).toEqual([
      { pageId: 'p1', pageOrder: 0, path: 'a/b', width: 10, height: 20 },
    ]);
  });
});
