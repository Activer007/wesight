import { expect, test } from 'vitest';

import {
  getCollapsedText,
  getHiddenLineCount,
  LONG_CODE_BLOCK_LIMITS,
  shouldCollapseText,
  shouldDeferDiff,
} from './renderingGuards';

test('collapses text by line and character limits', () => {
  const text = Array.from({ length: LONG_CODE_BLOCK_LIMITS.maxLines + 10 }, (_, index) => `line-${index}`).join('\n');
  const preview = getCollapsedText(text, LONG_CODE_BLOCK_LIMITS);

  expect(shouldCollapseText(text, LONG_CODE_BLOCK_LIMITS)).toBe(true);
  expect(preview.split('\n')).toHaveLength(LONG_CODE_BLOCK_LIMITS.maxLines);
  expect(getHiddenLineCount(text, preview)).toBe(10);
});

test('keeps short text unchanged', () => {
  const text = 'short\ncontent';

  expect(shouldCollapseText(text, LONG_CODE_BLOCK_LIMITS)).toBe(false);
  expect(getCollapsedText(text, LONG_CODE_BLOCK_LIMITS)).toBe(text);
});

test('defers large diff rendering', () => {
  const oldStr = Array.from({ length: 500 }, (_, index) => `old-${index}`).join('\n');
  const newStr = Array.from({ length: 500 }, (_, index) => `new-${index}`).join('\n');

  expect(shouldDeferDiff(oldStr, newStr)).toBe(true);
  expect(shouldDeferDiff('a\nb', 'a\nc')).toBe(false);
});
