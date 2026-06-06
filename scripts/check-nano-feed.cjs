#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceId = 'nano-supai';
const sourceName = 'Nano Banana Prompts';
const baseUrl = 'https://nano.supai.site';
const reportPath = path.resolve(__dirname, '..', 'wesight-development-guide', 'docs', 'nano-feed-contract-2026-06-06.md');

const requestTimeoutMs = 15_000;
const imageTimeoutMs = 8_000;
const imageSampleLimit = 6;

const endpoints = {
  meta: {
    label: 'meta',
    url: `${baseUrl}/data/meta.json`,
    maxBytes: 1 * 1024 * 1024,
  },
  index: {
    label: 'index',
    url: `${baseUrl}/data/index.json`,
    maxBytes: 80 * 1024 * 1024,
  },
  pages: [
    {
      label: 'page-1',
      page: 1,
      url: `${baseUrl}/data/pages/page-1.json`,
      maxBytes: 20 * 1024 * 1024,
    },
  ],
};

const requiredMetaFields = [
  'version',
  'lastUpdated',
  'totalItems',
  'itemsPerPage',
  'totalPages',
  'totalCategories',
  'preRenderedPages',
];

const requiredIndexItemFields = [
  'id',
  'title',
  'description',
  'authorName',
  'categories',
  'publishedAt',
  'likes',
  'resultsCount',
  'page',
  'searchTerms',
  'thumbnailUrl',
];

const requiredPageItemFields = [
  'id',
  'title',
  'description',
  'content',
  'media',
  'language',
  'likes',
  'mediaThumbnails',
  'promptCategories',
  'author',
  'tags',
  'tags_zh',
  'translatedContent',
  'sourceLink',
  'sourcePlatform',
  'sourcePublishedAt',
  'searchIndex',
  'resultsCount',
  'needReferenceImages',
];

const blockingErrors = [];
const warnings = [];

