import fs from 'fs';
import os from 'os';
import path from 'path';

export const CacheMissingMessage = 'Nano prompt cache is missing. Open Creator Studio Nano Library and sync Nano prompts first.';

export const readArgs = (argv = process.argv.slice(2)) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
};

export const printJson = (value) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

export const failJson = (code, message, extra = {}, exitCode = 1) => {
  printJson({
    success: false,
    error: {
      code,
      message,
      ...extra,
    },
  });
  process.exit(exitCode);
};

const candidateUserDataRoots = () => {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return [path.join(home, 'Library', 'Application Support', 'WeSight')];
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return [path.join(appData, 'WeSight')];
  }
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return [path.join(configHome, 'WeSight')];
};

export const resolveCacheDir = (args) => {
  const explicit = typeof args['cache-dir'] === 'string' ? args['cache-dir'] : '';
  if (explicit) return path.resolve(explicit);
  if (process.env.WESIGHT_NANO_CACHE_DIR) return path.resolve(process.env.WESIGHT_NANO_CACHE_DIR);
  if (process.env.WESIGHT_USER_DATA_DIR) return path.join(process.env.WESIGHT_USER_DATA_DIR, 'NanoBanana', 'cache');
  return path.join(candidateUserDataRoots()[0], 'NanoBanana', 'cache');
};

export const readJsonFile = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    failJson('cache_read_failed', 'Nano prompt cache could not be read.', {
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};

export const loadCache = (args) => {
  const cacheDir = resolveCacheDir(args);
  const indexPath = path.join(cacheDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    failJson('cache_missing', CacheMissingMessage, {
      hint: 'Sync Creator Studio Nano Library before using this skill.',
    }, 2);
  }
  const index = readJsonFile(indexPath);
  const items = Array.isArray(index.indexItems) ? index.indexItems : [];
  return {
    cacheDir,
    index,
    items,
  };
};

const promptFileName = (promptId) => `${encodeURIComponent(promptId).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}.json`;

export const loadPrompt = (cache, id) => {
  if (!id) {
    failJson('missing_id', 'Prompt id is required.');
  }
  const mapped = cache.index.promptFiles && typeof cache.index.promptFiles[id] === 'string'
    ? cache.index.promptFiles[id]
    : `prompts/${promptFileName(id)}`;
  const promptPath = path.resolve(cache.cacheDir, mapped);
  const cacheRoot = path.resolve(cache.cacheDir);
  if (!promptPath.startsWith(`${cacheRoot}${path.sep}`)) {
    failJson('invalid_cache_entry', 'Nano prompt cache entry points outside the cache directory.', { id });
  }
  if (!fs.existsSync(promptPath)) {
    failJson('prompt_not_cached', 'Nano prompt details are not cached. Open the prompt in Creator Studio Nano Library, then try again.', {
      id,
    }, 2);
  }
  return readJsonFile(promptPath);
};

export const isHttpUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const publicSourceUrl = (value) => (isHttpUrl(value) ? value : null);

export const normalizeText = (value) => String(value ?? '').trim().toLowerCase();

export const tokenize = (value) => {
  const normalized = normalizeText(value);
  const stopWords = new Set(['nano', 'banana', 'prompt', 'prompts']);
  const words = normalized.match(/[a-z0-9]+|[\u4e00-\u9fff]{2,8}/g) || [];
  const expanded = [];
  for (const word of words) {
    if (stopWords.has(word)) continue;
    expanded.push(word);
  }
  [
    '科技',
    '公众号',
    '头图',
    '封面',
    '海报',
    '产品',
    '人物',
    '肖像',
    '未来',
    '科幻',
    '数字',
    '主视觉',
  ].forEach((term) => {
    if (normalized.includes(term)) expanded.push(term);
  });
  return Array.from(new Set(expanded.filter((item) => item.length > 0)));
};

export const visualBriefTerms = (brief) => {
  const terms = tokenize(brief);
  const text = normalizeText(brief);
  const add = (...values) => values.forEach((value) => terms.push(value));
  if (text.includes('科技') || text.includes('tech')) add('technology', 'tech', 'future', 'futuristic', '未来', '科幻', '数字');
  if (text.includes('公众号') || text.includes('头图') || text.includes('封面')) add('cover', 'header', 'hero', 'banner', 'social', 'wechat', '文章');
  if (text.includes('产品')) add('product', 'commercial', 'brand', '商品');
  if (text.includes('人物') || text.includes('肖像')) add('portrait', 'person', '人物', '肖像');
  if (text.includes('海报')) add('poster', 'poster design', '海报');
  return Array.from(new Set(terms));
};

export const searchableText = (item, prompt = null) => [
  item?.title,
  item?.description,
  item?.authorName,
  item?.categories?.join(' '),
  item?.searchTerms,
  prompt?.title,
  prompt?.description,
  prompt?.content,
  prompt?.translatedContent,
  prompt?.sourcePlatform,
  prompt?.promptCategories?.join(' '),
  prompt?.tags?.join(' '),
  prompt?.tagsZh?.join(' '),
  prompt?.searchIndex,
].filter(Boolean).join(' ').toLowerCase();

export const scoreItem = (item, terms, prompt = null) => {
  const text = searchableText(item, prompt);
  const title = normalizeText(item.title);
  const description = normalizeText(item.description);
  let score = 0;
  const matchedTerms = [];
  for (const term of terms) {
    const normalized = normalizeText(term);
    if (!normalized) continue;
    if (title.includes(normalized)) {
      score += 35;
      matchedTerms.push(term);
    } else if (description.includes(normalized)) {
      score += 18;
      matchedTerms.push(term);
    } else if (text.includes(normalized)) {
      score += 8;
      matchedTerms.push(term);
    }
  }
  score += Math.min(Number(item.likes ?? 0), 5000) / 500;
  score += Math.min(Number(item.resultsCount ?? 0), 5000) / 1000;
  return {
    score,
    matchedTerms: Array.from(new Set(matchedTerms)).slice(0, 6),
  };
};

export const toCandidate = (item, matchReason, prompt = null) => ({
  id: item.id,
  title: item.title,
  source: prompt?.sourcePlatform || item.sourceId || 'Nano Banana Prompts',
  author: prompt?.author?.name || item.authorName || null,
  sourceUrl: publicSourceUrl(prompt?.sourceLink),
  matchReason,
  description: item.description || prompt?.description || '',
  likes: Number(item.likes ?? prompt?.likes ?? 0),
  resultsCount: Number(item.resultsCount ?? prompt?.resultsCount ?? 0),
  needReferenceImages: prompt?.needReferenceImages ?? item.needReferenceImages ?? null,
});

export const buildMatchReason = (matchedTerms, fallback) => {
  if (matchedTerms.length > 0) {
    return `Matched visual terms: ${matchedTerms.join(', ')}.`;
  }
  return fallback;
};

export const parseLimit = (value, fallback = 6) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 20));
};

