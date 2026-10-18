// 下游差异回归：上游共用用例已迁入 tests/，这里只保留新增或增强的保护。
import dotenv from 'dotenv';

dotenv.config();

import test from 'node:test';

import assert, { strict as strictAssert } from 'node:assert';

import vm from 'node:vm';

import fs from 'node:fs/promises';

import os from 'node:os';

import path from 'node:path';

import { Readable } from 'node:stream';

import { execFileSync, spawnSync } from 'node:child_process';

import { Request as NodeFetchRequest } from 'node-fetch';

import { handleRequest } from './worker.js';

import { extractTitleSeasonEpisode, getBangumi, getComment, getCommentByUrl, getSegmentComment, matchAnime, searchAnime, buildSearchAnimeUrl, filterSameEpisodeTitle, findEpisodeByNumber, resolveSearchFallbackSources, resolveSourceAndRealId, matchSeason, matchAniAndEp, fallbackMatchAniAndEp } from "./apis/dandan-api.js";

import { stripLinkOffset, applyOffset } from "./utils/offset-util.js";

import { handleFavoriteAdd, handleFavoriteList, handleFavoriteRefresh, handleFavoriteRemove } from './apis/favorite-api.js';

import { extractSeasonNumberFromAnimeTitle, normalizeTitleForMatch } from "./utils/common-util.js";

import { handleClearCache } from './apis/system-api.js';

import { httpGet, httpPost } from './utils/http-util.js';

import { getRedisCaches, getRedisKey, pingRedis, setRedisKey, setRedisKeyWithExpiry, updateRedisCaches } from "./utils/redis-util.js";

import { getLocalRedisKey, setLocalRedisKey, setLocalRedisKeyWithExpiry } from "./utils/local-redis-util.js";

import { getImdbepisodes } from "./utils/imdb-util.js";

import { getTMDBChineseTitle, getTmdbJpDetail, searchTmdbTitles } from "./utils/tmdb-util.js";

import { getDoubanDetail, getDoubanInfoByImdbId, searchDoubanTitles } from "./utils/douban-util.js";

import AIClient from './utils/ai-util.js';

import RenrenSource from "./sources/renren.js";

import HanjutvSource from "./sources/hanjutv.js";

import BahamutSource from "./sources/bahamut.js";

import TencentSource, { fetchTencentDanmuSegments } from "./sources/tencent.js";

import IqiyiSource from "./sources/iqiyi.js";

import MangoSource from "./sources/mango.js";

import BilibiliSource from "./sources/bilibili.js";

import YoukuSource, { mapWithConcurrency } from "./sources/youku.js";

import MiguSource from "./sources/migu.js";

import SohuSource from "./sources/sohu.js";

import LeshiSource from "./sources/leshi.js";

import XiguaSource from "./sources/xigua.js";

import MaiduiduiSource from "./sources/maiduidui.js";

import AiyifanSource from "./sources/aiyifan.js";

import HongguoSource, { HONGGUO_WEB_TIMEOUT_MS, parseHongguoPlayerUrl, parseWebSearchResults, parseWebSeriesDetail } from "./sources/hongguo.js";

import AnimekoSource from "./sources/animeko.js";

import OtherSource from "./sources/other.js";

import { NodeHandler } from "./configs/handlers/node-handler.js";

import { VercelHandler } from "./configs/handlers/vercel-handler.js";

import { NetlifyHandler } from "./configs/handlers/netlify-handler.js";

import { CloudflareHandler } from "./configs/handlers/cloudflare-handler.js";

import { EdgeoneHandler } from "./configs/handlers/edgeone-handler.js";

import { HuggingfaceHandler } from "./configs/handlers/huggingface-handler.js";

import { HandlerFactory } from "./configs/handlers/handler-factory.js";

import { Envs } from "./configs/envs.js";

import { Globals } from "./configs/globals.js";

import { getAllSourceMetas, getInitializedSourceKeys, getLogNameByKey, getSourceByKey, getSourceMetaByKey } from "./sources/registry.js";

import { addAnime, addEpisode, findUrlById, getEpisodeIdFloor, getCommentCache, getSearchCache, hasSeasonSpecificPreference, isSearchCacheValid, setCommentCache, setSearchCache } from "./utils/cache-util.js";

import { addFavorite, listFavorites, loadFavorites, removeFavorite, resolveFavoriteForKeyword, saveFavorites } from './utils/favorite-util.js';

import { candidateMatchesMappingQualifiers, candidateMatchesMappingTitle, parseAutoMatchMappingRules, resolveAutoMatchMapping } from './utils/auto-match-mapping-util.js';

import { HTML_TEMPLATE } from './ui/template.js';

import { mainJsContent } from './ui/js/main.js';

import { apitestJsContent } from './ui/js/apitest.js';

import { logviewJsContent } from './ui/js/logview.js';

import { systemSettingsJsContent } from './ui/js/systemsettings.js';

import { previewJsContent } from './ui/js/preview.js';

import { convertToAsciiSum } from "./utils/codec-util.js";

import { buildGradientSampler, convertToDanmakuJson, handleDanmusLike, resolveGradientSkin, splitBlockedWords, parseBlockedWord } from "./utils/danmu-util.js";

import { Segment, SegmentListResponse } from "./models/dandan-model.js"

import { initBangumiData, searchBangumiData, clearBangumiDataCache, dedupeBangumiSearchResults } from "./utils/bangumi-data-util.js";

import { parseNipaplayRelatedLinks, resolveNipaplayLink, applyShiftToDanmu, fetchNipaplayDanmaku, verifyNipaplayAccount } from "./utils/nipaplay-util.js";

import { httpPatch } from "./utils/http-util.js";

import DandanSource from "./sources/dandan.js";

import { extractFongmiSeasonNumber, scoreFongmiEpisodeMatch } from "./apis/clients/fongmi-api.js";

import { localDanmuJsContent } from './ui/js/localdanmu.js';

import { buildLocalDanmuResourceKey, groupLocalDanmuResources, parseLocalDanmu, normalizeLocalSeason } from './utils/local-danmu-parser.js';

import { handleLocalDanmuUpload, handleLocalDanmuList, handleLocalDanmuDelete, handleLocalDanmuGet, handleLocalDanmuUpdate } from './apis/local-danmu-api.js';

import { saveLocalDanmu, getLocalDanmu, listLocalDanmu, findLocalDanmu, removeLocalDanmu, localDanmuFileName } from './utils/local-danmu-store.js';

import { handleConfig } from './apis/system-api.js';

import { handleAiVerify, handleDandanplayVerify } from './apis/env-api.js';

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

class MockRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map(Object.entries(options.headers || {}));
    this.json = options.body ? async () => options.body : undefined;  // 模拟 POST 请求的 body
  }
}

async function parseResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function mockJsonResponse(data, url) {
  return {
    ok: true,
    status: 200,
    url,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(data),
  };
}

function mockHtmlResponse(html, url) {
  return {
    ok: true,
    status: 200,
    url,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    text: async () => html,
  };
}

async function withMockFetch(mockFetch, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    return await run();
  } finally {
    if (originalFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = originalFetch;
  }
}

function createSearchResult(anime) {
  return {
    animeId: anime.animeId,
    bangumiId: anime.bangumiId,
    animeTitle: anime.animeTitle,
    type: anime.type,
    typeDescription: anime.typeDescription,
    imageUrl: anime.imageUrl,
    startDate: anime.startDate,
    episodeCount: anime.episodeCount,
    rating: anime.rating,
    isFavorited: anime.isFavorited,
    source: anime.source
  };
}

function resetSearchState() {
  Globals.init({});
  Globals.aiValid = false;
  Globals.animes = [];
  Globals.episodeIds = [];
  Globals.episodeNum = 10001;
  Globals.searchCache = new Map();
  Globals.commentCache = new Map();
  Globals.requestHistory = new Map();
  Globals.envs.rateLimitMaxRequests = 0;
  delete Globals.requestAnimeDetailsMap;
}

function resetFavoriteState(env = {}) {
  Globals.init(env);
  Globals.deployPlatform = 'node';
  Globals.animes = [];
  Globals.episodeIds = [];
  Globals.episodeNum = 10001;
  Globals.searchCache = new Map();
  Globals.commentCache = new Map();
  Globals.favoriteCache = new Map();
  Globals.requestHistory = new Map();
  Globals.localCacheValid = false;
  Globals.localCacheInitialized = false;
  Globals.redisValid = false;
  Globals.queryCacheInitialized = false;
  Globals.queryCacheWritable = {}; Globals.favoriteCacheWritable = {};
}

function createFavoriteAnime(title = '收藏测试', episodeCount = 2, id = 910001) {
  return {
    animeId: id,
    bangumiId: String(id),
    animeTitle: title,
    type: 'tvseries',
    typeDescription: 'TV',
    imageUrl: 'https://example.com/favorite.jpg',
    startDate: '2026-01-01T00:00:00.000Z',
    episodeCount,
    rating: 0,
    isFavorited: true,
    source: 'tencent',
    links: Array.from({ length: episodeCount }, (_, index) => ({
      id: id * 10 + index + 1,
      url: `https://v.qq.com/x/cover/favorite/ep${index + 1}.html`,
      title: `【qq】 第${index + 1}集`
    }))
  };
}

function favoriteSearchResult(anime) {
  const { links, ...result } = anime;
  return result;
}

const urlPrefix = "http://localhost:9321";

const token = "87654321";