const nowWithOffset = () => {
  const now = new Date();
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const pad = (value) => String(value).padStart(2, '0');
  const local = new Date(now.getTime() + offsetMinutes * 60_000);

  return `${local.toISOString().slice(0, 19)}${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};

const addWarning = (code, message, details = {}) => {
  warnings.push({ code, message, ...details });
};

const addBlockingError = (code, message, details = {}) => {
  blockingErrors.push({ code, message, ...details });
};

const getHeaderObject = (headers) => {
  const result = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const sanitizeUrl = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[invalid-url]';
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = requestTimeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const readLimitedBody = async (response, maxBytes) => {
  if (!response.body) {
    const text = await response.text();
    const bytes = Buffer.byteLength(text);
    if (bytes > maxBytes) {
      throw new Error(`response exceeded ${maxBytes} bytes`);
    }
    return { text, bytes };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error(`response exceeded ${maxBytes} bytes`);
    }
    chunks.push(Buffer.from(value));
  }

  const buffer = Buffer.concat(chunks);
  return {
    text: buffer.toString('utf8'),
    bytes,
  };
};

const fetchJsonEndpoint = async (endpoint) => {
  const startedAt = Date.now();
  const result = {
    url: endpoint.url,
    status: null,
    ok: false,
    headers: {},
    bytes: 0,
    elapsedMs: 0,
    maxBytes: endpoint.maxBytes,
    data: null,
  };

  try {
    const response = await fetchWithTimeout(endpoint.url);
    result.status = response.status;
    result.ok = response.ok;
    result.headers = getHeaderObject(response.headers);

    if (!response.ok) {
      addBlockingError('endpoint-not-ok', `${endpoint.label} returned HTTP ${response.status}`, {
        endpoint: endpoint.label,
      });
      return result;
    }

    const body = await readLimitedBody(response, endpoint.maxBytes);
    result.bytes = body.bytes;

    try {
      result.data = JSON.parse(body.text);
    } catch (error) {
      addBlockingError('json-parse-failed', `${endpoint.label} did not return valid JSON`, {
        endpoint: endpoint.label,
        error: error.message,
      });
    }
  } catch (error) {
    const code = error.name === 'AbortError' ? 'endpoint-timeout' : 'endpoint-fetch-failed';
    addBlockingError(code, `${endpoint.label} could not be fetched`, {
      endpoint: endpoint.label,
      error: error.message,
    });
  } finally {
    result.elapsedMs = Date.now() - startedAt;
  }

  return result;
};

const getItems = (value, pathLabel) => {
  if (!value || !Array.isArray(value.items)) {
    addBlockingError('items-missing', `${pathLabel} must contain an items array`, {
      endpoint: pathLabel,
    });
    return [];
  }
  return value.items;
};

const getIndexes = (value) => {
  if (!value || !Array.isArray(value.indexes)) {
    addBlockingError('indexes-missing', 'index must contain an indexes array', {
      endpoint: 'index',
    });
    return [];
  }
  return value.indexes;
};

const getKeys = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value).sort();
};

const computeFieldCoverage = (items, fields, label) => {
  const total = items.length;
  const coverage = {};

  fields.forEach((field) => {
    const present = items.filter((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      return Object.prototype.hasOwnProperty.call(item, field) && item[field] !== null && item[field] !== undefined;
    }).length;

    coverage[field] = {
      present,
      total,
      ratio: total === 0 ? 0 : Number((present / total).toFixed(4)),
    };

    if (present < total) {
      addWarning('field-missing', `${label}.${field} is missing in ${total - present} sampled item(s)`, {
        field: `${label}.${field}`,
        missing: total - present,
        total,
      });
    }
  });

  return coverage;
};

const checkObjectFields = (value, fields, label) => {
  const coverage = {};

  fields.forEach((field) => {
    const present = Boolean(value && Object.prototype.hasOwnProperty.call(value, field) && value[field] !== null && value[field] !== undefined);
    coverage[field] = {
      present: present ? 1 : 0,
      total: 1,
      ratio: present ? 1 : 0,
    };
    if (!present) {
      addWarning('field-missing', `${label}.${field} is missing`, {
        field: `${label}.${field}`,
        missing: 1,
        total: 1,
      });
    }
  });

  return coverage;
};

const collectImageSamples = (indexItems, pageItems) => {
  const samples = [];
  const seen = new Set();
  const perGroupLimit = Math.max(1, Math.floor(imageSampleLimit / 2));
  const add = (type, promptId, url, limit) => {
    if (!url || typeof url !== 'string' || seen.has(url)) {
      return;
    }
    const typeCount = samples.filter((sample) => sample.type === type).length;
    if (typeCount >= limit) return;
    seen.add(url);
    samples.push({ type, promptId, url });
  };

  indexItems.forEach((item) => {
    add('thumbnailUrl', item.id, item.thumbnailUrl, perGroupLimit);
  });

  pageItems.forEach((item) => {
    const mediaUrl = Array.isArray(item.media) ? item.media[0] : null;
    add('media', item.id, mediaUrl, imageSampleLimit - perGroupLimit);
  });

  return samples;
};

const checkImageSample = async (sample) => {
  const result = {
    type: sample.type,
    promptId: sample.promptId,
    url: sanitizeUrl(sample.url),
    status: null,
    ok: false,
    contentType: null,
    bytes: null,
  };

  try {
    new URL(sample.url);
  } catch {
    result.error = 'invalid URL';
    addWarning('image-invalid-url', `${sample.type} image URL is invalid`, {
      type: sample.type,
      promptId: sample.promptId,
    });
    return result;
  }

  try {
    let response = await fetchWithTimeout(sample.url, { method: 'HEAD' }, imageTimeoutMs);
    if (response.status === 405) {
      response = await fetchWithTimeout(sample.url, {
        method: 'GET',
        headers: {
          Range: 'bytes=0-0',
        },
      }, imageTimeoutMs);
    }

    result.status = response.status;
    result.ok = response.ok;
    result.contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    result.bytes = contentLength ? Number(contentLength) : null;

    if (!response.ok) {
      addWarning('image-fetch-failed', `${sample.type} image returned HTTP ${response.status}`, {
        type: sample.type,
        promptId: sample.promptId,
        status: response.status,
        url: result.url,
      });
    }
  } catch (error) {
    result.error = error.message;
    addWarning('image-fetch-failed', `${sample.type} image could not be fetched`, {
      type: sample.type,
      promptId: sample.promptId,
      error: error.message,
      url: result.url,
    });
  }

  return result;
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) {
    return 'n/a';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const summarizeHeaders = (headers) => ({
  'content-type': headers['content-type'] || null,
  'content-length': headers['content-length'] || null,
  etag: headers.etag || null,
  'cache-control': headers['cache-control'] || null,
  'access-control-allow-origin': headers['access-control-allow-origin'] || null,
  server: headers.server || null,
});

const createMarkdownReport = (summary) => {
  const endpointRows = Object.entries(summary.endpoints).map(([key, endpoint]) => (
    `| ${key} | ${endpoint.status ?? 'n/a'} | ${formatBytes(endpoint.bytes)} | ${endpoint.elapsedMs} | ${endpoint.headers.etag || ''} | ${endpoint.headers['cache-control'] || ''} |`
  )).join('\n');

  const headerRows = Object.entries(summary.endpoints).map(([key, endpoint]) => (
    `| ${key} | ${endpoint.headers['content-type'] || ''} | ${endpoint.headers['content-length'] || ''} | ${endpoint.headers['access-control-allow-origin'] || ''} | ${endpoint.headers.server || ''} |`
  )).join('\n');

  const indexKeys = summary.index.firstItemKeys.map((key) => `\`${key}\``).join(', ');
  const pageKeys = summary.pageSample.firstItemKeys.map((key) => `\`${key}\``).join(', ');
  const warningRows = summary.warnings.length > 0
    ? summary.warnings.map((warning) => `| ${warning.code} | ${warning.message} |`).join('\n')
    : '| - | No non-blocking warnings. |';

  const imageRows = summary.imageSamples.results.length > 0
    ? summary.imageSamples.results.map((item) => (
      `| ${item.type} | ${item.promptId} | ${item.status ?? 'n/a'} | ${item.ok ? 'yes' : 'no'} | ${item.contentType || ''} | ${item.url} |`
    )).join('\n')
    : '| - | - | - | - | - | - |';

  return `# Nano Feed Contract - 2026-06-06

> 本报告由 \`node scripts/check-nano-feed.cjs\` 生成，位于本地开发资料目录，不作为 WeSight 运行时依赖。

## 结论

- Source ID: \`${summary.sourceId}\`
- Source Name: \`${sourceName}\`
- Checked At: \`${summary.checkedAt}\`
- Feed version: \`${summary.meta.version}\`
- Last updated: \`${summary.meta.lastUpdated}\`
- Total items: \`${summary.meta.totalItems}\`
- Total pages: \`${summary.meta.totalPages}\`
- Items per page: \`${summary.meta.itemsPerPage}\`
- Blocking errors: \`${summary.blockingErrors.length}\`
- Non-blocking warnings: \`${summary.warnings.length}\`

当前 Nano static JSON 可作为 WeSight Phase N1/N2 的外部 Prompt 数据源输入。正式运行时仍应由 Main Process 拉取、校验和缓存，Renderer 不应直接依赖远程 JSON。

## Endpoints

| Endpoint | HTTP | Size | Elapsed ms | ETag | Cache-Control |
|---|---:|---:|---:|---|---|
${endpointRows}

## Response Headers

| Endpoint | Content-Type | Content-Length | CORS | Server |
|---|---|---:|---|---|
${headerRows}

## Data Shape

### meta.json

- Top-level keys: ${summary.meta.keys.map((key) => `\`${key}\``).join(', ')}
- \`version\`: \`${summary.meta.version}\`
- \`lastUpdated\`: \`${summary.meta.lastUpdated}\`
- \`totalItems\`: \`${summary.meta.totalItems}\`
- \`itemsPerPage\`: \`${summary.meta.itemsPerPage}\`
- \`totalPages\`: \`${summary.meta.totalPages}\`
- \`totalCategories\`: \`${summary.meta.totalCategories}\`
- \`preRenderedPages\`: \`${summary.meta.preRenderedPages}\`

### index.json

- Top-level keys: ${summary.index.keys.map((key) => `\`${key}\``).join(', ')}
- Item count: \`${summary.index.itemCount}\`
- First item keys: ${indexKeys}
- 用途：轻量列表、搜索、定位详情所在 page。
- 注意：当前体积为 ${formatBytes(summary.index.bytes)}，后续不应在 Renderer 中直接拉取和解析。

### page-1.json

- Top-level keys: ${summary.pageSample.keys.map((key) => `\`${key}\``).join(', ')}
- Page: \`${summary.pageSample.page}\`
- Item count: \`${summary.pageSample.itemCount}\`
- First item keys: ${pageKeys}
- 用途：按需懒加载完整 prompt detail。

## Field Coverage

字段覆盖详情以脚本输出的 \`fieldCoverage\` JSON 为准。本次检查覆盖：

- \`meta\`: ${Object.keys(summary.fieldCoverage.meta).map((key) => `\`${key}\``).join(', ')}
- \`index.item\`: ${Object.keys(summary.fieldCoverage.indexItem).map((key) => `\`${key}\``).join(', ')}
- \`page.item\`: ${Object.keys(summary.fieldCoverage.pageItem).map((key) => `\`${key}\``).join(', ')}

