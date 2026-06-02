export interface TextMetrics {
  charCount: number;
  lineCount: number;
}

export interface CollapseLimits {
  maxChars: number;
  maxLines: number;
}

export const LONG_MARKDOWN_LIMITS: CollapseLimits = {
  maxChars: 12000,
  maxLines: 260,
};

export const LONG_CODE_BLOCK_LIMITS: CollapseLimits = {
  maxChars: 16000,
  maxLines: 240,
};

export const LONG_TOOL_OUTPUT_LIMITS: CollapseLimits = {
  maxChars: 16000,
  maxLines: 320,
};

export const LARGE_DIFF_LINE_LIMIT = 800;
export const LARGE_DIFF_CHAR_LIMIT = 32000;
export const DIFF_RENDER_LINE_LIMIT = 1400;

export function getTextMetrics(text: string): TextMetrics {
  if (!text) {
    return { charCount: 0, lineCount: 0 };
  }
  return {
    charCount: text.length,
    lineCount: text.split('\n').length,
  };
}

export function shouldCollapseText(text: string, limits: CollapseLimits): boolean {
  const metrics = getTextMetrics(text);
  return metrics.charCount > limits.maxChars || metrics.lineCount > limits.maxLines;
}

export function getCollapsedText(text: string, limits: CollapseLimits): string {
  if (!shouldCollapseText(text, limits)) {
    return text;
  }

  const lines = text.split('\n');
  const limitedByLines = lines.slice(0, limits.maxLines).join('\n');
  if (limitedByLines.length <= limits.maxChars) {
    return limitedByLines;
  }
  return limitedByLines.slice(0, limits.maxChars);
}

export function getHiddenLineCount(text: string, visibleText: string): number {
  const totalLines = getTextMetrics(text).lineCount;
  const visibleLines = getTextMetrics(visibleText).lineCount;
  return Math.max(0, totalLines - visibleLines);
}

export function shouldDeferDiff(oldStr: string, newStr: string): boolean {
  const oldMetrics = getTextMetrics(oldStr);
  const newMetrics = getTextMetrics(newStr);
  return oldMetrics.lineCount + newMetrics.lineCount > LARGE_DIFF_LINE_LIMIT
    || oldMetrics.charCount + newMetrics.charCount > LARGE_DIFF_CHAR_LIMIT;
}