export const parseAspectRatio = (text) => {
  const ratios = ['1:1', '4:5', '9:16', '16:9', '2:3', '3:4'];
  return ratios.find((ratio) => new RegExp(`(^|[^\\d])${ratio.replace(':', '\\s*[:/]\\s*')}([^\\d]|$)`, 'i').test(text)) || '1:1';
};

export const parseVariables = (content) => {
  const variables = [];
  for (const match of String(content ?? '').matchAll(/\{argument\s+([^}]+)\}/gi)) {
    const attrs = match[1];
    const name = attrs.match(/name=["']([^"']+)["']/i)?.[1] || attrs.match(/name=([^\s}]+)/i)?.[1] || '';
    const defaultValue = attrs.match(/default=["']([^"']*)["']/i)?.[1] || attrs.match(/default=([^\s}]+)/i)?.[1] || '';
    if (!name.trim()) continue;
    variables.push({
      id: name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'variable',
      label: name.trim(),
      defaultValue,
    });
  }
  for (const match of String(content ?? '').matchAll(/\[([A-Z][A-Z0-9 _-]{2,})\]/g)) {
    const label = match[1].trim();
    variables.push({
      id: label.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'variable',
      label,
      defaultValue: '',
    });
  }
  const seen = new Set();
  return variables.filter((variable) => {
    if (seen.has(variable.id)) return false;
    seen.add(variable.id);
    return true;
  });
};