## Image URL Samples

图片抽样失败只作为 warning，不阻塞 feed contract 检查。

| Type | Prompt ID | HTTP | OK | Content-Type | URL |
|---|---|---:|---|---|---|
${imageRows}

## Risks

- \`index.json\` 已达到多 MB 级，随着 prompt 数增长会继续变大；WeSight 后续必须采用 Main Process cache-first、etag 条件请求和后台刷新。
- \`page-N.json\` 每页约 15 条，适合详情页懒加载，但 Phase N2 必须处理单页失败、JSON schema 漂移和 raw JSON 降级保存。
- 当前契约依赖固定路径，若 Nano 站点改路径或 schema，WeSight 需要通过 source config 和 raw JSON 回退降低影响。
- 图片 URL 属于外部资源，失败、403、超时或 Content-Type 异常都不应阻塞 Prompt 文本使用。
- Prompt 内容只能作为用户素材或用户 prompt 输入处理，不能作为 system prompt 注入。

## Recommendation

建议 Nano 站点后续补充 \`/data/feed-version.json\`，但这个建议不阻塞 WeSight 第一阶段开发。建议 schema：

\`\`\`json
{
  "schemaVersion": "nano.static-feed.v1",
  "sourceId": "nano-supai",
  "sourceName": "Nano Banana Prompts",
  "baseUrl": "https://nano.supai.site",
  "paths": {
    "meta": "/data/meta.json",
    "index": "/data/index.json",
    "page": "/data/pages/page-{page}.json"
  },
  "features": {
    "indexSearch": true,
    "pagedFullPrompt": true,
    "thumbnails": true,
    "translatedContent": true,
    "tags": true
  }
}
\`\`\`

## Warnings

| Code | Message |
|---|---|
${warningRows}
`;
};