async function checkLocalRedisTimeout(scenario) {
  const base = new URL('./', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import net from 'node:net';
    import http from 'node:http';
    import fs from 'node:fs/promises';
    import { mock } from 'node:test';
    const { handleRequest } = await import(${JSON.stringify(base + 'worker.js')});
    const { Globals } = await import(${JSON.stringify(base + 'configs/globals.js')});
    const local = await import(${JSON.stringify(base + 'utils/local-redis-util.js')});
    const { handleClearCache } = await import(${JSON.stringify(base + 'apis/system-api.js')});
    const scenario = ${JSON.stringify(scenario)};
    const clearing = scenario.startsWith('clear-');
    const writing = scenario === 'write';
    // 生产预算（业务命令 30s、握手 5s、批量/清理 5s、Upstash 5s）仅在测试中钳制到 1200ms，
    // 避免每个故障场景等待数秒；budgets 记录原始值，断言仍验证 deadline 真实流逝且有上界。
    const budgets = []; const realTimeout = globalThis.setTimeout;
    mock.method(globalThis, 'setTimeout', (fn, ms, ...args) => {
      budgets.push(ms); return realTimeout(fn, ms > 1200 ? 1200 : ms, ...args);
    });
    const realSignalTimeout = AbortSignal.timeout.bind(AbortSignal);
    mock.method(AbortSignal, 'timeout', ms => realSignalTimeout(ms > 1200 ? 1200 : ms));
    let stalled = !writing; let recovered = false;
    const sockets = new Set(); let connections = 0;
    const server = net.createServer(socket => {
      connections++; sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => sockets.delete(socket));
      let pending = '';
      socket.on('data', chunk => {
        pending += chunk.toString();
        // 测试命令参数不含原始 CR/LF；按 RESP 数组长度处理分片和合并的 TCP 数据。
        while (pending) {
          const fields = pending.split('\\r\\n'); const count = Number(fields[0].slice(1));
          if (fields.length < count * 2 + 2) break;
          const command = fields[2]; pending = fields.slice(count * 2 + 1).join('\\r\\n');
          if (!recovered && scenario.endsWith('handshake')) continue;
          if (command === 'CLIENT' && scenario === 'clear-write') setTimeout(() => socket.write('+OK\\r\\n'), 600); // 慢握手须仍快于钳制后的 1200ms 命令预算
          else if (command === 'CLIENT' || command === 'QUIT') socket.write('+OK\\r\\n');
          else if (command === 'PING') socket.write('+PONG\\r\\n');
          else if (!stalled) socket.write(command === 'GET' ? '$-1\\r\\n' : '+OK\\r\\n');
        }
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const env = { LOCAL_REDIS_URL: 'redis://127.0.0.1:' + server.address().port,
      LOCAL_CACHE_ENABLED: String(scenario === 'read'), LOG_LEVEL: 'error', RATE_LIMIT_MAX_REQUESTS: '0' };
    const request = () => handleRequest(new Request('http://localhost/api/config'), env, 'node', '127.0.0.1');
    let upstashServer;
    await (async () => {
    try {
      if (scenario === 'read') {
        await fs.mkdir('.cache');
        await fs.writeFile('.cache/animes', JSON.stringify(JSON.stringify([{ animeId: 7001 }])));
      }
      if (writing) {
        assert.equal((await request()).status, 200);
        Globals.animes = [{ animeId: 7001 }]; stalled = true;
      }
      if (clearing) {
        upstashServer = http.createServer(req => req.resume()); // 接收请求，但不回应 HTTP。
        await new Promise(resolve => upstashServer.listen(0, '127.0.0.1', resolve));
        Globals.init({ ...env, UPSTASH_REDIS_REST_URL: 'http://127.0.0.1:' + upstashServer.address().port, UPSTASH_REDIS_REST_TOKEN: 'test' });
        Globals.deployPlatform = 'node'; Globals.animes = [{ animeId: 7001 }];
        Globals.queryCacheWritable = { upstash: false, localRedis: false };
        const hashes = { ...Globals.localRedisHashes }; const start = performance.now();
        const response = await handleClearCache({ json: async () => ({ items: ['animes', 'episodeIds', 'episodeNum', 'lastSelectMap', 'requestHistory'] }) });
        const elapsedMs = performance.now() - start; const body = await response.json();
        assert.equal(response.status, 500); assert.equal(body.success, false);
        assert.deepEqual(body.failedBackends, ['upstash', 'localRedis']);
        assert.deepEqual(Globals.animes, []); assert.match(body.message, /内存已清理/);
        assert.deepEqual(Globals.localRedisHashes, hashes); assert.deepEqual(Globals.upstashHashes, {});
        assert.deepEqual(Globals.queryCacheWritable, { upstash: false, localRedis: false });
        assert.ok(elapsedMs >= 1000 && elapsedMs < 4000, 'clear includes connection time: ' + elapsedMs + 'ms');
        if (scenario === 'clear-write') assert.ok(budgets.some(ms => ms > 3500 && ms < 4900), 'remaining budget subtracts connection time: ' + budgets.join(','));
        console.log(JSON.stringify({ clearMs: Math.round(elapsedMs), scenario }));
        return;
      }
      const hashes = { ...Globals.localRedisHashes };
      const start = performance.now();
      if (scenario === 'write') {
        const results = await Promise.all([
          local.updateLocalRedisCaches(), local.setLocalRedisKeyWithExpiry('timeoutProbe', 1, 60),
          local.getLocalRedisKey('timeoutProbe').then(() => false, () => true)
        ]);
        assert.deepEqual(results, [false, { result: 'ERROR' }, true]);
        assert.ok(budgets.includes(30000));
      } else {
        const responses = await Promise.all([request(), request()]);
        assert.ok(responses.every(response => response.status === 200));
      }
      const first = performance.now() - start;
      assert.ok(first >= 1000 && first < 4000, 'first request: ' + first + 'ms');
      assert.deepEqual(Globals.localRedisHashes, hashes, 'failed commands never advance hashes');
      assert.equal(Globals.localRedisValid, false);
      if (scenario === 'read') assert.equal(Globals.animes[0].animeId, 7001, 'healthy files restore after GET timeout');
      const next = performance.now();
      assert.equal((await request()).status, 200);
      if (scenario === 'write') assert.equal(await local.updateLocalRedisCaches(), false);
      const second = performance.now() - next;
      assert.ok(second < 1500, 'cooldown request: ' + second + 'ms');
      assert.equal(connections, 1);
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(sockets.size, 0, 'timed-out connection closes before test cleanup');
      recovered = true; stalled = false;
      const realNow = Date.now; mock.method(Date, 'now', () => realNow() + 30001);
      assert.equal((await request()).status, 200); assert.equal(connections, 2);
      if (scenario !== 'handshake') assert.equal(Globals.animes[0].animeId, 7001, 'reconnection keeps current memory');
      if (scenario === 'write') {
        assert.equal(await local.updateLocalRedisCaches(), true);
        assert.notEqual(Globals.localRedisHashes.animes, hashes.animes);
      }
      console.log(JSON.stringify({ firstMs: Math.round(first), secondMs: Math.round(second), connections }));
    } finally {
      if (upstashServer) { upstashServer.closeAllConnections(); await new Promise(resolve => upstashServer.close(resolve)); }
      await local.closeLocalRedisConnection();
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    }
    })();
  `;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'danmu-redis-timeout-'));
  try {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: dir, encoding: 'utf8', timeout: 14000, maxBuffer: 1024 * 1024
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const timing = result.stdout.split('\n').find(line => line.startsWith('{"firstMs"') || line.startsWith('{"clearMs"'));
    if (timing) console.log('Redis ' + scenario + ' timing: ' + timing);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

for (const scenario of ['handshake', 'read', 'write', 'clear-handshake', 'clear-write']) {
  test(`Local Redis ${scenario} timeout is bounded and subsequent requests observe cooldown`, () => checkLocalRedisTimeout(scenario));
}

const comment = '标题警告‼️ 中文弹幕 😀 \uFFFD';

const json = JSON.stringify({ count: 1, comments: [{ p: '1.00,1,16777215,[qiyi]', m: comment }] }, null, 2);

const expected = { format: 'JSON', comments: [{ p: '1.00,1,16777215', m: comment }], errors: [] };

const assFixture = (events, styles = '', wrapStyle = 2) => `[Script Info]
ScriptType: v4.00+
WrapStyle: ${wrapStyle}
[V4+ Styles]
Format: Name, PrimaryColour, Alignment
${styles}
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.map(text => `Dialogue: 0,0:00:01.18,0:00:06.18,Default,,0,0,0,,${text}`).join('\n')}`;

const parseAssFixture = (...args) => parseLocalDanmu(Buffer.from(assFixture(...args)), 'test.ass');

const encodings = [
  ['UTF-8', text => Buffer.from(text, 'utf8')],
  ['UTF-8 with BOM', text => Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(text, 'utf8')])],
  ['UTF-16LE', text => Buffer.from(text, 'utf16le')],
  ['UTF-16LE with BOM', text => Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(text, 'utf16le')])],
  ['UTF-16BE', text => Buffer.from(text, 'utf16le').swap16()],
  ['UTF-16BE with BOM', text => Buffer.concat([Buffer.from([0xFE, 0xFF]), Buffer.from(text, 'utf16le').swap16()])],
];

for (const [encoding, encode] of encodings) {
  test(`multipart upload preserves and parses ${encoding} across byte boundaries`, async () => {
    const fileBytes = encode(json);
    const boundary = 'local-danmu-test-boundary';
    const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="danmu.json"\r\nContent-Type: application/json\r\n\r\n`);
    const multipart = Buffer.concat([header, fileBytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    // 每块一个字节，覆盖中文、emoji、BOM 和 UTF-16 码元被分块的情况。
    const chunks = Array.from(multipart, (_, index) => multipart.subarray(index, index + 1));
    const body = await readRequestBody(Readable.from(chunks));
    assert.deepEqual(body, multipart);

    const request = new Request('http://localhost/api/local-danmu/upload', {
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const form = await request.formData();
    const file = form.get('file');
    const uploadedBytes = Buffer.from(await file.arrayBuffer());
    assert.deepEqual(uploadedBytes, fileBytes);
    assert.deepEqual(parseLocalDanmu(uploadedBytes, file.name), expected);
  });
}

function resetState(sourceOrder = 'local') {
  Globals.init({ SOURCE_ORDER: sourceOrder, SOURCE_FALLBACK_ORDER: 'none', LOG_LEVEL: 'error', GROUP_MINUTE: '0' });
  Globals.deployPlatform = 'node';
  Globals.animes = [];
  Globals.episodeIds = [];
  Globals.episodeNum = 10001;
  Globals.searchCache = new Map();
  Globals.commentCache = new Map();
  Globals.favoriteCache = new Map();
  Globals.lastSelectMap = new Map();
  Globals.requestHistory = new Map();
  Globals.localCacheValid = false;
  Globals.redisValid = false;
  Globals.localRedisValid = false;
  Globals.aiValid = false;
  Globals.envs.mergeSourcePairs = [];
  Globals.envs.customMergeRules = [];
  Globals.envs.enableAnimeEpisodeFilter = false;
}

function makeResource(title, episode, year = 2026, type = 'tv', status = 'ready') {
  return {
    title, episode, year, type, status,
    resourceKey: buildLocalDanmuResourceKey({ title, episode, year, type }),
    count: 1,
    comments: [{ p: '1.00,1,16777215', m: `第${episode ?? 1}集弹幕` }],
  };
}

const localDanmuDir = () => path.join(process.cwd(), '.cache', 'local-danmu');

const localIndexPath = () => path.join(localDanmuDir(), 'index.meta');

const localDataPath = key => path.join(localDanmuDir(), localDanmuFileName(key));

function searchUrl(keyword) {
  const url = new URL('http://localhost/api/v2/search/anime');
  url.searchParams.set('keyword', keyword);
  return url;
}

async function uploadResource(fields, message) {
  const form = new FormData();
  form.append('file', new Blob([JSON.stringify({ comments: [{ p: '1,1,16777215', m: message }] })]), 'danmu.json');
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  return handleLocalDanmuUpload(new NodeFetchRequest('http://localhost/api/local-danmu/upload', { method: 'POST', body: form }));
}

function mockRemoteSource(t) {
  const remote = getSourceByKey('tencent');
  t.mock.method(remote, 'search', async () => [{}]);
  t.mock.method(remote, 'handleAnimes', async (_results, query, animes, details) => {
    const anime = {
      animeId: 900001, bangumiId: '900001', animeTitle: `${query}(2026)【TV】from tencent`,
      type: 'tvseries', typeDescription: 'TV', imageUrl: '', startDate: '2026-01-01',
      episodeCount: 10, rating: 0, isFavorited: true, source: 'tencent',
    };
    const links = Array.from({ length: 10 }, (_, index) => ({
      name: `第${index + 1}集`, title: `【qq】 第${index + 1}集`, url: `https://v.qq.com/test-episode-${index + 1}`,
    }));
    addAnime({ ...anime, links }, details);
    animes.push(anime);
  });
}

class TestElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.className = '';
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.value = '';
    this.required = false;
    this.validity = { badInput: false };
    this.style = {};
    this.attributes = {};
    const classes = () => this.className.split(/\s+/).filter(Boolean);
    this.classList = {
      add: (...tokens) => { this.className = [...new Set([...classes(), ...tokens])].join(' '); },
      remove: (...tokens) => { this.className = classes().filter(token => !tokens.includes(token)).join(' '); },
      contains: token => classes().includes(token),
    };
    this._text = '';
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_value) { throw new Error('Uploaded metadata must be rendered as text'); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  click() { this.clicked = true; }
  querySelectorAll(selector) {
    const matches = element => selector.startsWith('.')
      ? element.className.split(' ').includes(selector.slice(1)) : element.tagName === selector;
    return this.children.flatMap(child => [ ...(matches(child) ? [child] : []), ...child.querySelectorAll(selector) ]);
  }
}

function makePage(fetch, sandboxGlobals = {}, html) {
  const elements = new Map();
  const documentListeners = new Map();
  for (const name of ['file', 'title', 'year', 'type', 'season', 'episode', 'season-label', 'episode-label', 'fields', 'episode-field', 'batch-preview', 'batch-list', 'permission', 'upload-button', 'upload-status', 'search', 'list', 'edit-modal', 'edit-group-fields', 'edit-resource-fields', 'edit-name', 'edit-year', 'edit-type', 'edit-season', 'edit-episode', 'edit-filename', 'edit-status']) {
    elements.set(`local-danmu-${name}`, new TestElement());
  }
  const fileInput = (html || HTML_TEMPLATE).match(/<input\b[^>]*\bid="local-danmu-file"[^>]*>/)[0];
  elements.get('local-danmu-file').dataset.canUpload = html ? fileInput.match(/data-can-upload="([^"]*)"/)[1] : 'true';
  const context = vm.createContext({
    document: {
      createElement: tag => new TestElement(tag),
      getElementById: id => elements.get(id),
      addEventListener: (type, callback) => documentListeners.set(type, callback),
    },
    FormData,
    fetch,
    buildApiUrl: value => value,
    confirm: () => true,
    customAlert: () => {},
    currentToken: 'local-user-token',
    currentAdminToken: '',
    globals: { localDanmuRedisValid: true, localDanmuIsCloud: false },
    ...sandboxGlobals,
  });
  new vm.Script(localDanmuJsContent).runInContext(context);
  const chooseFile = vm.compileFunction(fileInput.match(/onclick="([^"]*)"/)[1], ['event'], { parsingContext: context });
  return { context, elements, documentListeners, chooseFile, box: elements.get('local-danmu-list') };
}

function fillUploadForm(elements, fields = {}) {
  elements.get('local-danmu-file').files = [new File(['{}'], 'danmu.json')];
  for (const [name, value] of Object.entries({ title: '本地资源', year: '2026', type: 'tv', season: '1', episode: '5', ...fields })) {
    elements.get(`local-danmu-${name}`).value = value;
  }
}

function resource(season, episode) {
  const fields = { title: '<img src=x> 分季剧', year: 2026, type: 'tv', season, episode };
  return {
    ...fields, resourceKey: buildLocalDanmuResourceKey(fields),
    filename: `第${episode}集 "<script>".json`, size: 1234, count: 2, status: 'ready',
  };
}

{
  const assert = strictAssert;
  const base = new URL('./', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs/promises';
    import os from 'node:os';
    import path from 'node:path';
    const base = ${JSON.stringify(base)};
    const { Globals: g } = await import(base + 'configs/globals.js');
    const redis = await import(base + 'utils/redis-util.js');
    const cache = await import(base + 'utils/cache-util.js');
    const { persistFavorites } = await import(base + 'apis/favorite-api.js');
    const { handleRequest } = await import(base + 'worker.js');
    const fixture = () => ({ results: [{ animeId: 1, animeTitle: 'saved' }], details: [], timestamp: 1,
      refreshSchedule: { frequency: 'weekly', weekday: 3, time: '09:00', nextRunAt: 1790816400000 } });
    const env = (url = 'https://old.invalid', token = 'old-token') => ({
      UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token,
      LOCAL_CACHE_ENABLED: 'false', LOG_LEVEL: 'error', RATE_LIMIT_MAX_REQUESTS: '0', TOKEN: '87654321'
    });
    const storeKey = (url, token) => JSON.stringify([url, token]);
    const stores = new Map([
      [storeKey('https://old.invalid', 'old-token'), new Map([['favoriteCache', JSON.stringify({ old: fixture() })]])],
      [storeKey('https://new.invalid', 'new-token'), new Map([['favoriteCache', JSON.stringify({ new: fixture() })]])],
      [storeKey('https://old.invalid', 'new-token'), new Map([['favoriteCache', JSON.stringify({ new: fixture() })]])]
    ]);
    const calls = [];
    let failRead = false;
    let delay = null;
    globalThis.fetch = async (url, options = {}) => {
      const parsed = new URL(url);
      if (parsed.pathname === '/ping') return Response.json({ result: 'PONG' });
      assert.equal(parsed.pathname, '/pipeline');
      const token = options.headers.Authorization.slice(7);
      const commands = JSON.parse(options.body);
      const store = stores.get(storeKey(parsed.origin, token));
      assert.ok(store);
      const results = commands.map(([op, key, value]) => {
        calls.push({ url: parsed.origin, token, op, key });
        if (op === 'GET' && key === 'favoriteCache' && failRead) return { error: 'temporary read failure' };
        if (op === 'GET') return { result: store.get(key) ?? null };
        assert.equal(op, 'SET'); store.set(key, value); return { result: 'OK' };
      });
      const waiting = delay;
      if (waiting && parsed.origin === 'https://old.invalid'
        && commands.some(([op, key]) => op === waiting.op && key === 'favoriteCache')) {
        delay = null; waiting.started(); await waiting.promise;
      }
      return Response.json(results);
    };
    const setup = async settings => {
      g.init(settings); await redis.judgeRedisValid('/api/config'); await redis.initializePersistentCaches('node');
    };
    const request = (settings, route, method = 'GET', body = undefined, platform = 'vercel') =>
      handleRequest(new Request('https://service.invalid' + route, { method,
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }), settings, platform, '127.0.0.1');
    const oldStore = stores.get(storeKey('https://old.invalid', 'old-token'));
    const pause = op => {
      let release, started;
      const promise = new Promise(resolve => { release = resolve; });
      const begun = new Promise(resolve => { started = resolve; });
      delay = { op, promise, started };
      return { release, begun };
    };
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'danmu-review-'));
    const cwd = process.cwd(); process.chdir(dir);
    try {
      const scenario = process.argv[1];
      if (['switch-url', 'switch-token', 'switch-empty', 'switch-unreadable'].includes(scenario)) {
        await setup(env());
        const nextEnv = env(scenario === 'switch-token' ? 'https://old.invalid' : 'https://new.invalid', 'new-token');
        const nextStore = stores.get(storeKey(nextEnv.UPSTASH_REDIS_REST_URL, 'new-token'));
        if (scenario === 'switch-empty') nextStore.delete('favoriteCache');
        if (scenario === 'switch-unreadable') failRead = true;
        await setup(nextEnv); await persistFavorites();
        assert.ok(calls.some(x => x.url === nextEnv.UPSTASH_REDIS_REST_URL && x.token === 'new-token' && x.op === 'GET' && x.key === 'favoriteCache'));
        if (scenario === 'switch-unreadable') {
          assert.equal(g.favoriteCacheWritable.upstash, false);
          assert.deepEqual(Object.keys(JSON.parse(nextStore.get('favoriteCache'))), ['new']);
          assert.equal(calls.some(x => x.token === 'new-token' && x.op === 'SET' && x.key === 'favoriteCache'), false);
        } else {
          assert.deepEqual([...g.favoriteCache.keys()], scenario === 'switch-empty' ? [] : ['new']);
          assert.deepEqual(Object.keys(JSON.parse(nextStore.get('favoriteCache'))), scenario === 'switch-empty' ? [] : ['new']);
          if (scenario !== 'switch-empty') assert.ok(g.favoriteCache.get('new').refreshSchedule);
        }
      } else if (scenario === 'disable-upstash') {
        await setup(env());
        const settings = { ...env(), UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' };
        const response = await request(settings, '/api/favorite/remove', 'POST', { keyword: 'old' }, 'node');
        assert.equal(response.status, 200); assert.equal((await response.json()).success, true);
        assert.equal(g.favoriteCache.has('old'), false);
        assert.deepEqual(Object.keys(JSON.parse(oldStore.get('favoriteCache'))), ['old']);
      } else if (scenario === 'initial-file-fallback') {
        oldStore.delete('favoriteCache');
        await fs.mkdir('.cache');
        await fs.writeFile('.cache/favoritesCache', JSON.stringify(JSON.stringify({ saved: fixture() })));
        await setup({ ...env(), LOCAL_CACHE_ENABLED: 'true' });
        assert.ok(g.favoriteCache.has('saved'));
        assert.equal(await redis.getFavoriteCachesFromRedis(), true);
        assert.ok(g.favoriteCache.has('saved'));
      } else if (scenario === 'temporary-read') {
        oldStore.set('favoriteCache', JSON.stringify({ saved: fixture() }));
        assert.equal((await request(env(), '/api/favorite/list')).status, 200);
        const before = JSON.stringify([...g.favoriteCache]);
        for (const action of ['add', 'remove', 'refresh']) {
          failRead = true; calls.length = 0;
          const response = await request(env(), '/api/favorite/' + action, 'POST', { keyword: 'saved' });
          assert.equal(response.status, 503);
          assert.equal((await response.json()).success, false);
          assert.equal(JSON.stringify([...g.favoriteCache]), before);
          assert.equal(calls.some(x => x.op === 'SET' && x.key === 'favoriteCache'), false);
        }
        failRead = false;
        const retry = await request(env(), '/api/favorite/remove', 'POST', { keyword: 'saved' });
        assert.equal(retry.status, 200); assert.equal((await retry.json()).success, true);
        assert.deepEqual(JSON.parse(oldStore.get('favoriteCache')), {});
        const list = await (await request(env(), '/api/favorite/list')).json();
        assert.deepEqual(list.favorites, []);
      } else if (scenario === 'node-read-protection') {
        failRead = true;
        const response = await request(env(), '/api/favorite/remove', 'POST', { keyword: 'old' }, 'node');
        assert.equal(response.status, 503); assert.equal((await response.json()).success, false);
        assert.deepEqual(Object.keys(JSON.parse(oldStore.get('favoriteCache'))), ['old']);
      } else if (scenario === 'stale-read' || scenario === 'stale-write') {
        await setup(env());
        if (scenario === 'stale-write') g.favoriteCache.set('changed', fixture());
        const waiting = pause(scenario === 'stale-read' ? 'GET' : 'SET');
        const oldOperation = scenario === 'stale-read' ? redis.getFavoriteCachesFromRedis() : redis.updateRedisCaches({ keys: ['favoriteCache'] });
        await waiting.begun;
        await setup(env('https://new.invalid', 'new-token'));
        const hash = g.upstashHashes.favoriteCache;
        waiting.release(); assert.equal(await oldOperation, false);
        assert.deepEqual([...g.favoriteCache.keys()], ['new']);
        assert.equal(g.favoriteCacheWritable.upstash, true);
        assert.equal(g.upstashHashes.favoriteCache, hash);
      } else if (scenario === 'stale-node-request') {
        oldStore.set('favoriteCache', JSON.stringify({ shared: fixture() }));
        const nextStore = stores.get(storeKey('https://new.invalid', 'new-token'));
        nextStore.set('favoriteCache', JSON.stringify({ shared: fixture(), untouched: fixture() }));
        const waiting = pause('GET');
        const oldRequest = request(env(), '/api/favorite/remove', 'POST', { keyword: 'shared' }, 'node');
        await waiting.begun;
        await setup(env('https://new.invalid', 'new-token'));
        const before = nextStore.get('favoriteCache');
        calls.length = 0; waiting.release();
        const response = await oldRequest;
        assert.equal(response.status, 503); assert.equal((await response.json()).success, false);
        assert.deepEqual([...g.favoriteCache.keys()], ['shared', 'untouched']);
        assert.equal(nextStore.get('favoriteCache'), before);
        assert.deepEqual(Object.keys(JSON.parse(oldStore.get('favoriteCache'))), ['shared']);
        assert.equal(calls.some(x => x.op === 'SET' && x.key === 'favoriteCache'), false);
      } else if (scenario === 'stale-initialization') {
        g.init(env()); await redis.judgeRedisValid('/api/config');
        const waiting = pause('GET');
        const oldOperation = redis.initializePersistentCaches('node');
        await waiting.begun;
        await setup(env('https://new.invalid', 'new-token'));
        waiting.release(); assert.equal(await oldOperation, false);
        assert.deepEqual([...g.favoriteCache.keys()], ['new']);
        assert.equal(g.redisCacheInitialized, true);
        assert.equal(g.favoriteCacheWritable.upstash, true);
      } else {
        throw new Error('Unknown scenario: ' + scenario);
      }
    } finally {
      process.chdir(cwd); await fs.rm(dir, { recursive: true, force: true });
    }
  `;

  for (const scenario of [
    'switch-url', 'switch-token', 'switch-empty', 'switch-unreadable', 'initial-file-fallback',
    'temporary-read', 'node-read-protection', 'disable-upstash', 'stale-read', 'stale-write', 'stale-initialization', 'stale-node-request'
  ]) {
    test('PR492 favorite regression: ' + scenario, () => {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, scenario], {
        encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024,
        env: { ...process.env, NODE_TEST_CONTEXT: '' }
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    });
  }

  function resetEpisodeState(t) {
    const savedGlobals = { ...Globals };
    const savedEnvs = {
      env: Envs.env,
      originalEnvVars: Envs.originalEnvVars,
      accessedEnvVars: Envs.accessedEnvVars,
      sensitiveKeys: Envs.sensitiveKeys
    };
    // 合并到主测试文件后，编号用例也要在结束时恢复共享状态。
    t.after(() => {
      Object.assign(Globals, savedGlobals);
      Object.assign(Envs, savedEnvs);
    });
    Envs.originalEnvVars = new Map(Envs.originalEnvVars);
    Envs.accessedEnvVars = new Map(Envs.accessedEnvVars);
    Envs.sensitiveKeys = new Set(Envs.sensitiveKeys);
    Globals.init({ LOCAL_CACHE_ENABLED: 'false', LOG_LEVEL: 'error', SEARCH_CACHE_MINUTES: '30' });
    Object.assign(Globals, {
      deployPlatform: 'node', localCacheValid: false, redisValid: false, logBuffer: [],
      queryCacheInitialized: true, queryCacheWritable: {}, favoriteCacheWritable: {},
      animes: [], episodeIds: [], episodeNum: 10001, favoriteCache: new Map(), searchCache: new Map()
    });
  }

  for (const source of ['favorite', 'search']) {
    test('PR492 episode IDs: reset retains ' + source + ' references', async t => {
      resetEpisodeState(t);
      const reference = { timestamp: Date.now(), details: [{ animeId: 1,
        links: [{ id: 10002, url: 'https://old.invalid/episode', title: 'old' }] }] };
      const store = source === 'favorite' ? Globals.favoriteCache : Globals.searchCache;
      store.set('saved', reference);
      assert.equal(findUrlById(10002), 'https://old.invalid/episode');
      assert.equal((await handleClearCache({ json: async () => ({ items: ['episodeNum'] }) })).status, 200);
      assert.equal(Globals.episodeNum, 10002);
      assert.equal(addEpisode('https://new.invalid/episode', 'new').id, 10003);
      assert.equal(findUrlById(10002), 'https://old.invalid/episode');
    });
  }

  test('PR492 episode IDs: expired search references do not raise the reset floor', t => {
    resetEpisodeState(t);
    Globals.searchCache.set('expired', { timestamp: Date.now() - 31 * 60000,
      details: [{ links: [{ id: 90000, url: 'https://old.invalid/episode' }] }] });
    assert.equal(getEpisodeIdFloor(), 10001);
    assert.equal(addEpisode('https://new.invalid/episode', 'new').id, 10002);
  });

  test('PR492 episode IDs: each anime batch scans references once and keeps existing mappings', t => {
    resetEpisodeState(t);
    let visits = 0;
    const existing = { get id() { visits++; return 20000; }, url: 'https://old.invalid/episode', title: 'old' };
    Globals.animes = [{ animeId: 1, links: [existing] }];
    const links = Array.from({ length: 100 }, (_, i) => ({ url: 'https://new.invalid/' + i, title: String(i) }));
    assert.equal(addAnime({ animeId: 2, animeTitle: 'new', links }), true);
    assert.ok(visits <= 4, 'the old detail is scanned once per batch, rather than once per new episode');
    assert.equal(Globals.episodeIds[0].id, 20001);
    assert.equal(Globals.episodeIds.at(-1).id, 20100);
    assert.equal(findUrlById(20000), 'https://old.invalid/episode');
  });

  test('PR492 episode IDs: failed batch retains the corrected floor and publishes no partial links', t => {
    resetEpisodeState(t);
    const floor = Number.MAX_SAFE_INTEGER - 2;
    Globals.favoriteCache.set('saved', { details: [{ links: [{ id: floor, url: 'https://old.invalid/episode' }] }] });
    const details = new Map();
    assert.equal(addAnime({ animeId: 2, animeTitle: 'new', links: [
      { url: 'https://new.invalid/1', title: '1' }, { url: 'https://new.invalid/2', title: '2' }
    ] }, details), false);
    assert.deepEqual(Globals.episodeIds, []);
    assert.deepEqual(Globals.animes, []);
    assert.equal(details.size, 0);
    assert.equal(Globals.episodeNum, floor);
    assert.match(details.__addAnimeError, /安全范围/);
    assert.equal(addEpisode('https://new.invalid/retry', 'retry').id, floor + 1);
    assert.equal(findUrlById(floor), 'https://old.invalid/episode');
  });

  test('PR492 Local Redis: serialize once, retain acknowledged hashes, and retry failed writes', () => {
    const redisModule = import.meta.resolve('redis');
    const localScript = `
      import assert from 'node:assert/strict';
      import { mock } from 'node:test';
      const base = ${JSON.stringify(base)};
      const { Globals: g } = await import(base + 'configs/globals.js');
      const { simpleHash } = await import(base + 'utils/codec-util.js');
      const values = new Map();
      const writes = [];
      let fail = false, pause = null;
      mock.module(${JSON.stringify(redisModule)}, { namedExports: { createClient: () => ({
        isReady: false, isOpen: false, on() {},
        async connect() { this.isReady = this.isOpen = true; },
        destroy() { this.isReady = this.isOpen = false; },
        async quit() { this.destroy(); },
        async get(key) { return values.get(key) ?? null; },
        async set(key, value) {
          writes.push([key, value]);
          if (fail) throw new Error('write failed');
          if (pause) { const waiting = pause; pause = null; waiting.started(); await waiting.promise; }
          values.set(key, value); return 'OK';
        }
      }) } });
      const local = await import(base + 'utils/local-redis-util.js');
      g.init({ LOCAL_REDIS_URL: 'redis://mock', LOCAL_CACHE_ENABLED: 'false', LOG_LEVEL: 'error' });
      g.queryCacheInitialized = true; g.queryCacheWritable.localRedis = true;
      let serializations = 0;
      g.animes = [{ toJSON() { serializations++; return { animeId: 1 }; } }];
      try {
        assert.equal(await local.updateLocalRedisCaches({ keys: ['animes'] }), true);
        assert.equal(serializations, 1, 'each selected key is serialized once per batch');
        assert.equal(writes.length, 1);
        assert.equal(g.localRedisHashes.animes, simpleHash(values.get('animes')));
        assert.equal(await local.updateLocalRedisCaches({ keys: ['animes'] }), true);
        assert.equal(writes.length, 1, 'unchanged data sends no SET');
        const savedHash = g.localRedisHashes.animes;
        g.animes = [{ animeId: 2 }]; fail = true;
        assert.equal(await local.updateLocalRedisCaches({ keys: ['animes'] }), false);
        assert.equal(g.localRedisHashes.animes, savedHash);
        fail = false;
        assert.equal(await local.updateLocalRedisCaches({ keys: ['animes'] }), true);
        assert.deepEqual(JSON.parse(values.get('animes')), [{ animeId: 2 }]);
        assert.equal(g.localRedisHashes.animes, simpleHash(values.get('animes')));
        const beforeForce = writes.length;
        assert.equal(await local.updateLocalRedisCaches({ keys: ['animes'], force: true }), true);
        assert.equal(writes.length, beforeForce + 1, 'force still writes unchanged values');
        let release, started;
        const promise = new Promise(resolve => { release = resolve; });
        const begun = new Promise(resolve => { started = resolve; });
        pause = { promise, started };
        g.animes = [{ animeId: 3 }];
        const saving = local.updateLocalRedisCaches({ keys: ['animes'] });
        await begun; g.animes = [{ animeId: 4 }]; release();
        assert.equal(await saving, true);
        assert.deepEqual(JSON.parse(values.get('animes')), [{ animeId: 3 }]);
        assert.equal(g.localRedisHashes.animes, simpleHash(values.get('animes')));
        assert.equal(await local.updateLocalRedisCaches({ keys: ['animes'] }), true);
        assert.deepEqual(JSON.parse(values.get('animes')), [{ animeId: 4 }]);
        assert.equal((await local.setLocalRedisKey('animes', [{ animeId: 5 }])).result, 'OK');
        assert.deepEqual(JSON.parse(values.get('animes')), [{ animeId: 5 }]);
      } finally { await local.closeLocalRedisConnection(); }
    `;
    const result = spawnSync(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', localScript], {
      encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024,
      env: { ...process.env, NODE_TEST_CONTEXT: '' }
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
const renrenSource = new RenrenSource();
  const hanjutvSource = new HanjutvSource();
  const bahamutSource = new BahamutSource();
  const tencentSource = new TencentSource();
  const iqiyiSource = new IqiyiSource();
  const mangoSource = new MangoSource();
  const bilibiliSource = new BilibiliSource();
  const youkuSource = new YoukuSource();
  const miguSource = new MiguSource();
  const sohuSource = new SohuSource();
  const leshiSource = new LeshiSource();
  const xiguaSource = new XiguaSource();
  const maiduiduiSource = new MaiduiduiSource();
  const aiyifanSource = new AiyifanSource();
  const hongguoSource = new HongguoSource();
  const animekoSource = new AnimekoSource();
  const otherSource = new OtherSource();


test('source registry preserves topology and enforces capability boundaries', async () => {
    assert.deepEqual(getInitializedSourceKeys(), []);
    assert.equal(getLogNameByKey('360'), '360kan');
    assert.equal(getLogNameByKey('imgo'), 'mango');
    assert.equal(getLogNameByKey('untrusted-source\nforged-log'), 'system');
    assert.deepEqual(getInitializedSourceKeys(), []);

    const metas = getAllSourceMetas();
    const keys = metas.map(meta => meta.key);
    assert.equal(keys.length, 24);
    assert.equal(new Set(keys).size, keys.length);
    assert.deepEqual(
      metas.filter(meta => meta.canSearch && meta.canHandle).map(meta => meta.key).sort(),
      [...Envs.ALLOWED_SOURCES].sort()
    );
    assert.deepEqual(
      metas.filter(meta => meta.canMerge).map(meta => meta.key).sort(),
      [...Envs.MERGE_ALLOWED_SOURCES].sort()
    );
    assert.deepEqual(
      metas.filter(meta => meta.canDirect).map(meta => meta.key).sort(),
      ['animeko', 'bahamut', 'custom', 'dandan', 'hanjutv', 'hongguo', 'local', 'renren'].sort()
    );

    const douban = getSourceByKey('douban');
    assert.equal(douban.tencentSource, getSourceByKey('tencent'));
    assert.equal(douban.iqiyiSource, getSourceByKey('iqiyi'));
    assert.equal(douban.youkuSource, getSourceByKey('youku'));
    assert.equal(douban.bilibiliSource, getSourceByKey('bilibili'));
    assert.equal(douban.miguSource, getSourceByKey('migu'));
    assert.equal(getSourceByKey('tmdb').doubanSource, douban);

    assert.equal(getSourceByKey('missing-source'), null);
    assert.equal(getSourceMetaByKey('other').canSearch, false);
    assert.deepEqual(
      getSourceMetaByKey('vod').buildSearchArgs('标题', 'anime-id', 'source-id'),
      ['标题', 'anime-id', 'source-id']
    );

    let customArgs;
    const isolatedDetailStore = new Map();
    await getSourceMetaByKey('custom').handleAdapter({
      handleAnimes(...args) {
        customArgs = args;
      },
    }, [], '标题', [], isolatedDetailStore, 2);
    assert.equal(customArgs[3], isolatedDetailStore);
    assert.equal(Object.isFrozen(getSourceMetaByKey('custom')), true);
  });

test('upstream source compatibility fixes preserve the fork runtime', async () => {
    assert.equal(Globals.VERSION, '1.21.6');

    let maiduiduiRequestUrl;
    const maiduiduiResults = await withMockFetch(async (url) => {
      maiduiduiRequestUrl = String(url);
      return mockJsonResponse({
        data: [{
          vodList: [
            { name: '兼容性测试剧', uuid: 'series-1', vodType: 0, downImage: 'https://example.com/series.jpg' },
            { name: '应过滤花絮', uuid: 'clip-1', vodType: 3 }
          ]
        }]
      }, maiduiduiRequestUrl);
    }, () => maiduiduiSource.search('兼容性测试剧'));

    assert.match(maiduiduiRequestUrl, /\/searchApi\/search\/getAllSearchResult\.action$/);
    assert.deepEqual(maiduiduiResults, [{
      name: '兼容性测试剧',
      type: '剧集',
      year: null,
      img: 'https://example.com/series.jpg',
      url: 'series-1'
    }]);

    const sohuVideoItem = sohuSource.filterSohuSearchItem({
      vid: '123456',
      video_name: '<<<兼容性测试剧>>>',
      meta: ['电视剧 | 内地 | 2026年'],
      poster: 'https://example.com/sohu.jpg'
    }, '兼容性测试剧');
    assert.equal(sohuVideoItem.mediaId, '123456');
    assert.equal(sohuVideoItem.title, '兼容性测试剧');
    assert.equal(sohuVideoItem.type, '电视剧');
    assert.equal(sohuVideoItem.year, '2026');
    assert.equal(sohuVideoItem.imageUrl, 'https://example.com/sohu.jpg');

    let sohuSearchUrl;
    let sohuSearchHeaders;
    await withMockFetch(async (url, options) => {
      sohuSearchUrl = String(url);
      sohuSearchHeaders = options.headers;
      return mockJsonResponse({ data: { items: [] } }, sohuSearchUrl);
    }, () => sohuSource.search('兼容性测试剧'));
    const signedSearchUrl = new URL(sohuSearchUrl);
    assert.match(signedSearchUrl.searchParams.get('fpc'), /^[0-9a-f]{32}$/);
    assert.match(signedSearchUrl.searchParams.get('code'), /^[0-9a-f]{32}$/);
    assert.match(signedSearchUrl.searchParams.get('timeStamp'), /^\d+$/);
    assert.equal(sohuSearchHeaders.Origin, 'https://tv.sohu.com');

    assert.deepEqual(
      await sohuSource.extractVidAndAid('https://tv.sohu.com/play?vid=123456&aid=654321'),
      { vid: '123456', aid: '654321' }
    );

    const gbkResponse = await withMockFetch(async (url) => ({
      ok: true,
      status: 200,
      url: String(url),
      headers: new Headers({ 'content-type': 'text/plain' }),
      arrayBuffer: async () => Uint8Array.from([0xb2, 0xe2, 0xca, 0xd4]).buffer
    }), () => httpGet('https://example.com/gbk', { encoding: 'gbk' }));
    assert.equal(gbkResponse.data, '测试');
  });

test('episode matching prefers main content while preserving platform candidates', () => {
    const perfectWorldEpisodes = [
      { episodeNumber: 281, episodeTitle: '【bilibili】第281集', episodeId: 'main-281' },
      { episodeNumber: 282, episodeTitle: '【bilibili】第282集出场人物表', episodeId: 'characters-282' },
      { episodeNumber: 283, episodeTitle: '【bilibili】第282集', episodeId: 'main-282' }
    ];
    assert.equal(findEpisodeByNumber(perfectWorldEpisodes, 282, 282).episodeId, 'main-282');

    const insertedSupplementEpisodes = [
      { episodeNumber: 1, episodeTitle: '【qq】第1集', episodeId: 'main-1' },
      { episodeNumber: 2, episodeTitle: '【qq】角色关系图', episodeId: 'relation-chart' },
      { episodeNumber: 3, episodeTitle: '【qq】第2集', episodeId: 'main-2' }
    ];
    assert.equal(findEpisodeByNumber(insertedSupplementEpisodes, 2, 2).episodeId, 'main-2');

    const reversedEpisodes = [
      { episodeNumber: 1, episodeTitle: '【bilibili】第12集', episodeId: 'main-12' },
      { episodeNumber: 2, episodeTitle: '【bilibili】第11集', episodeId: 'main-11' }
    ];
    assert.equal(findEpisodeByNumber(reversedEpisodes, 11, 11).episodeId, 'main-11');

    const titlelessEpisodes = [
      { episodeNumber: 1, episodeTitle: '【other】上篇', episodeId: 'part-1' },
      { episodeNumber: 2, episodeTitle: '【other】下篇', episodeId: 'part-2' }
    ];
    assert.equal(findEpisodeByNumber(titlelessEpisodes, 2, 2).episodeId, 'part-2');
    assert.equal(findEpisodeByNumber(reversedEpisodes, 1, 2).episodeId, 'main-11');

    const platformVariants = [
      { episodeNumber: 1, episodeTitle: '【qq】第1集', episodeId: 'qq-1' },
      { episodeNumber: 2, episodeTitle: '【bilibili】第1集', episodeId: 'bilibili-1' }
    ];
    assert.equal(filterSameEpisodeTitle(platformVariants).length, 1);
    const selectable = filterSameEpisodeTitle(platformVariants, { dedupeByEpisodeNumber: false });
    assert.equal(selectable.length, 2);
    assert.equal(findEpisodeByNumber(selectable, 1, 1, 'bilibili1').episodeId, 'bilibili-1');

    const defaultConfig = Globals.init({ LOG_LEVEL: 'error' });
    assert.equal(defaultConfig.episodeTitleFilter.test('【bilibili】第282集出场人物表'), true);
    assert.equal(defaultConfig.episodeTitleFilter.test('【bilibili】第282集 完美世界'), false);
  });

test('S01E01 prefers a multi-episode series over a same-title movie in normal and AI matching', async () => {
    const originalSearch = TencentSource.prototype.search;
    const originalHandleAnimes = TencentSource.prototype.handleAnimes;
    const originalAiAsk = AIClient.prototype.ask;
    const movie = createFavoriteAnime('同名作品(2026)【电影】from tencent', 1, 940001);
    movie.type = '电影';
    movie.typeDescription = '电影';
    const series = createFavoriteAnime('同名作品(2026)【电视剧】from tencent', 3, 940002);

    TencentSource.prototype.search = async () => [{}, {}];
    TencentSource.prototype.handleAnimes = async (_source, _title, results, details) => {
      results.push(movie, series);
      details.set(String(movie.animeId), movie);
      details.set(String(series.animeId), series);
    };
    AIClient.prototype.ask = async () => JSON.stringify({ animeIndex: 0 });

    const runMatch = async (aiEnabled, title = '同名作品') => {
      resetSearchState();
      Globals.init({ SOURCE_ORDER: 'tencent', LOG_LEVEL: 'error' });
      Globals.aiValid = aiEnabled;
      Globals.envs.aiMatchPrompt = aiEnabled ? '选择最匹配的候选' : '';
      const request = new Request('http://localhost/api/v2/match', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: `${title} S01E01` })
      });
      return parseResponse(await matchAnime(new URL(request.url), request, '127.0.0.1'));
    };

    try {
      const normalBody = await runMatch(false);
      assert.equal(normalBody.matches[0].animeId, series.animeId);
      assert.equal(normalBody.matches[0].episodeId, series.links[0].id);

      const aiBody = await runMatch(true);
      assert.equal(aiBody.matches[0].animeId, series.animeId);
      assert.equal(aiBody.matches[0].episodeId, series.links[0].id);

      // 上游统一繁简后，下游“剧集优先”判断也必须使用相同归一化。
      movie.animeTitle = '同名剧集(2026)【电影】from tencent';
      series.animeTitle = '同名劇集(2026)【电视剧】from tencent';
      for (const aiEnabled of [false, true]) {
        const body = await runMatch(aiEnabled, '同名剧集');
        assert.equal(body.matches[0].animeId, series.animeId);
        assert.equal(body.matches[0].episodeId, series.links[0].id);
      }
    } finally {
      TencentSource.prototype.search = originalSearch;
      TencentSource.prototype.handleAnimes = originalHandleAnimes;
      AIClient.prototype.ask = originalAiAsk;
      resetSearchState();
    }
  });

test('unrelated multi-episode results do not suppress the correct single-episode match', async () => {
    const originalSearch = TencentSource.prototype.search;
    const originalHandleAnimes = TencentSource.prototype.handleAnimes;
    const originalAiAsk = AIClient.prototype.ask;
    const single = createFavoriteAnime('正确单集作品(2026)【电影】from tencent', 1, 940005);
    single.type = '电影';
    single.typeDescription = '电影';
    const unrelatedSeries = createFavoriteAnime('无关连续剧(2026)【电视剧】from tencent', 3, 940006);

    TencentSource.prototype.search = async () => [{}, {}];
    TencentSource.prototype.handleAnimes = async (_source, _title, results, details) => {
      results.push(single, unrelatedSeries);
      details.set(String(single.animeId), single);
      details.set(String(unrelatedSeries.animeId), unrelatedSeries);
    };
    AIClient.prototype.ask = async () => JSON.stringify({ animeIndex: 0 });

    const runMatch = async (aiEnabled) => {
      resetSearchState();
      Globals.init({ SOURCE_ORDER: 'tencent', LOG_LEVEL: 'error' });
      Globals.aiValid = aiEnabled;
      Globals.envs.aiMatchPrompt = aiEnabled ? '选择最匹配的候选' : '';
      const request = new Request('http://localhost/api/v2/match', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: '正确单集作品 S01E01' })
      });
      return parseResponse(await matchAnime(new URL(request.url), request, '127.0.0.1'));
    };

    try {
      assert.equal((await runMatch(false)).matches[0].animeId, single.animeId);
      assert.equal((await runMatch(true)).matches[0].animeId, single.animeId);
    } finally {
      TencentSource.prototype.search = originalSearch;
      TencentSource.prototype.handleAnimes = originalHandleAnimes;
      AIClient.prototype.ask = originalAiAsk;
      resetSearchState();
    }
  });

test('source-prefixed IDs and link offsets are normalized before source requests', async () => {
    assert.deepEqual(
      resolveSourceAndRealId('https://bangumi.pro/ep/123@%50'),
      { source: 'animeko', realId: '123@%50' }
    );
    assert.deepEqual(
      resolveSourceAndRealId('https://ani.gamer.com.tw/animeVideo.php?sn=50709@-5'),
      { source: 'bahamut', realId: '50709@-5' }
    );

    resetSearchState();
    Globals.init({ LOG_LEVEL: 'error', COMMENT_CACHE_MIN_COUNT: '1' });
    const originalBahamutGetComments = BahamutSource.prototype.getComments;
    const originalHongguoGetComments = HongguoSource.prototype.getComments;
    let requestedId = null;
    let requestedHongguoId = null;
    BahamutSource.prototype.getComments = async id => {
      requestedId = id;
      return [{ p: '1,1,16777215,bahamut', m: 'prefix test' }];
    };
    HongguoSource.prototype.getComments = async id => {
      requestedHongguoId = id;
      return [{ p: '1,1,16777215,hongguo', m: 'structured id test' }];
    };
    try {
      const anime = createFavoriteAnime('前缀测试', 1, 940003);
      anime.source = 'bahamut';
      anime.links[0].url = 'bahamut:50709';
      anime.links[0].title = '【bahamut】 第1集';
      addAnime(anime);
      const commentId = Globals.episodeIds.at(-1).id;
      const response = await getComment(`/api/v2/comment/${commentId}`, 'json', false, '127.0.0.1');
      const body = await parseResponse(response);
      assert.equal(response.status, 200);
      assert.equal(body.count, 1);
      assert.equal(requestedId, '50709');

      const hongguoAnime = createFavoriteAnime('红果结构化 ID 测试', 1, 940004);
      hongguoAnime.source = 'hongguo';
      hongguoAnime.links[0].url = 'hongguo:v1:series-1:vid-1:60';
      hongguoAnime.links[0].title = '【hongguo】 第1集';
      addAnime(hongguoAnime);
      const hongguoCommentId = Globals.episodeIds.at(-1).id;
      const hongguoResponse = await getComment(`/api/v2/comment/${hongguoCommentId}`, 'json', false, '127.0.0.1');
      const hongguoBody = await parseResponse(hongguoResponse);
      assert.equal(hongguoResponse.status, 200);
      assert.equal(hongguoBody.count, 1);
      assert.equal(requestedHongguoId, 'hongguo:v1:series-1:vid-1:60');
    } finally {
      BahamutSource.prototype.getComments = originalBahamutGetComments;
      HongguoSource.prototype.getComments = originalHongguoGetComments;
      resetSearchState();
    }
  });

test('reliability defaults use mainstream sources, preserve fallback order, and cache small results', () => {
    const config = Globals.init({
      LOG_LEVEL: 'error',
      COMMENT_CACHE_MIN_COUNT: '1',
      COMMENT_CACHE_MINUTES: '3'
    });
    Globals.commentCache = new Map();

    assert.deepEqual(config.sourceOrderArr, ['tencent', 'iqiyi', 'youku', 'imgo', 'bilibili', 'migu']);
    assert.equal(config.youkuConcurrency, 16);
    assert.equal(config.tencentDanmuDeadlineMs, 8000);
    assert.equal(config.commentCacheMinCount, 1);
    assert.deepEqual(
      resolveSearchFallbackSources(
        ['douban', '360', 'renren', 'hanjutv'],
        ['tencent', 'iqiyi', 'youku', 'imgo', 'bilibili', 'migu', '360', 'douban', 'douban']
      ),
      ['tencent', 'iqiyi', 'youku', 'imgo', 'bilibili', 'migu']
    );

    const comments = Array.from({ length: 51 }, (_, index) => ({ m: `comment-${index}` }));
    setCommentCache('migu:test-small-result', comments);
    assert.equal(getCommentCache('migu:test-small-result')?.length, 51);

    resetSearchState();
  });

test('tencent danmu segment deadline returns completed shards without waiting for slow shards', async () => {
    const segments = [
      { url: 'https://dm.video.qq.com/fast' },
      { url: 'https://dm.video.qq.com/slow' }
    ];
    const request = async (url, options) => {
      if (url.endsWith('/fast')) {
        return { data: { barrage_list: [{ content: 'fast shard' }] } };
      }
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    };
    const startedAt = Date.now();

    const result = await fetchTencentDanmuSegments(segments, {
      request,
      deadlineMs: 30,
    });

    assert.equal(result.timedOut, true);
    assert.equal(result.total, 2);
    assert.equal(result.results.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(result.results.find(item => item.status === 'fulfilled').value.data.barrage_list[0].content, 'fast shard');
    assert.ok(Date.now() - startedAt < 250, '整体截止时间不应继续等待慢分片');
  });

test('tencent danmu segment fetch keeps complete results when all shards finish in time', async () => {
    const segments = [
      { url: 'https://dm.video.qq.com/1' },
      { url: 'https://dm.video.qq.com/2' }
    ];
    const result = await fetchTencentDanmuSegments(segments, {
      request: async url => ({ data: { barrage_list: [{ content: url }] } }),
      deadlineMs: 100,
    });

    assert.equal(result.timedOut, false);
    assert.equal(result.total, 2);
    assert.equal(result.results.filter(item => item.status === 'fulfilled').length, 2);
  });

test('search executes configured fallback only after primary sources return no candidates', async () => {
    const originalTencentSearch = TencentSource.prototype.search;
    const originalTencentHandle = TencentSource.prototype.handleAnimes;
    const originalIqiyiSearch = IqiyiSource.prototype.search;
    const originalIqiyiHandle = IqiyiSource.prototype.handleAnimes;
    const calls = [];

    TencentSource.prototype.search = async () => {
      calls.push('tencent');
      return [];
    };
    TencentSource.prototype.handleAnimes = async () => {};
    IqiyiSource.prototype.search = async () => {
      calls.push('iqiyi');
      return [{ title: '兜底测试' }];
    };
    IqiyiSource.prototype.handleAnimes = async (_source, _title, results, details) => {
      const anime = createFavoriteAnime('兜底测试', 1, 930100);
      anime.source = 'iqiyi';
      anime.links.forEach(link => { link.title = link.title.replace('【qq】', '【qiyi】'); });
      results.push(anime);
      details.set(String(anime.animeId), anime);
    };

    try {
      resetSearchState();
      Globals.init({
        SOURCE_ORDER: 'tencent',
        SOURCE_FALLBACK_ORDER: 'iqiyi',
        LOG_LEVEL: 'error'
      });
      const response = await searchAnime(new URL('http://localhost/api/v2/search/anime?keyword=%E5%85%9C%E5%BA%95%E6%B5%8B%E8%AF%95'));
      const body = await parseResponse(response);

      assert.deepEqual(calls, ['tencent', 'iqiyi']);
      assert.equal(body.animes.length, 1);
      assert.equal(body.animes[0].source, 'iqiyi');
    } finally {
      TencentSource.prototype.search = originalTencentSearch;
      TencentSource.prototype.handleAnimes = originalTencentHandle;
      IqiyiSource.prototype.search = originalIqiyiSearch;
      IqiyiSource.prototype.handleAnimes = originalIqiyiHandle;
      resetSearchState();
    }
  });

test('a synchronous source handler failure does not discard healthy source results', async () => {
    const originalTencentSearch = TencentSource.prototype.search;
    const originalTencentHandle = TencentSource.prototype.handleAnimes;
    const originalIqiyiSearch = IqiyiSource.prototype.search;
    const originalIqiyiHandle = IqiyiSource.prototype.handleAnimes;

    TencentSource.prototype.search = async () => [{ title: '故障隔离测试' }];
    TencentSource.prototype.handleAnimes = () => {
      throw new Error('expected synchronous handler failure');
    };
    IqiyiSource.prototype.search = async () => [{ title: '故障隔离测试' }];
    IqiyiSource.prototype.handleAnimes = async (_source, _title, results, details) => {
      const anime = createFavoriteAnime('故障隔离测试', 1, 930101);
      anime.source = 'iqiyi';
      anime.links.forEach(link => { link.title = link.title.replace('【qq】', '【qiyi】'); });
      results.push(anime);
      details.set(String(anime.animeId), anime);
    };

    try {
      resetSearchState();
      Globals.init({
        SOURCE_ORDER: 'tencent,iqiyi',
        SOURCE_FALLBACK_ORDER: '',
        LOG_LEVEL: 'error'
      });
      const response = await searchAnime(new URL('http://localhost/api/v2/search/anime?keyword=%E6%95%85%E9%9A%9C%E9%9A%94%E7%A6%BB%E6%B5%8B%E8%AF%95'));
      const body = await parseResponse(response);

      assert.equal(body.animes.length, 1);
      assert.equal(body.animes[0].source, 'iqiyi');
    } finally {
      TencentSource.prototype.search = originalTencentSearch;
      TencentSource.prototype.handleAnimes = originalTencentHandle;
      IqiyiSource.prototype.search = originalIqiyiSearch;
      IqiyiSource.prototype.handleAnimes = originalIqiyiHandle;
      resetSearchState();
    }
  });

test('Youku worker pool caps concurrency, preserves order, and isolates failures', async () => {
    let active = 0;
    let maxActive = 0;
    const settled = await mapWithConcurrency([25, 5, 10, 1], 2, async (delay, index) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, delay));
      active--;
      if (index === 2) throw new Error('expected segment failure');
      return index;
    });

    assert.equal(maxActive, 2);
    assert.deepEqual(settled.map(result => result.status), ['fulfilled', 'fulfilled', 'rejected', 'fulfilled']);
    assert.equal(settled[0].value, 0);
    assert.equal(settled[3].value, 3);
  });

test('sensitive signed request URLs are redacted from runtime logs', async () => {
    Globals.init({ LOG_LEVEL: 'info' });
    Globals.logBuffer = [];

    await withMockFetch(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ success: true })
    }), async () => {
      await httpPost('https://example.com/comments?sign=temporary-secret&t=123', '', { redactUrl: true });
    });

    const messages = Globals.logBuffer.map(entry => entry.message).join('\n');
    assert.match(messages, /comments\?\[redacted\]/);
    assert.doesNotMatch(messages, /temporary-secret/);
    resetSearchState();
  });

test('Hongguo keeps complete app details and uses a bounded web fallback', async () => {
    assert.equal(HONGGUO_WEB_TIMEOUT_MS, 5000);
    const searchItems = [{
      keyword: 'series-1',
      video_data: {
        series_id: 'series-1',
        series_name: '网页短剧「测试」',
        episode_cnt: 2,
        create_time: 1767225600,
        series_cover: { url_list: ['https://example.com/cover.jpg'] }
      }
    }];
    const searchHtml = `<script>window.__DATA__={"searchList":${JSON.stringify(searchItems)},"tail":"[]"}</script>`;
    const detailData = {
      vid_list: ['vid-1', 'vid-2'],
      create_time: 1767225600,
      series_cover: { url_list: ['https://example.com/detail.jpg'] }
    };
    const detailHtml = `<script>window.__DATA__={"seriesDetail":${JSON.stringify(detailData)},"tail":"{}"}</script>`;
    assert.equal(parseWebSearchResults(searchHtml)[0].video_data.series_id, 'series-1');
    assert.deepEqual(parseWebSeriesDetail(detailHtml).vid_list, ['vid-1', 'vid-2']);
    assert.deepEqual(
      parseHongguoPlayerUrl('hongguo:v1:series-1:vid-2:88'),
      { seriesId: 'series-1', vid: 'vid-2' }
    );

    const responseSource = new HongguoSource();
    const cooldownError = responseSource.checkResponse({
      code: 100,
      message: JSON.stringify({ min_ban_time: 2, max_ban_time: 5 })
    });
    assert.equal(cooldownError.coolDownMs, 5000, '应遵守较长的服务端风控冷却时间');

    const limiterSource = new HongguoSource();
    const releases = [
      await limiterSource.acquireCommentSlot(),
      await limiterSource.acquireCommentSlot(),
      await limiterSource.acquireCommentSlot()
    ];
    let fourthSlotResolved = false;
    const fourthSlotPromise = limiterSource.acquireCommentSlot().then(release => {
      fourthSlotResolved = true;
      return release;
    });
    await Promise.resolve();
    assert.equal(fourthSlotResolved, false, '红果弹幕并发应限制为 3');
    releases.shift()();
    const fourthRelease = await fourthSlotPromise;
    assert.equal(fourthSlotResolved, true);
    releases.forEach(release => release());
    fourthRelease();

    const webSource = new HongguoSource();
    webSource.request = async () => { throw new Error('web search should avoid app fallback'); };
    const webResults = await withMockFetch(
      url => Promise.resolve(mockHtmlResponse(searchHtml, url)),
      () => webSource.search('网页短剧')
    );
    assert.equal(webResults.length, 1);
    assert.equal(webResults[0].seriesId, 'series-1');

    const apiSource = new HongguoSource();
    apiSource.request = async () => ({
      data: {
        'series-1': {
          video_data: {
            create_time: 1767225600,
            video_list: [
              { vid_index: 1, vid: 'vid-1', duration: 95, episode_title: '第一集' },
              { vid_index: 2, vid: 'vid-2', duration: 88, episode_title: '第二集' }
            ]
          }
        }
      }
    });
    const apiDetails = await apiSource.getEpisodes('series-1');
    assert.deepEqual(apiDetails.episodes.map(item => item.duration), [95, 88]);

    const fallbackSource = new HongguoSource();
    fallbackSource.request = async () => { throw new Error('app detail unavailable'); };
    const fallbackDetails = await withMockFetch(
      url => Promise.resolve(mockHtmlResponse(detailHtml, url)),
      () => fallbackSource.getEpisodes('series-1')
    );
    assert.deepEqual(fallbackDetails.episodes.map(item => item.vid), ['vid-1', 'vid-2']);

    const richDetailData = {
      ...detailData,
      vid_list: [
        { vid: 'vid-1', episode_title: '第一集', duration: 42 },
        { video_id: 'vid-2', title: '第二集', video_duration: 45 }
      ]
    };
    const richDetailHtml = `<script>window.__DATA__={"seriesDetail":${JSON.stringify(richDetailData)},"tail":"{}"}</script>`;
    const richFallbackSource = new HongguoSource();
    richFallbackSource.request = async () => { throw new Error('app detail unavailable'); };
    const richFallbackDetails = await withMockFetch(
      url => Promise.resolve(mockHtmlResponse(richDetailHtml, url)),
      () => richFallbackSource.getEpisodes('series-1')
    );
    assert.deepEqual(richFallbackDetails.episodes.map(item => item.duration), [42, 45]);

    let windowCalls = 0;
    fallbackSource.fetchCommentWindow = async (_info, startMs) => {
      windowCalls++;
      return {
        comments: [{ commentId: `c-${windowCalls}`, offsetMs: startMs + 1000, text: `弹幕${windowCalls}`, diggCount: 0 }],
        nextStart: startMs + 30000,
        cursor: String(windowCalls),
        hasMore: windowCalls < 2
      };
    };
    const unknownDurationComments = await fallbackSource.getDanmuForEpisode({ seriesId: 'series-1', vid: 'vid-1', duration: 0 });
    assert.equal(windowCalls, 2);
    assert.equal(unknownDurationComments.length, 2);

    const mergeSource = new HongguoSource();
    mergeSource.getEpisodes = async () => ({
      episodes: [
        { vid: 'vid-1', duration: 0 },
        { vid: 'vid-2', duration: 0 }
      ]
    });
    mergeSource.fetchDanmuForEpisode = async info => ({
      comments: [{ commentId: info.vid, offsetMs: 1000, text: info.vid, diggCount: 0 }],
      durationMs: 30000
    });
    const merged = await mergeSource.getSeriesDanmu('series-1');
    assert.deepEqual(merged.map(item => item.offsetMs), [1000, 31000]);
  });

test('direct URL offsets use clean source URLs and return the shifted duration', async () => {
    resetSearchState();
    Globals.init({ LOG_LEVEL: 'error', COMMENT_CACHE_MIN_COUNT: '1' });
    Globals.commentCache = new Map();
    const originalTencentGetComments = TencentSource.prototype.getComments;
    const requestedUrls = [];
    TencentSource.prototype.getComments = async (url, _platform, segmentFlag) => {
      requestedUrls.push(url);
      if (segmentFlag) return { duration: 20, segmentList: [] };
      return [
        { p: '10,1,16777215,qq', m: 'offset-1' },
        { p: '20,1,16777215,qq', m: 'offset-2' }
      ];
    };
    try {
      const response = await getCommentByUrl('https://v.qq.com/x/cover/test/ep1.html@5', 'json', false, true);
      const body = await parseResponse(response);
      assert.equal(body.videoDuration, 25);
      assert.deepEqual(body.comments.map(item => item.p), [
        '15.00,1,16777215,qq',
        '25.00,1,16777215,qq'
      ]);
      assert.ok(requestedUrls.every(url => url === 'https://v.qq.com/x/cover/test/ep1.html'));
    } finally {
      TencentSource.prototype.getComments = originalTencentGetComments;
      resetSearchState();
    }
  });

test('auto match mapping table', async t => {
    await t.test('falls back when Unicode property escapes are unavailable', async () => {
      const NativeRegExp = globalThis.RegExp;
      globalThis.RegExp = function (pattern, flags) {
        if (String(pattern).includes('\\p{')) throw new SyntaxError('Unicode property escapes are unavailable');
        return new NativeRegExp(pattern, flags);
      };

      try {
        const compat = await import('./utils/auto-match-mapping-util.js?unicode-properties=unavailable');
        const { rules, warnings } = compat.parseAutoMatchMappingRules('進撃の巨人 S01E01->ＳＰＹ×ＦＡＭＩＬＹ S01E03');

        assert.deepEqual(warnings, []);
        assert.equal(compat.resolveAutoMatchMapping(rules, { title: '進撃の 巨人！', season: 1, episode: 2 }).targetEpisode, 4);
        assert.equal(compat.candidateMatchesMappingTitle({ animeTitle: 'SPY FAMILY' }, rules[0]), true);
      } finally {
        globalThis.RegExp = NativeRegExp;
      }
    });

    await t.test('parses and resolves open, bounded, qualified, and platform rules', () => {
      const { rules, warnings } = parseAutoMatchMappingRules([
        '永生 S05E02->永生 S01E58',
        '永生 S05E02~03->永生 S01E58~59',
        '海贼王 S2E1->航海王(1999)【动漫】 S1E62',
        '航海王 S1E1->航海王 S1E1 @qiyi'
      ].join(';'), Globals.envs.allowedPlatforms);

      assert.deepEqual(warnings, []);
      assert.equal(rules.length, 4);
      assert.equal(resolveAutoMatchMapping(rules, { title: '永生', season: 5, episode: 2 }).bounded, true);
      assert.equal(resolveAutoMatchMapping(rules, { title: '永生', season: 5, episode: 3 }).targetEpisode, 59);
      assert.equal(resolveAutoMatchMapping(rules, { title: '永生', season: 5, episode: 4 }).targetEpisode, 60);
      assert.equal(resolveAutoMatchMapping(rules, { title: '永生', season: 6, episode: 1 }), null);

      const qualified = rules[2];
      assert.equal(qualified.targetTitle, '航海王');
      assert.equal(qualified.targetYear, 1999);
      assert.equal(qualified.targetType, '动漫');
      assert.equal(rules[3].targetPlatform, 'qiyi');
      assert.equal(candidateMatchesMappingQualifiers({
        animeTitle: '航海王(1999)【动漫】from tencent',
        typeDescription: '动漫',
        startDate: '1999-10-20T00:00:00.000Z'
      }, qualified), true);
      assert.equal(candidateMatchesMappingQualifiers({
        animeTitle: '航海王(2000)【动漫】from tencent',
        typeDescription: '动漫',
        startDate: '2000-01-01T00:00:00.000Z'
      }, qualified), false);
      assert.equal(candidateMatchesMappingTitle({ animeTitle: '航海王 第二季(1999)【动漫】from tencent' }, qualified), true);
      assert.equal(candidateMatchesMappingTitle({ animeTitle: '海贼王(1999)【动漫】from tencent' }, qualified), false);

      const boundedOnly = parseAutoMatchMappingRules('永生 S05E02~03->永生 S01E58~59').rules;
      assert.equal(resolveAutoMatchMapping(boundedOnly, { title: '永生', season: 5, episode: 3 }).targetEpisode, 59);
      assert.equal(resolveAutoMatchMapping(boundedOnly, { title: '永生', season: 5, episode: 4 }), null);

      const narutoRule = parseAutoMatchMappingRules('火影忍者 S01E57->火影忍者 疾风传(2007)【日番】 S01E59').rules[0];
      assert.equal(resolveAutoMatchMapping([narutoRule], { title: '火影忍者', season: 1, episode: 57 }).targetEpisode, 59);
      assert.equal(resolveAutoMatchMapping([narutoRule], { title: '火影忍者', season: 1, episode: 58 }).targetEpisode, 60);
      assert.equal(candidateMatchesMappingQualifiers({
        animeTitle: '火影忍者疾风传(2007)【动漫】from 360',
        typeDescription: '动漫',
        startDate: '2007-02-15T00:00:00.000Z'
      }, narutoRule), true);
    });

    await t.test('rejects invalid ranges and keeps declaration order for equal specificity', () => {
      const parsed = parseAutoMatchMappingRules([
        '测试 S01E02~04->测试 S01E10~11',
        '测试 S01E02~03->测试 S01E20~21',
        '测试 S01E02~03->测试 S01E30~31'
      ].join(';'));
      assert.equal(parsed.warnings.length, 1);
      assert.equal(parsed.rules.length, 2);
      assert.equal(resolveAutoMatchMapping(parsed.rules, { title: '测试', season: 1, episode: 2 }).targetEpisode, 20);
    });

    await t.test('uses the latest open-rule transition for repeated source title and season', () => {
      const parsed = parseAutoMatchMappingRules([
        '一念永恒 S01E53->一念永恒 S02E01',
        '一念永恒 S01E107->一念永恒 S03E01',
        '一念永恒 S01E166->一念永恒 完结季 S01E01'
      ].join(';'));

      assert.equal(resolveAutoMatchMapping(parsed.rules, { title: '一念永恒', season: 1, episode: 52 }), null);
      assert.equal(resolveAutoMatchMapping(parsed.rules, { title: '一念永恒', season: 1, episode: 53 }).targetSeason, 2);
      assert.equal(resolveAutoMatchMapping(parsed.rules, { title: '一念永恒', season: 1, episode: 106 }).targetEpisode, 54);
      assert.equal(resolveAutoMatchMapping(parsed.rules, { title: '一念永恒', season: 1, episode: 107 }).targetSeason, 3);
      assert.equal(resolveAutoMatchMapping(parsed.rules, { title: '一念永恒', season: 1, episode: 165 }).targetEpisode, 59);
      assert.equal(resolveAutoMatchMapping(parsed.rules, { title: '一念永恒', season: 1, episode: 166 }).targetTitle, '一念永恒 完结季');
    });

    await t.test('maps match input, honors qualifiers and manual season preference, then falls back to original', async () => {
      const originalSearch = TencentSource.prototype.search;
      const originalHandleAnimes = TencentSource.prototype.handleAnimes;
      const originalGetComments = TencentSource.prototype.getComments;
      const originalAiAsk = AIClient.prototype.ask;
      const originalOrder = Globals.envs.sourceOrderArr;
      const originalFallbackOrder = Globals.envs.sourceFallbackOrderArr;
      const originalAiValid = Globals.aiValid;
      let searchKeywords = [];
      let aiMatchInput = null;
      let scenario = 'open';

      TencentSource.prototype.search = async keyword => {
        searchKeywords.push(keyword);
        return [{ keyword }];
      };
      TencentSource.prototype.handleAnimes = async (_source, title, results, details) => {
        const add = anime => {
          results.push(anime);
          details.set(String(anime.animeId), anime);
        };
        if (scenario === 'fallback' && title === '缺失目标') return;
        if (scenario === 'qualified' && title === '航海王') {
          add(createFavoriteAnime('无关动漫(1999)【动漫】from tencent', 70, 930000));
          add(createFavoriteAnime('航海王(2000)【动漫】from tencent', 70, 930001));
          add(createFavoriteAnime('航海王(1999)【动漫】from tencent', 70, 930002));
          return;
        }
        if (scenario === 'platform') {
          const qqAnime = createFavoriteAnime(title, 2, 930004);
          const qiyiAnime = createFavoriteAnime(title, 2, 930005);
          qiyiAnime.source = 'iqiyi';
          qiyiAnime.links.forEach(link => { link.title = link.title.replace('【qq】', '【qiyi】'); });
          add(qqAnime);
          add(qiyiAnime);
          return;
        }
        if (scenario === 'naruto') {
          if (title === '火影忍者 疾风传') {
            add(createFavoriteAnime('火影忍者疾风传(2007)【动漫】from 360', 70, 930006));
          } else {
            add(createFavoriteAnime('火影忍者(2002)【动漫】from 360', 70, 930007));
          }
          return;
        }
        add(createFavoriteAnime(title, 70, 930003));
      };
      TencentSource.prototype.getComments = async () => [{ p: '1,1,16777215,test', m: 'mapping-test' }];
      Globals.envs.sourceOrderArr = ['tencent'];
      Globals.envs.sourceFallbackOrderArr = [];

      const runMatch = async (env, fileName, useAi = false) => {
        resetFavoriteState(env);
        Globals.envs.sourceOrderArr = ['tencent'];
        Globals.envs.sourceFallbackOrderArr = [];
        Globals.aiValid = useAi;
        const request = new Request('http://localhost/api/v2/match', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fileName })
        });
        return parseResponse(await matchAnime(new URL(request.url), request, '127.0.0.1'));
      };

      try {
        searchKeywords = [];
        scenario = 'open';
        let body = await runMatch({ AUTO_MATCH_MAPPING_TABLE: '永生 S05E02->永生 S01E58' }, '永生 S05E03');
        assert.equal(body.matches[0].episodeId, 9300030 + 59);
        assert.deepEqual(searchKeywords, ['永生']);
        await getComment(`/api/v2/comment/${body.matches[0].episodeId}`, 'json', false, '127.0.0.1');
        assert.equal(hasSeasonSpecificPreference('永生', 5), false);
        await getComment(`/api/v2/comment/${9300030 + 60}`, 'json', false, '127.0.0.1');
        assert.equal(hasSeasonSpecificPreference('永生', 5), true);
        assert.match(Globals.lastSelectMap.get('永生').offsets['5'], /^3:/);

        body = await runMatch({ AUTO_MATCH_MAPPING_TABLE: '永生 S05E02->永生 S01E58' }, '永生 S06E01');
        assert.equal(body.matches[0].episodeId, 9300030 + 1);
        await getComment(`/api/v2/comment/${body.matches[0].episodeId}`, 'json', false, '127.0.0.1');
        assert.equal(hasSeasonSpecificPreference('永生', 6), false);

        resetFavoriteState({ AUTO_MATCH_MAPPING_TABLE: '永生 S05E02->永生 S01E58' });
        Globals.envs.sourceOrderArr = ['tencent'];
        Globals.lastSelectMap.set('永生', {
          animeIds: [930003],
          preferBySeason: { default: 930003 },
          sourceBySeason: { default: 'tencent' }
        });
        const defaultPreferenceRequest = new Request('http://localhost/api/v2/match', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fileName: '永生 S05E03' })
        });
        body = await parseResponse(await matchAnime(new URL(defaultPreferenceRequest.url), defaultPreferenceRequest, '127.0.0.1'));
        assert.equal(body.matches[0].episodeId, 9300030 + 59);

        AIClient.prototype.ask = async prompt => {
          aiMatchInput = JSON.parse(prompt);
          return JSON.stringify({ animeIndex: 0 });
        };
        body = await runMatch({ AUTO_MATCH_MAPPING_TABLE: '永生 S05E02->永生 S01E58' }, '永生 S05E03', true);
        assert.equal(body.matches[0].episodeId, 9300030 + 59);
        assert.deepEqual(
          { title: aiMatchInput.title, season: aiMatchInput.season, episode: aiMatchInput.episode },
          { title: '永生', season: 1, episode: 59 }
        );
        AIClient.prototype.ask = originalAiAsk;
        Globals.aiValid = false;

        scenario = 'qualified';
        body = await runMatch({ AUTO_MATCH_MAPPING_TABLE: '海贼王 S02E01->航海王(1999)【动漫】 S01E62' }, '海贼王 S02E01');
        assert.equal(body.matches[0].animeId, 930002);
        assert.equal(body.matches[0].episodeId, 9300020 + 62);

        body = await runMatch({ AUTO_MATCH_MAPPING_TABLE: '海贼王 S02E01->航海王(1998)【动漫】 S01E62' }, '海贼王 S02E01');
        assert.equal(body.matches[0].animeId, 930001);

        scenario = 'platform';
        body = await runMatch({ AUTO_MATCH_MAPPING_TABLE: '航海王 S01E01->航海王 S01E01 @qiyi' }, '航海王 S01E01 @qq');
        assert.equal(body.matches[0].animeId, 930005);

        scenario = 'naruto';
        resetFavoriteState({ AUTO_MATCH_MAPPING_TABLE: '火影忍者 S01E57->火影忍者 疾风传(2007)【日番】 S01E59' });
        Globals.envs.sourceOrderArr = ['tencent'];
        Globals.lastSelectMap.set('火影忍者', {
          animeIds: [930007],
          preferBySeason: { 1: 930007 },
          sourceBySeason: { 1: '360' },
          offsets: { 1: '58:【youku】 第58集' }
        });
        assert.equal(hasSeasonSpecificPreference('火影忍者', 1), false);
        const narutoRequest = new Request('http://localhost/api/v2/match', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fileName: '火影忍者 S01E58' })
        });
        body = await parseResponse(await matchAnime(new URL(narutoRequest.url), narutoRequest, '127.0.0.1'));
        assert.equal(body.matches[0].animeId, 930006);
        assert.equal(body.matches[0].episodeId, 9300060 + 60);

        scenario = 'open';
        resetFavoriteState({ AUTO_MATCH_MAPPING_TABLE: '永生 S05E02->永生 S01E58' });
        Globals.envs.sourceOrderArr = ['tencent'];
        Globals.lastSelectMap.set('永生', {
          animeIds: [930003],
          preferBySeason: { 5: 930003 },
          sourceBySeason: { 5: 'tencent' },
          offsets: { 5: '2:【qq】 第10集' },
          explicitBySeason: { 5: true }
        });
        assert.equal(hasSeasonSpecificPreference('永生', 5), true);
        const manualRequest = new Request('http://localhost/api/v2/match', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fileName: '永生 S05E03' })
        });
        body = await parseResponse(await matchAnime(new URL(manualRequest.url), manualRequest, '127.0.0.1'));
        assert.equal(body.matches[0].episodeId, 9300030 + 11);
        assert.equal(Globals.lastSelectMap.get('永生').explicitBySeason['5'], true);

        resetFavoriteState({
          AUTO_MATCH_MAPPING_TABLE: '永生 S05E02->永生 S01E58',
          REMEMBER_LAST_SELECT: 'false'
        });
        Globals.envs.sourceOrderArr = ['tencent'];
        Globals.lastSelectMap.set('永生', {
          animeIds: [930003],
          preferBySeason: { 5: 930003 },
          sourceBySeason: { 5: 'tencent' },
          offsets: { 5: '2:【qq】 第10集' },
          explicitBySeason: { 5: true }
        });
        const disabledPreferenceRequest = new Request('http://localhost/api/v2/match', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fileName: '永生 S05E03' })
        });
        body = await parseResponse(await matchAnime(new URL(disabledPreferenceRequest.url), disabledPreferenceRequest, '127.0.0.1'));
        assert.equal(body.matches[0].episodeId, 9300030 + 59);

        searchKeywords = [];
        scenario = 'fallback';
        body = await runMatch({ AUTO_MATCH_MAPPING_TABLE: '原始剧 S01E01->缺失目标 S01E01' }, '原始剧 S01E01');
        assert.equal(body.matches[0].animeTitle, '原始剧');
        assert.deepEqual(searchKeywords, ['缺失目标', '原始剧']);
      } finally {
        TencentSource.prototype.search = originalSearch;
        TencentSource.prototype.handleAnimes = originalHandleAnimes;
        TencentSource.prototype.getComments = originalGetComments;
        AIClient.prototype.ask = originalAiAsk;
        Globals.envs.sourceOrderArr = originalOrder;
        Globals.envs.sourceFallbackOrderArr = originalFallbackOrder;
        Globals.aiValid = originalAiValid;
      }
    });
  });

test('gradient color conversion is smooth, bounded, and preserves native color_v2', () => {
    assert.equal(resolveGradientSkin(' BILIBILI '), '16478873,3389695');
    assert.equal(resolveGradientSkin('rainbow'), '16711680,16753920,16776960,65280,65535,255,8388863');
    assert.equal(resolveGradientSkin('16711680,255'), '16711680,255');

    const sampler = buildGradientSampler('16711680,255');
    assert.equal(sampler(0), 16711680);
    assert.equal(sampler(0.5), 8388736);
    assert.equal(sampler(1), 255);
    assert.equal(buildGradientSampler('invalid'), null);

    const baseEnv = {
      BLOCKED_WORDS: '',
      GROUP_MINUTE: '0',
      DANMU_LIMIT: '0',
      CONVERT_COLOR: 'color',
      COLOR_POOL: '65280',
      GRADIENT_CHANCE: '100',
      GRADIENT_COLORS: '16711680,255',
      LOG_LEVEL: 'error'
    };
    Globals.init(baseEnv);
    const converted = convertToDanmakuJson(
      [0, 15, 30, 45, 60].map((seconds, index) => ({
        progress: seconds * 1000,
        mode: 1,
        color: 16777215,
        content: `gradient-${index}`
      })),
      'test'
    );
    assert.deepEqual(
      converted.map(item => Number(item.p.split(',')[2])),
      [16711680, 8388736, 255, 8388736, 16711680],
      '60 秒周期应从起点走到终点再平滑返回起点'
    );

    const nativeColorV2 = '{"colors":["#FB7299","#33B8FF"]}';
    const native = convertToDanmakuJson([
      { progress: 1000, mode: 1, color: 16777215, color_v2: nativeColorV2, content: 'native-gradient' }
    ], 'bilibili1');
    assert.equal(Number(native[0].p.split(',')[2]), 16777215);
    assert.equal(native[0].color_v2, nativeColorV2);

    Globals.init({ ...baseEnv, GROUP_MINUTE: '1' });
    const grouped = convertToDanmakuJson([
      { progress: 1000, mode: 1, color: 16777215, content: 'same' },
      { progress: 2000, mode: 1, color: 16777215, color_v2: nativeColorV2, content: 'same' }
    ], 'bilibili1');
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].color_v2, nativeColorV2);

    Globals.init({ ...baseEnv, COLOR_POOL: '', GRADIENT_COLORS: 'invalid' });
    Globals.envs.colorPool = '';
    Globals.envs.gradientColors = 'invalid';
    const safeFallback = convertToDanmakuJson([
      { progress: 1000, mode: 1, color: 16777215, content: 'fallback-white' }
    ], 'test');
    assert.equal(Number(safeFallback[0].p.split(',')[2]), 16777215);

    const defaultConfig = Globals.init({ CONVERT_COLOR: 'color', LOG_LEVEL: 'error' });
    assert.equal(defaultConfig.gradientChance, 0);
    resetSearchState();
  });

test('favorite cache', async t => {
    const originalDirectory = process.cwd();
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'danmu-downstream-favorites-'));
    process.chdir(directory);
    t.beforeEach(async () => { await fs.rm(path.join(directory, '.cache'), { recursive: true, force: true }); });
    t.after(async () => {
      process.chdir(originalDirectory);
      await fs.rm(directory, { recursive: true, force: true });
    });
    await t.test('add/list/remove and serialization round trip', () => {
      resetFavoriteState();
      const anime = createFavoriteAnime();
      const entry = addFavorite('收藏测试_S1', [favoriteSearchResult(anime)], [anime]);

      assert.equal(entry.results.length, 1);
      assert.equal(Globals.favoriteCache.size, 1);
      assert.equal(listFavorites()[0].episodeCount, 2);
      assert.equal(listFavorites()[0].lastRefreshAt, entry.lastRefreshAt);
      assert.equal(resolveFavoriteForKeyword('收藏测试剧场版')?.entry, entry);

      const snapshot = saveFavorites();
      Globals.favoriteCache = new Map();
      loadFavorites(JSON.stringify(snapshot));
      assert.deepEqual(saveFavorites(), snapshot);
      assert.equal(removeFavorite('收藏测试 第二季'), true);
      assert.equal(Globals.favoriteCache.size, 0);
    });

    await t.test('favorite entries ignore search TTL, sweep, and count limits', () => {
      resetFavoriteState({ SEARCH_CACHE_MINUTES: '1', LOG_LEVEL: 'error' });
      const anime = createFavoriteAnime();
      const oldTimestamp = Date.now() - 24 * 60 * 60 * 1000;
      addFavorite('收藏测试', [favoriteSearchResult(anime)], [anime]);
      Globals.favoriteCache.get('收藏测试').timestamp = oldTimestamp;
      Globals.searchCache.set('收藏测试', { results: [], details: [], timestamp: oldTimestamp });
      Globals.searchCache.set('普通过期缓存', { results: [], details: [], timestamp: oldTimestamp });

      setSearchCache('新缓存', [], new Map());

      assert.equal(isSearchCacheValid('收藏测试_S9'), true);
      assert.equal(getSearchCache('收藏测试_S9')[0].animeId, anime.animeId);
      assert.equal(Globals.favoriteCache.has('收藏测试'), true);
      assert.equal(Globals.searchCache.has('收藏测试'), true);
      assert.equal(Globals.searchCache.has('普通过期缓存'), false);

      for (let index = 0; index < 510; index++) addFavorite(`无限收藏${index}`, [], []);
      assert.equal(Globals.favoriteCache.size, 511);
    });

    await t.test('search and match short-circuit external sources and expose isFavorite', async () => {
      resetFavoriteState();
      const anime = createFavoriteAnime();
      addFavorite('收藏测试', [favoriteSearchResult(anime)], [anime]);
      let fetchCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        fetchCount++;
        throw new Error('favorite hit must not use fetch');
      };

      try {
        const searchResponse = await searchAnime(new URL('http://localhost/api/v2/search/anime?keyword=收藏测试&season=1&episode=2'));
        const searchBody = await parseResponse(searchResponse);
        assert.equal(searchBody.animes[0].animeId, anime.animeId);

        const request = new Request('http://localhost/api/v2/match', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fileName: '收藏测试 S01E02' })
        });
        const matchBody = await parseResponse(await matchAnime(new URL(request.url), request, '127.0.0.1'));
        assert.equal(matchBody.isMatched, true);
        assert.equal(matchBody.matches[0].episodeId, anime.links[1].id);
        assert.equal(matchBody.matches[0].isFavorite, true);
        assert.equal(fetchCount, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await t.test('partial search keyword does not reuse a longer favorite title', async () => {
      resetFavoriteState();
      const favoriteAnime = createFavoriteAnime('火影忍者', 2, 910011);
      const searchAnimeResult = createFavoriteAnime('忍者战士飞影', 2, 910012);
      addFavorite('火影忍者', [favoriteSearchResult(favoriteAnime)], [favoriteAnime]);
      Globals.searchCache.set('忍者', {
        results: [favoriteSearchResult(searchAnimeResult)],
        details: [searchAnimeResult],
        timestamp: Date.now()
      });

      assert.equal(getSearchCache('火影忍者_S1')[0].animeId, favoriteAnime.animeId);
      assert.equal(getSearchCache('忍者')[0].animeId, searchAnimeResult.animeId);

      const response = await searchAnime(new URL('http://localhost/api/v2/search/anime?keyword=忍者'));
      const body = await parseResponse(response);
      assert.equal(body.animes[0].animeId, searchAnimeResult.animeId);
    });

    await t.test('favorite API add/list/remove follows token path normalization', async () => {
      resetFavoriteState();
      const anime = createFavoriteAnime('路由收藏测试');
      Globals.searchCache.set('路由收藏测试_S1', {
        results: [favoriteSearchResult(anime)],
        details: [anime],
        timestamp: Date.now()
      });

      const defaultTokenResponse = await handleRequest(
        new Request('http://localhost/api/v2/favorite/list'),
        {}, 'node', '127.0.0.1', {}
      );
      assert.equal(defaultTokenResponse.status, 200);

      const customTokenEnv = { TOKEN: 'favorite-user-token' };
      const publicListResponse = await handleRequest(
        new Request('http://localhost/api/v2/favorite/list'),
        customTokenEnv, 'node', '127.0.0.1', {}
      );
      assert.equal(publicListResponse.status, 200);

      const unauthorizedResponse = await handleRequest(
        new Request('http://localhost/api/v2/favorite/remove', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ keyword: '路由收藏测试' })
        }),
        customTokenEnv, 'node', '127.0.0.1', {}
      );
      assert.equal(unauthorizedResponse.status, 401);

      const addResponse = await handleRequest(new Request('http://localhost/api/v2/favorite/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: '路由收藏测试 S01E01' })
      }), {}, 'node', '127.0.0.1', {});
      assert.equal(addResponse.status, 200);
      assert.equal((await parseResponse(addResponse)).isFavorite, true);

      const listResponse = await handleRequest(
        new Request('http://localhost/87654321/api/favorite/list'),
        {}, 'node', '127.0.0.1', {}
      );
      const listBody = await parseResponse(listResponse);
      assert.equal(listBody.favorites.length, 1);
      assert.equal(listBody.favorites[0].animeTitle, '路由收藏测试');

      const removeResponse = await handleRequest(new Request('http://localhost/87654321/api/favorite/remove', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keyword: listBody.favorites[0].keyword })
      }), {}, 'node', '127.0.0.1', {});
      assert.equal(removeResponse.status, 200);
      assert.equal(Globals.favoriteCache.size, 0);
      assert.equal(Globals.searchCache.has('路由收藏测试_S1'), false);
    });

    await t.test('favorite API can require ADMIN_TOKEN', async () => {
      const env = {
        TOKEN: '87654321',
        ADMIN_TOKEN: 'favorite-admin-token',
        FAVORITE_REQUIRE_ADMIN: 'true'
      };
      resetFavoriteState(env);

      const publicListResponse = await handleRequest(
        new Request('http://localhost/api/v2/favorite/list'),
        env, 'cloudflare', '127.0.0.1', {}
      );
      assert.equal(publicListResponse.status, 200);

      const userResponse = await handleRequest(
        new Request('http://localhost/87654321/api/v2/favorite/add', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ keyword: '权限测试' })
        }),
        env, 'cloudflare', '127.0.0.1', {}
      );
      assert.equal(userResponse.status, 403);
      assert.equal((await parseResponse(userResponse)).message, '权限不足');

      const adminResponse = await handleRequest(
        new Request('http://localhost/favorite-admin-token/api/v2/favorite/list'),
        env, 'cloudflare', '127.0.0.1', {}
      );
      assert.equal(adminResponse.status, 200);
      assert.deepEqual((await parseResponse(adminResponse)).favorites, []);
    });

    await t.test('serverless favorite writes are rejected when Redis persistence is unavailable', async () => {
      resetFavoriteState();
      Globals.deployPlatform = 'vercel';
      Globals.redisValid = false;

      const listResponse = handleFavoriteList();
      const listBody = await parseResponse(listResponse);
      assert.equal(listBody.favoriteSupported, false);

      const makeRequest = body => new Request('http://localhost/api/v2/favorite/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const baseUrl = new URL('http://localhost/api/v2/favorite/action');
      const responses = [
        await handleFavoriteAdd(makeRequest({ keyword: '不可持久化收藏' }), baseUrl),
        await handleFavoriteRefresh(makeRequest({ keyword: '不可持久化收藏' }), baseUrl),
        await handleFavoriteRemove(makeRequest({ keyword: '不可持久化收藏' }))
      ];
      for (const response of responses) {
        assert.equal(response.status, 503);
        assert.match((await parseResponse(response)).message, /持久化收藏存储/);
      }
      assert.equal(Globals.favoriteCache.size, 0);
      resetFavoriteState();
    });

    await t.test('system mutation routes require an explicit ADMIN_TOKEN', async () => {
      Globals.searchCache = new Map([['protected-cache', { timestamp: Date.now() }]]);

      const missingAdminResponse = await handleRequest(new Request('http://localhost/api/cache/clear', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: ['searchCache'] })
      }), {}, 'cloudflare', '127.0.0.1', {});
      assert.equal(missingAdminResponse.status, 403);
      assert.equal(Globals.searchCache.has('protected-cache'), true);

      const env = { TOKEN: 'cache-user-token', ADMIN_TOKEN: 'cache-admin-token' };
      const protectedRoutes = [
        ['POST', '/api/env/set'],
        ['POST', '/api/deploy'],
        ['GET', '/api/cache/animes'],
        ['POST', '/api/cache/clear'],
        ['GET', '/api/cookie/status'],
        ['POST', '/api/ai/verify'],
        ['POST', '/api/nipaplay/verify'],
        ['POST', '/api/logs/clear']
      ];
      for (const [method, path] of protectedRoutes) {
        const userResponse = await handleRequest(
          new Request(`http://localhost/cache-user-token${path}`, { method }),
          env, 'cloudflare', '127.0.0.1', {}
        );
        assert.equal(userResponse.status, 403, `${method} ${path}`);
        assert.equal((await parseResponse(userResponse)).errorMessage, 'ADMIN_TOKEN required');
      }
      assert.equal(Globals.searchCache.has('protected-cache'), true);

      const maskedLogsResponse = await handleRequest(
        new Request('http://localhost/cache-user-token/api/logs'),
        env, 'cloudflare', '127.0.0.1', {}
      );
      assert.equal(maskedLogsResponse.status, 200);

      const adminResponse = await handleRequest(new Request('http://localhost/cache-admin-token/api/cache/clear', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: ['searchCache'] })
      }), env, 'cloudflare', '127.0.0.1', {});
      assert.equal(adminResponse.status, 200);
      assert.equal(Globals.searchCache.size, 0);
    });

    await t.test('manual favorite keeps the search keyword and uses the first result image', async () => {
      resetFavoriteState();
      const anime = createFavoriteAnime('火影忍者 疾风传', 720, 915001);
      Globals.searchCache.set('火影忍者', {
        results: [favoriteSearchResult(anime)],
        details: [anime],
        timestamp: Date.now()
      });

      const addResponse = await handleRequest(new Request('http://localhost/api/v2/favorite/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keyword: '火影忍者' })
      }), {}, 'node', '127.0.0.1', {});
      const addBody = await parseResponse(addResponse);
      assert.equal(addResponse.status, 200);
      assert.equal(addBody.keyword, '火影忍者');
      assert.equal(addBody.animeTitle, '火影忍者');
      assert.equal(addBody.imageUrl, anime.imageUrl);

      const listBody = await parseResponse(await handleRequest(
        new Request('http://localhost/api/v2/favorite/list'),
        {}, 'node', '127.0.0.1', {}
      ));
      assert.equal(listBody.favorites[0].keyword, '火影忍者');
      assert.equal(listBody.favorites[0].animeTitle, '火影忍者');
      assert.equal(listBody.favorites[0].imageUrl, anime.imageUrl);
      assert.equal(listBody.favorites[0].resultsCount, 1);
    });

    await t.test('refresh always performs a new source search and rebuilds the favorite', async () => {
      resetFavoriteState();
      const oldAnime = createFavoriteAnime('刷新测试', 1, 920001);
      const refreshedAnime = createFavoriteAnime('刷新测试', 3, 920002);
      const originalTimestamp = Date.now() - 60_000;
      const favorite = addFavorite('刷新测试', [favoriteSearchResult(oldAnime)], [oldAnime]);
      favorite.timestamp = originalTimestamp;
      favorite.lastRefreshAt = originalTimestamp;

      const originalSearch = TencentSource.prototype.search;
      const originalHandleAnimes = TencentSource.prototype.handleAnimes;
      const originalOrder = Globals.envs.sourceOrderArr;
      let searchCount = 0;
      TencentSource.prototype.search = async () => {
        searchCount++;
        return [{}];
      };
      TencentSource.prototype.handleAnimes = async (_source, _title, results, details) => {
        results.push(refreshedAnime);
        details.set(String(refreshedAnime.animeId), refreshedAnime);
      };
      Globals.envs.sourceOrderArr = ['tencent'];

      try {
        const refreshRequest = new Request('http://localhost/api/v2/favorite/refresh', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ keyword: '刷新测试' })
        });
        const refreshResponse = await handleFavoriteRefresh(refreshRequest, new URL(refreshRequest.url));
        assert.equal(refreshResponse.status, 200);
        assert.equal(searchCount, 1);
        assert.equal(resolveFavoriteForKeyword('刷新测试').entry.results[0].animeId, refreshedAnime.animeId);
        assert.equal(resolveFavoriteForKeyword('刷新测试').entry.details[0].links.length, 3);
        assert.equal(resolveFavoriteForKeyword('刷新测试').entry.timestamp, originalTimestamp);
        assert.ok(resolveFavoriteForKeyword('刷新测试').entry.lastRefreshAt > originalTimestamp);
        assert.equal(listFavorites()[0].lastRefreshAt, resolveFavoriteForKeyword('刷新测试').entry.lastRefreshAt);
      } finally {
        TencentSource.prototype.search = originalSearch;
        TencentSource.prototype.handleAnimes = originalHandleAnimes;
        Globals.envs.sourceOrderArr = originalOrder;
      }
    });

    await t.test('frontend bundle contains working favorite controls', async () => {
      assert.match(HTML_TEMPLATE, /id="manual-favorite-btn"/);
      assert.doesNotMatch(HTML_TEMPLATE, /id="auto-favorite-btn"/);
      assert.match(HTML_TEMPLATE, /id="favorite-panel"/);
      assert.match(HTML_TEMPLATE, /switchDanmuTestTab\('favorite'/);
      assert.match(apitestJsContent, /function favoriteManualSearch\(\)/);
      assert.match(apitestJsContent, /function setManualFavoriteButton/);
      assert.match(apitestJsContent, /取消收藏 · /);
      assert.match(apitestJsContent, /removing \? '\/api\/v2\/favorite\/remove'/);
      assert.match(apitestJsContent, /JSON\.stringify\(\{ keyword \}\)/);
      assert.match(apitestJsContent, /\/api\/v2\/favorite\/refresh/);
      assert.match(apitestJsContent, /\/api\/v2\/favorite\/remove/);
      assert.match(apitestJsContent, /最近刷新时间：/);
      assert.match(mainJsContent, /let copyableApiEndpoint = ''/);
      assert.ok(mainJsContent.includes("copyableApiEndpoint = /^\\*+$/.test(apiToken) ? '' : apiEndpoint;"));
      assert.match(mainJsContent, /if \(!copyableApiEndpoint\)/);
      assert.match(mainJsContent, /无法复制脱敏地址/);
      assert.match(mainJsContent, /请勿使用 ADMIN_TOKEN 作为播放器地址/);
      assert.doesNotMatch(mainJsContent, /API端点已复制到剪贴板:.*apiEndpoint/);
      assert.doesNotMatch(systemSettingsJsContent, /switchCategory\('favorite'\)/);
      assert.match(systemSettingsJsContent, /const isMergeSourcePairs = currentKey === 'MERGE_SOURCE_PAIRS'/);
      // 合并模式只禁止同一合并组内重复，已选源需保持可选取才能组合成合并组
      assert.match(systemSettingsJsContent, /if \(stagingTokens\.has\(value\)\) \{\s*shouldDisable = true;/);
      assert.match(systemSettingsJsContent, /String\(element\.dataset\.value \|\| ''\)\.split\('&'\)/);
      assert.match(systemSettingsJsContent, /function parseBulkMapItems\(silent = false\)/);
      assert.match(systemSettingsJsContent, /function syncBulkMapValue\(\)/);
      assert.match(systemSettingsJsContent, /split\(\/\[;\\r\\n\]\+\//);
      assert.doesNotThrow(() => new Function(apitestJsContent));
      assert.doesNotThrow(() => new Function(mainJsContent));
      assert.doesNotThrow(() => new Function(systemSettingsJsContent));
      assert.doesNotThrow(() => new Function(previewJsContent));
      assert.match(previewJsContent, /AUTO_MATCH_MAPPING_TABLE/);

      const copyFunctionStart = mainJsContent.indexOf('function copyApiEndpoint()');
      const copyFunctionEnd = mainJsContent.indexOf('function fallbackCopy', copyFunctionStart);
      assert.ok(copyFunctionStart >= 0 && copyFunctionEnd > copyFunctionStart);
      const copyFunctionSource = mainJsContent.slice(copyFunctionStart, copyFunctionEnd);

      const runCopyEndpoint = async (displayedEndpoint, copyableEndpoint) => {
        const copied = [];
        const alerts = [];
        const logs = [];
        const endpointElement = {
          textContent: displayedEndpoint,
          style: {}
        };
        const documentStub = {
          getElementById: id => id === 'api-endpoint' ? endpointElement : null
        };
        const navigatorStub = {
          clipboard: {
            writeText: async value => {
              copied.push(value);
            }
          }
        };
        const executeCopy = new Function(
          'document',
          'navigator',
          'customAlert',
          'addLog',
          'fallbackCopy',
          'setTimeout',
          `let copyableApiEndpoint = ${JSON.stringify(copyableEndpoint)};\n${copyFunctionSource}\ncopyApiEndpoint();`
        );
        executeCopy(
          documentStub,
          navigatorStub,
          (message, title) => alerts.push({ message, title }),
          (message, level) => logs.push({ message, level }),
          () => { throw new Error('clipboard fallback should not run'); },
          () => {}
        );
        await Promise.resolve();
        await Promise.resolve();
        return { copied, alerts, logs };
      };

      const maskedCopy = await runCopyEndpoint('https://danmu.example/********', '');
      assert.deepEqual(maskedCopy.copied, []);
      assert.equal(maskedCopy.alerts.length, 1);
      assert.equal(maskedCopy.alerts[0].title, '无法复制脱敏地址');
      assert.match(maskedCopy.alerts[0].message, /https:\/\/danmu\.example\/\{TOKEN\}/);
      assert.match(maskedCopy.alerts[0].message, /ADMIN_TOKEN/);

      const authorizedUrl = 'https://danmu.example/browser-test-token';
      const authorizedCopy = await runCopyEndpoint(authorizedUrl, authorizedUrl);
      assert.deepEqual(authorizedCopy.copied, [authorizedUrl]);
      assert.deepEqual(authorizedCopy.alerts, []);
      assert.deepEqual(authorizedCopy.logs, [
        { message: 'API端点已复制到剪贴板', level: 'success' }
      ]);
      assert.doesNotMatch(JSON.stringify(authorizedCopy.logs), /browser-test-token/);
      // 连通性测试以表单值随请求提交，避免云部署下未重新部署时取不到新配置
      assert.match(systemSettingsJsContent, /function readLocalEnvValue\(key\)/);
      assert.match(systemSettingsJsContent, /aiBaseUrl: readLocalEnvValue\('AI_BASE_URL'\)/);
      assert.match(systemSettingsJsContent, /aiModel: readLocalEnvValue\('AI_MODEL'\)/);
      assert.match(systemSettingsJsContent, /payload\.aiApiKey = apiKey/);
      assert.match(systemSettingsJsContent, /dandanplayAccount: readLocalEnvValue\('DANDANPLAY_ACCOUNT'\)/);
      assert.match(systemSettingsJsContent, /payload\.dandanplayPassword = password/);
      assert.doesNotMatch(systemSettingsJsContent, /JSON\.stringify\(isMasked \? \{\} : \{ 'aiApiKey': apiKey \}\)/);
      assert.doesNotMatch(systemSettingsJsContent, /JSON\.stringify\(isMasked \? \{\} : \{ 'dandanplayPassword': password \}\)/);
    });

    await t.test('弹弹play连通性验证使用请求体中的账号与密码', async () => {
      const loginRequests = [];
      const originalAccount = Globals.envs.dandanplayAccount;
      const originalPassword = Globals.envs.dandanplayPassword;

      try {
        // 运行期配置与请求体不同，用于验证请求体优先
        Globals.envs.dandanplayAccount = 'runtime@example.com';
        Globals.envs.dandanplayPassword = 'runtime-password';

        await withMockFetch(async (url, options) => {
          loginRequests.push({ url: String(url), body: JSON.parse(options.body) });
          return mockJsonResponse({
            success: true,
            token: 'mock-token',
            tokenExpireTime: '2099-01-01T00:00:00Z',
            screenName: '请求体账号'
          });
        }, async () => {
          const response = await handleDandanplayVerify({
            json: async () => ({ dandanplayAccount: 'body@example.com', dandanplayPassword: 'body-password' })
          });
          const body = await parseResponse(response);

          assert.equal(body.ok, true);
          assert.match(body.message, /请求体账号/);
          assert.equal(loginRequests.length, 1);
          assert.match(loginRequests[0].url, /\/api\/v2\/login$/);
          assert.equal(loginRequests[0].body.userName, 'body@example.com');
          assert.equal(loginRequests[0].body.password, 'body-password');
        });
      } finally {
        Globals.envs.dandanplayAccount = originalAccount;
        Globals.envs.dandanplayPassword = originalPassword;
      }
    });

    await t.test('AI 连通性验证使用请求体中的密钥与地址模型', async () => {
      const originalVerify = AIClient.prototype.verify;
      const originalApiKey = Globals.envs.aiApiKey;
      const originalBaseUrl = Globals.envs.aiBaseUrl;
      const originalModel = Globals.envs.aiModel;
      let captured = null;

      AIClient.prototype.verify = async function () {
        captured = { apiKey: this.apiKey, baseURL: this.baseURL, model: this.model };
        return { ok: true };
      };

      try {
        // 运行期配置与请求体不同，用于验证请求体优先
        Globals.envs.aiApiKey = 'runtime-key';
        Globals.envs.aiBaseUrl = 'https://runtime.example/v1';
        Globals.envs.aiModel = 'runtime-model';

        const response = await handleAiVerify({
          json: async () => ({ aiApiKey: 'body-key', aiBaseUrl: 'https://body.example/v1', aiModel: 'body-model' })
        });
        const body = await parseResponse(response);

        assert.equal(body.ok, true);
        assert.equal(captured.apiKey, 'body-key');
        assert.equal(captured.baseURL, 'https://body.example/v1');
        assert.equal(captured.model, 'body-model');
      } finally {
        AIClient.prototype.verify = originalVerify;
        Globals.envs.aiApiKey = originalApiKey;
        Globals.envs.aiBaseUrl = originalBaseUrl;
        Globals.envs.aiModel = originalModel;
      }
    });

  await t.test('handleClearCache clears only the selected cache items', async t => {
    // 各清理项对应的全局状态种子；favorites 不在清理范围内，用于验证不被误清
    const seed = () => {
      Globals.animes = [{ id: 1 }];
      Globals.episodeIds = [{ id: 12000, url: 'https://example.com/retained', title: 'retained' }];
      Globals.episodeNum = 50000;
      Globals.lastSelectMap = new Map([['k', {}]]);
      Globals.searchCache = new Map([['k', {}]]);
      Globals.commentCache = new Map([['k', {}]]);
      Globals.requestHistory = new Map([['ip', []]]);
      Globals.reqRecords = [{ a: 1 }];
      Globals.todayReqNum = 42;
      Globals.favoriteCache = new Map([['fav', {}]]);
      Globals.useBangumiData = false;
    };

    await t.test('single item clears only that item', async () => {
      seed();
      const res = await handleClearCache({ json: async () => ({ items: ['animes'] }) });
      const body = await parseResponse(res);
      assert.equal(body.success, true);
      assert.equal(body.clearedItems.animes, 0);
      assert.equal(Globals.animes.length, 0);
      assert.equal(Globals.episodeIds.length, 1);
      assert.equal(Globals.lastSelectMap.size, 1);
      assert.equal(Globals.searchCache.size, 1);
      assert.equal(Globals.commentCache.size, 1);
      assert.equal(Globals.requestHistory.size, 1);
    });

    await t.test('invalid keys are filtered out and do not throw', async () => {
      seed();
      const res = await handleClearCache({ json: async () => ({ items: ['animes', 'notARealKey', 'animesX'] }) });
      const body = await parseResponse(res);
      assert.equal(body.success, true);
      assert.equal(Globals.animes.length, 0);
      assert.equal(Globals.searchCache.size, 1);
      assert.equal(Globals.commentCache.size, 1);
    });

    await t.test('requestHistory folds reqRecords and todayReqNum', async () => {
      seed();
      const res = await handleClearCache({ json: async () => ({ items: ['requestHistory'] }) });
      const body = await parseResponse(res);
      assert.equal(body.success, true);
      assert.equal(body.clearedItems.requestHistory, 0);
      assert.equal(body.clearedItems.reqRecords, 0);
      assert.equal(body.clearedItems.todayReqNum, 0);
      assert.equal(Globals.requestHistory.size, 0);
      assert.deepEqual(Globals.reqRecords, []);
      assert.equal(Globals.todayReqNum, 0);
      assert.equal(Globals.animes.length, 1);
    });

    await t.test('episodeNum reset respects retained episode references', async () => {
      seed();
      const res = await handleClearCache({ json: async () => ({ items: ['episodeNum'] }) });
      const body = await parseResponse(res);
      assert.equal(body.success, true);
      assert.equal(body.clearedItems.episodeNum, 12000);
      assert.equal(Globals.episodeNum, 12000);
      assert.equal(Globals.animes.length, 1);
    });

    await t.test('favorites are preserved across full clear', async () => {
      seed();
      const res = await handleClearCache();
      const body = await parseResponse(res);
      assert.equal(body.success, true);
      assert.equal(Globals.favoriteCache.size, 1);
      assert.equal(Globals.animes.length, 0);
      assert.equal(Globals.episodeIds.length, 0);
      assert.equal(Globals.lastSelectMap.size, 0);
      assert.equal(Globals.searchCache.size, 0);
      assert.equal(Globals.commentCache.size, 0);
      assert.equal(Globals.requestHistory.size, 0);
      assert.equal(Globals.todayReqNum, 0);
      assert.deepEqual(Globals.reqRecords, []);
    });

    await t.test('empty items array clears nothing', async () => {
      seed();
      const res = await handleClearCache({ json: async () => ({ items: [] }) });
      const body = await parseResponse(res);
      assert.equal(body.success, true);
      assert.equal(Globals.animes.length, 1);
      assert.equal(Globals.searchCache.size, 1);
      assert.equal(Globals.commentCache.size, 1);
    });

    await t.test('malformed body (non-array items) triggers full clear', async () => {
      seed();
      const res = await handleClearCache({ json: async () => ({ items: 'animes' }) });
      const body = await parseResponse(res);
      assert.equal(body.success, true);
      assert.equal(Globals.animes.length, 0);
      assert.equal(Globals.searchCache.size, 0);
    });

    await t.test('bangumiData is a recognized key and isolated from other caches', async () => {
      seed();
      const res = await handleClearCache({ json: async () => ({ items: ['bangumiData'] }) });
      const body = await parseResponse(res);
      assert.equal(body.success, true);
      assert.equal(body.clearedItems.bangumiData, 0);
      assert.equal(Globals.animes.length, 1);
      assert.equal(Globals.searchCache.size, 1);
    });

    await t.test('prototype keys like __proto__ are rejected and do not break the clear', async () => {
      seed();
      const res = await handleClearCache({ json: async () => ({ items: ['animes', '__proto__', 'constructor', 'animes'] }) });
      const body = await parseResponse(res);
      assert.equal(body.success, true);
      assert.equal(Globals.animes.length, 0);
      assert.equal(Globals.searchCache.size, 1);
      assert.equal(Globals.commentCache.size, 1);
    });
  });

  });

test('stripLinkOffset 解析 @偏移 后缀（@秒数 / @%百分比 / 无偏移 / 合并链接仅取末段）', async () => {
    assert.deepEqual(stripLinkOffset('https://x.com/v/1'), { cleanUrl: 'https://x.com/v/1', offset: 0, percent: false });
    assert.deepEqual(stripLinkOffset('https://x.com/v/1@3197'), { cleanUrl: 'https://x.com/v/1', offset: 3197, percent: false });
    assert.deepEqual(stripLinkOffset('https://x.com/v/1@%50'), { cleanUrl: 'https://x.com/v/1', offset: 50, percent: true });
    assert.deepEqual(stripLinkOffset('https://x.com/v/1@-50'), { cleanUrl: 'https://x.com/v/1', offset: -50, percent: false });
    // 合并链接仅从整条 URL 尾部取末段子链接的 @偏移
    const merged = 'https://x.com/v/A$$$https://x.com/v/B@3197';
    assert.deepEqual(stripLinkOffset(merged), { cleanUrl: 'https://x.com/v/A$$$https://x.com/v/B', offset: 3197, percent: false });
    // 容错：非字符串入参不抛错
    assert.deepEqual(stripLinkOffset(null), { cleanUrl: '', offset: 0, percent: false });
  });

test('applyOffset 应用 @偏移 的端点语义（绝对 = 时间+偏移，百分比端点 = 最大时间+偏移）', async () => {
    const danmus = [{ p: '10,1,16777215,b' }, { p: '20,1,16777215,b' }];
    // 绝对偏移：每条弹幕时间整体平移 offset 秒
    assert.deepEqual(applyOffset(danmus, 50).map(d => d.p), ['60.00,1,16777215,b', '70.00,1,16777215,b']);
    // 百分比偏移：按时间轴缩放，scaleRatio=(maxTime+offset)/maxTime，端点 maxTime → maxTime+offset
    assert.deepEqual(applyOffset(danmus, 50, { usePercent: true, videoDuration: 20 }).map(d => d.p), ['35.00,1,16777215,b', '70.00,1,16777215,b']);
    // 合并时长端点一致性：单链接时长 3266、偏移 3197 时，合并时间轴末端为 6463
    assert.equal(applyOffset([{ t: 3266 }], 3197, { usePercent: false, videoDuration: 3266 })[0].t, 6463);
  });

test('dedupeBangumiSearchResults should dedupe same-source results and skip tmdb', () => {
    const makeResult = (siteKey, siteId, titles) => ({ matchedSiteKey: siteKey, siteId, titles });

    // 同源多条目：保留标题精确命中检索词的一条，其余标题并入别名
    const merged = dedupeBangumiSearchResults([
      makeResult('anidb', '19242', ['Re：从零开始的异世界生活 第四季 丧失篇(2026)']),
      makeResult('anidb', '19242', ['Re：从零开始的异世界生活 第四季 夺还篇(2026)']),
    ], 'Re：从零开始的异世界生活 第四季 夺还篇(2026)');
    assert.equal(merged.length, 1, `Expected merged.length === 1, but got ${merged.length}`);
    assert.equal(merged[0].titles[0], 'Re：从零开始的异世界生活 第四季 夺还篇(2026)');
    assert.ok(merged[0].titles.includes('Re：从零开始的异世界生活 第四季 丧失篇(2026)'), 'Expected merged titles to include the secondary title');

    // tmdb 不参与去重，同 id 多条均保留
    const tmdbOnly = dedupeBangumiSearchResults([
      makeResult('tmdb', '123', ['标题A']),
      makeResult('tmdb', '123', ['标题B']),
    ], '检索词');
    assert.equal(tmdbOnly.length, 2, `Expected tmdbOnly.length === 2, but got ${tmdbOnly.length}`);

    // 不同源 id 空间重叠（同 siteId 不同 matchedSiteKey）不合并
    const crossSite = dedupeBangumiSearchResults([
      makeResult('anidb', '19242', ['丧失篇']),
      makeResult('bangumi', '19242', ['夺还篇']),
    ], '检索词');
    assert.equal(crossSite.length, 2, `Expected crossSite.length === 2, but got ${crossSite.length}`);
  });

test('TITLE_NOISE_FILTER 默认规则为合法正则，且文档默认值与其一致', async () => {
    const savedEnv = Envs.env;
    const savedSystemEnv = process.env.TITLE_NOISE_FILTER;
    try {
      // 未设置该变量时应回退到内置默认规则，而不是因默认规则非法而返回 null（禁用整个清理）
      Envs.env = {};
      delete process.env.TITLE_NOISE_FILTER;
      const pattern = Envs.resolveTitleNoiseFilter();
      assert.ok(pattern instanceof RegExp, '未设置 TITLE_NOISE_FILTER 时应返回可用的默认正则');

      // 半角/全角圆括号与方括号均需命中
      assert.strictEqual('百花杀（真彩）'.replace(pattern, '').trim(), '百花杀');
      assert.strictEqual('百花杀(真彩)'.replace(pattern, '').trim(), '百花杀');
      assert.strictEqual('百花杀[真彩]'.replace(pattern, '').trim(), '百花杀');
      assert.strictEqual('百花杀［真彩］'.replace(pattern, '').trim(), '百花杀');

      // 原版规则不含年份分支，年份不参与清理；无杂音词时保持原样
      assert.strictEqual('吞噬星空（2024）'.replace(pattern, '').trim(), '吞噬星空（2024）');
      assert.strictEqual('百花杀'.replace(pattern, '').trim(), '百花杀');

      // 对外记录的默认值须与代码默认值一致，且可直接编译
      assert.strictEqual(Envs.accessedEnvVars.get('TITLE_NOISE_FILTER'), pattern.source);
      assert.doesNotThrow(() => new RegExp(pattern.source, 'gi'));

      // README 与默认配置文件中的默认值必须与代码默认值完全一致，否则用户照抄会得到非法正则
      for (const docUrl of [new URL('../README.md', import.meta.url), new URL('../config/.env.example', import.meta.url)]) {
        const text = await fs.readFile(docUrl, 'utf8');
        assert.ok(text.includes(pattern.source), `${docUrl.pathname} 中的默认值应与代码默认值一致`);
      }

      // 显式设为空值表示禁用
      Envs.env = { TITLE_NOISE_FILTER: '' };
      assert.strictEqual(Envs.resolveTitleNoiseFilter(), null);
    } finally {
      Envs.env = savedEnv;
      if (savedSystemEnv === undefined) delete process.env.TITLE_NOISE_FILTER;
      else process.env.TITLE_NOISE_FILTER = savedSystemEnv;
    }
  });

test('local danmu upload and deletion permissions apply before config loads and match the upload API', async t => {
  const userToken = 'local-user-token';
  const adminToken = 'local-admin-token';
  for (const scenario of [
    { name: 'ordinary user is denied by default', token: userToken, allowed: false },
    { name: 'ordinary user is denied when false', setting: 'false', token: userToken, allowed: false },
    { name: 'ordinary user is allowed when true', setting: 'true', token: userToken, allowed: true },
    { name: 'admin is allowed when false', setting: 'false', token: adminToken, allowed: true },
    { name: 'admin is allowed when true', setting: 'true', token: adminToken, allowed: true },
    { name: 'missing ADMIN_TOKEN does not grant admin access', setting: 'false', token: userToken, adminToken: '', allowed: false },
  ]) {
    await t.test(scenario.name, async () => {
      const env = { TOKEN: userToken, ADMIN_TOKEN: scenario.adminToken ?? adminToken, LOG_LEVEL: 'error', RATE_LIMIT_MAX_REQUESTS: '0' };
      if (scenario.setting !== undefined) env.LOCAL_DANMU_NOT_REQUIRE_ADMIN = scenario.setting;
      const baseUrl = 'http://localhost/' + scenario.token;
      const request = req => handleRequest(req, env, 'node', '127.0.0.1');
      const response = await request(new Request(baseUrl));
      assert.equal(response.status, 200);
      const alerts = [];
      let browserRequests = 0;
      let confirmations = 0;
      const { context, elements, chooseFile, box } = makePage(async () => { browserRequests++; throw new Error('Unexpected request'); }, {
        currentToken: scenario.token,
        customAlert: (message, title) => alerts.push({ message, title }),
        confirm: () => { confirmations++; return false; },
      }, await response.text());
      const checkFilePicker = () => {
        const event = new Event('click', { cancelable: true });
        assert.equal(chooseFile(event), scenario.allowed);
        assert.equal(event.defaultPrevented, !scenario.allowed);
      };
      checkFilePicker();
      context.renderLocalDanmuGroups(box, groupLocalDanmuResources([resource(1, 1)]));
      const deleteButton = box.querySelectorAll('button')[0];
      await deleteButton.listeners.get('click')();
      assert.equal(confirmations, scenario.allowed ? 1 : 0);
      const config = await (await request(new Request(baseUrl + '/api/config'))).json();
      assert.equal(config.envs.LOCAL_DANMU_NOT_REQUIRE_ADMIN, scenario.setting === 'true');
      assert.equal(config.envVarConfig.LOCAL_DANMU_NOT_REQUIRE_ADMIN.type, 'boolean');
      context.updateLocalDanmuPermission(config);
      checkFilePicker();
      await deleteButton.listeners.get('click')();
      assert.equal(confirmations, scenario.allowed ? 2 : 0);
      if (!scenario.allowed) {
        await context.uploadLocalDanmu();
        assert.match(elements.get('local-danmu-upload-status').textContent, /需要 ADMIN 权限/);
        assert.ok(alerts.every(alert => alert.title === '权限不足' && alert.message.includes('需要 ADMIN 权限')));
        assert.equal(alerts.length, 5);
      } else {
        assert.equal(alerts.length, 0);
      }
      assert.equal(browserRequests, 0);

      for (const prefix of ['/api', '/api/v2']) {
        let bodyReads = 0;
        const upload = new Request(baseUrl + prefix + '/local-danmu/upload', { method: 'POST' });
        upload.formData = async () => { bodyReads++; return new FormData(); };
        const result = await request(upload);
        const body = await result.json();
        // Allowed requests reach file validation; denied requests never read the upload body.
        assert.equal(result.status, scenario.allowed ? 400 : 403);
        assert.equal(bodyReads, scenario.allowed ? 1 : 0);
        assert.match(body.errorMessage, scenario.allowed ? /缺少 file/ : /ADMIN_TOKEN.*LOCAL_DANMU_NOT_REQUIRE_ADMIN=true/);
        const edit = await request(new Request(baseUrl + prefix + '/local-danmu/missing-permission-fixture', {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}',
        }));
        assert.equal(edit.status, scenario.allowed ? 404 : 403);
      }
    });
  }
});

test('cloud without Redis skips optional local lookup without network requests', async () => {
  resetState();
  Globals.deployPlatform = 'vercel';
  try {
    await withMockFetch(() => assert.fail('disabled local storage must not make a Redis request'), async () => {
      assert.equal(await getLocalDanmu('missing'), null);
      assert.equal(await findLocalDanmu({ title: '测试剧集', episode: 1 }), null);
      assert.deepEqual(await getSourceByKey('local').search('测试剧集'), []);
    });
  } finally {
    resetState();
  }
});

test('NipaPlay credentials, fallback and token lifecycle', async t => {
  const savedAccount = Globals.envs.dandanplayAccount;
  const savedPassword = Globals.envs.dandanplayPassword;
  const native = [{ p: '1,1,16777215', m: 'native' }];
  const freshRelay = name => import(`./utils/nipaplay-util.js?regression=${name}`);
  try {
    Globals.envs.dandanplayAccount = 'relay-test-account';
    Globals.envs.dandanplayPassword = 'relay-test-password';
    await t.test('login and token requests remain HTTPS after repeated failures', async () => {
      const relay = await freshRelay('https');
      let count = 0;
      await withMockFetch(async (url, options) => {
        count++;
        assert.equal(new URL(url).protocol, 'https:');
        assert.equal(options.redirect, 'manual');
        const error = new Error('mock connection reset');
        error.cause = { code: 'ECONNRESET' };
        throw error;
      }, async () => {
        for (let i = 0; i < 4; i++) assert.equal((await relay.verifyNipaplayAccount()).ok, false);
      });
      assert.equal(count, 8);
    });
    await t.test('concurrent requests share login and a 401 refreshes the token once', async () => {
      const relay = await freshRelay('token');
      let logins = 0;
      let expired = false;
      await withMockFetch(async (url, options) => {
        assert.equal(new URL(url).protocol, 'https:');
        assert.equal(options.redirect, 'manual');
        if (url.endsWith('/login')) {
          logins++;
          assert.deepEqual(JSON.parse(options.body), { userName: 'relay-test-account', password: 'relay-test-password' });
          return mockJsonResponse({ token: `relay-token-${logins}`, tokenExpireTime: '2099-01-01T00:00:00Z' });
        }
        assert.equal(options.headers.Authorization, `Bearer relay-token-${logins}`);
        if (expired) {
          expired = false;
          return { ...mockJsonResponse({}), status: 401, ok: false };
        }
        return mockJsonResponse({ comments: native });
      }, async () => {
        const results = await Promise.all([relay.fetchNipaplayDanmaku(1), relay.fetchNipaplayDanmaku(2)]);
        assert.equal(logins, 1);
        results.forEach(result => assert.deepEqual(result.comments, native));
        expired = true;
        assert.deepEqual((await relay.fetchNipaplayDanmaku(3)).comments, native);
        assert.equal(logins, 2);
      });
    });
    await t.test('detail fallback keeps bearer tokens on HTTPS without redirects', async () => {
      const relay = await freshRelay('detail-https');
      let detailRequests = 0;
      await withMockFetch(async (url, options) => {
        assert.equal(new URL(url).protocol, 'https:');
        assert.equal(options.redirect, 'manual');
        if (url.endsWith('/login')) {
          return mockJsonResponse({ token: 'detail-fixture', tokenExpireTime: '2099-01-01T00:00:00Z' });
        }
        assert.ok(url.endsWith('/api/v2/bangumi/123'));
        assert.equal(options.headers.Authorization, 'Bearer detail-fixture');
        detailRequests++;
        return mockJsonResponse({ bangumi: { animeId: 123, episodes: [] } });
      }, async () => {
        assert.equal((await relay.fetchNipaplayBangumiDetail(123)).animeId, 123);
      });
      assert.equal(detailRequests, 1);
    });
    await t.test('near-expiry tokens renew without following redirects', async () => {
      const relay = await freshRelay('renew');
      const routes = [];
      await withMockFetch(async (url, options) => {
        routes.push(new URL(url).pathname);
        assert.equal(options.redirect, 'manual');
        if (url.endsWith('/login')) return mockJsonResponse({ token: 'old-token', tokenExpireTime: new Date(Date.now() + 1000).toISOString() });
        if (url.endsWith('/renew')) {
          assert.equal(options.headers.Authorization, 'Bearer old-token');
          return mockJsonResponse({ token: 'new-token', tokenExpireTime: '2099-01-01T00:00:00Z' });
        }
        return mockJsonResponse({ comments: native });
      }, async () => {
        await relay.fetchNipaplayDanmaku(1);
        await relay.fetchNipaplayDanmaku(2);
      });
      assert.equal(routes.filter(x => x.endsWith('/login')).length, 1);
      assert.equal(routes.filter(x => x.endsWith('/renew')).length, 1);
    });
    await t.test('302 native download does not receive the bearer token', async () => {
      const relay = await freshRelay('redirect');
      const location = 'https://native.example/comments?urls=https://v.qq.com/x/cover/example.html&shift=3';
      await withMockFetch(async (url, options) => {
        if (url.endsWith('/login')) return mockJsonResponse({ token: 'redirect-token', tokenExpireTime: '2099-01-01T00:00:00Z' });
        if (url === location) {
          assert.equal(options.headers.Authorization, undefined);
          return mockJsonResponse({ comments: native });
        }
        return { ...mockJsonResponse({}), status: 302, ok: false, headers: new Headers({ location }) };
      }, async () => {
        const result = await relay.fetchNipaplayDanmaku(1);
        assert.deepEqual(result.comments, native);
        assert.equal(result.relatedLinks.tencent[0].shift, 3);
      });
    });
    await t.test('unconfigured accounts keep native comments without relay requests', async () => {
      Globals.envs.dandanplayAccount = '';
      Globals.envs.dandanplayPassword = '';
      let calls = 0;
      await withMockFetch(async (url) => {
        calls++;
        assert.equal(new URL(url).hostname, 'api.danmaku.weeblify.app');
        return mockJsonResponse({ comments: native });
      }, async () => assert.deepEqual(await new DandanSource().getEpisodeDanmu(1), native));
      assert.equal(calls, 1);
    });
  } finally {
    Globals.envs.dandanplayAccount = savedAccount;
    Globals.envs.dandanplayPassword = savedPassword;
  }
});

test('NipaPlay configuration masks credentials and guards verification routes', async () => {
  const env = { TOKEN: 'relay-user-test', ADMIN_TOKEN: 'relay-admin-test', DANDANPLAY_ACCOUNT: 'account#fixture', DANDANPLAY_PASSWORD: 'password#fixture' };
  const savedEnv = Envs.env;
  try {
    await withMockFetch(async () => { throw new Error('unauthorized requests must not contact relay'); }, async () => {
      for (const prefix of ['', '/relay-user-test']) {
        const denied = await handleRequest(new Request(`http://localhost${prefix}/api/nipaplay/verify`, { method: 'POST' }), env, 'cloudflare', '127.0.0.1', {});
        assert.equal(denied.status, 403);
        const config = await handleRequest(new Request(`http://localhost${prefix}/api/config`), env, 'cloudflare', '127.0.0.1', {});
        const content = await config.text();
        assert.doesNotMatch(content, /account#fixture|password#fixture/);
      }
    });
    assert.equal(Globals.envs.dandanplayPassword, 'password#fixture');
    let calls = 0;
    await withMockFetch(async () => {
      calls++;
      return mockJsonResponse({ token: 'verify-fixture', screenName: 'fixture' });
    }, async () => {
      const allowed = await handleRequest(new Request('http://localhost/relay-admin-test/api/nipaplay/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      }), env, 'cloudflare', '127.0.0.1', {});
      assert.equal((await allowed.json()).ok, true);
    });
    assert.equal(calls, 1);
  } finally {
    Globals.init(savedEnv || {});
  }
});