const main = async () => {
  console.log('[NanoFeedCheck] checking Nano static feed endpoints');

  const checkedAt = nowWithOffset();
  const metaResponse = await fetchJsonEndpoint(endpoints.meta);
  const indexResponse = await fetchJsonEndpoint(endpoints.index);
  const pageResponses = [];

  for (const endpoint of endpoints.pages) {
    pageResponses.push({
      endpoint,
      response: await fetchJsonEndpoint(endpoint),
    });
  }

  const indexItems = getIndexes(indexResponse.data);
  const pageOne = pageResponses[0];
  const pageItems = pageOne ? getItems(pageOne.response.data, pageOne.endpoint.label) : [];

  const imageSamples = collectImageSamples(indexItems, pageItems);
  const imageResults = [];
  for (const sample of imageSamples) {
    imageResults.push(await checkImageSample(sample));
  }

  const summary = {
    sourceId,
    checkedAt,
    endpoints: {
      meta: {
        status: metaResponse.status,
        ok: metaResponse.ok,
        headers: summarizeHeaders(metaResponse.headers),
        bytes: metaResponse.bytes,
        maxBytes: metaResponse.maxBytes,
        elapsedMs: metaResponse.elapsedMs,
      },
      index: {
        status: indexResponse.status,
        ok: indexResponse.ok,
        headers: summarizeHeaders(indexResponse.headers),
        bytes: indexResponse.bytes,
        maxBytes: indexResponse.maxBytes,
        elapsedMs: indexResponse.elapsedMs,
      },
      'page-1': {
        status: pageOne?.response.status ?? null,
        ok: pageOne?.response.ok ?? false,
        headers: summarizeHeaders(pageOne?.response.headers || {}),
        bytes: pageOne?.response.bytes ?? 0,
        maxBytes: pageOne?.response.maxBytes ?? endpoints.pages[0].maxBytes,
        elapsedMs: pageOne?.response.elapsedMs ?? 0,
      },
    },
    meta: {
      keys: getKeys(metaResponse.data),
      version: metaResponse.data?.version ?? null,
      lastUpdated: metaResponse.data?.lastUpdated ?? null,
      totalItems: metaResponse.data?.totalItems ?? null,
      totalPages: metaResponse.data?.totalPages ?? null,
      itemsPerPage: metaResponse.data?.itemsPerPage ?? null,
      totalCategories: metaResponse.data?.totalCategories ?? null,
      preRenderedPages: metaResponse.data?.preRenderedPages ?? null,
    },
    index: {
      keys: getKeys(indexResponse.data),
      bytes: indexResponse.bytes,
      itemCount: indexItems.length,
      firstItemKeys: getKeys(indexItems[0]),
    },
    pageSample: {
      page: pageOne?.endpoint.page ?? 1,
      keys: getKeys(pageOne?.response.data),
      bytes: pageOne?.response.bytes ?? 0,
      itemCount: pageItems.length,
      firstItemKeys: getKeys(pageItems[0]),
    },
    fieldCoverage: {
      meta: checkObjectFields(metaResponse.data, requiredMetaFields, 'meta'),
      indexItem: computeFieldCoverage(indexItems, requiredIndexItemFields, 'index.item'),
      pageItem: computeFieldCoverage(pageItems, requiredPageItemFields, 'page.item'),
    },
    imageSamples: {
      checked: imageResults.length,
      failed: imageResults.filter((result) => !result.ok).length,
      results: imageResults,
    },
    warnings,
    blockingErrors,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, createMarkdownReport(summary));

  console.log(JSON.stringify(summary, null, 2));
  console.log(`[NanoFeedCheck] wrote feed contract report to ${reportPath}`);

  if (blockingErrors.length > 0) {
    console.error(`[NanoFeedCheck] found ${blockingErrors.length} blocking error(s)`);
    process.exit(1);
  }

  console.log(`[NanoFeedCheck] completed with ${warnings.length} warning(s)`);
};

main().catch((error) => {
  console.error('[NanoFeedCheck] feed check failed:', error);
  process.exit(1);
});
