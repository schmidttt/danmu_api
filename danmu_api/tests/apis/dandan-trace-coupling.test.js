// 接口详情：dandan-api 步骤打点、配置生效记录与配置归属的真实耦合校验
// 以缓存命中这一无需外网请求的路径运行被测接口，断言 trace 内实际记录的数据

import dotenv from 'dotenv';
dotenv.config();

import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Globals } from '../../configs/globals.js';
import { addAnime, getCommentCache, setCommentCache, setSearchCache } from '../../utils/cache-util.js';
import { getComment, getCommentByUrl, getSegmentComment, searchAnime } from '../../apis/dandan-api.js';
import { getSourceByKey } from '../../sources/registry.js';
import { resetSearchState } from '../helpers/context.js';
import {
  createTrace, runWithTrace, finishTrace, getInterfaceDetail,
  useAsyncLocalStorage, TRACE_CONFIG_ACCESSORS, TRACE_RUNTIME_ACCESSORS,
} from '../../utils/pipeline-trace.js';

const KEYWORD = '打点耦合校验剧名';

function seedCache() {
  Globals.init({ SOURCE_FALLBACK_ORDER: '' });
  Globals.envs.sourceFallbackOrderArr = [];
  useAsyncLocalStorage(AsyncLocalStorage);
  setSearchCache(KEYWORD, [{
    animeId: 9001,
    bangumiId: 'TRACE-COUPLING-9001',
    animeTitle: KEYWORD,
    source: 'bilibili',
    episodes: [{ episodeId: 'E9001', episodeTitle: '第1集', episodeNumber: '1' }],
  }]);
}

function searchUrl(keyword) {
  return new URL('http://localhost/api/v2/search/anime?keyword=' + encodeURIComponent(keyword));
}

test('searchAnime 缓存命中记录搜索步骤的完整 inputs / outputs / status / reason 与候选数', async () => {
  seedCache();
  const trace = createTrace('GET', '/api/v2/search/anime');
  const response = await runWithTrace(trace, () => searchAnime(searchUrl(KEYWORD)));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.animes.length, 1);

  assert.equal(trace.steps.length, 1);
  const step = trace.steps[0];
  assert.equal(step.name, '搜索·缓存查询');
  assert.equal(step.status, 'hit');
  assert.equal(step.reason, '普通搜索缓存命中');
  assert.equal(step.inputs.q, KEYWORD);
  assert.equal(step.inputs.cacheKey, KEYWORD);
  assert.equal(step.outputs.hit, true);
  assert.equal(step.outputs.cachedCount, 1);
  assert.equal(step.outputs.count, 1);
  assert.equal(typeof step.ms, 'number');
});

test('recordConfigAccess 将搜索步骤期间的配置读取归属到活动步骤', async () => {
  seedCache();
  const trace = createTrace('GET', '/api/v2/search/anime');
  await runWithTrace(trace, () => searchAnime(searchUrl(KEYWORD)));
  assert.equal(trace.configs.titleNoiseFilter.used, true);
  assert.equal(trace.configs.titleNoiseFilter.step, '搜索·缓存查询');
  assert.equal(trace.configs.animeTitleSimplified.used, true);
  assert.equal(trace.configs.animeTitleSimplified.step, '搜索·缓存查询');
  assert.equal(trace.configs.searchCacheMinutes.used, true);
});

test('searchAnime 缓存查询步骤归并搜索缓存键与有效期的配置生效记录', async () => {
  seedCache();
  const trace = createTrace('GET', '/api/v2/search/anime');
  await runWithTrace(trace, () => searchAnime(searchUrl(KEYWORD)));
  const changes = trace.steps[0].changes || [];
  const cacheChange = changes.find(c => c.config === 'SEARCH_CACHE_MINUTES');
  assert.ok(cacheChange, '缺少搜索缓存键配置生效记录');
  assert.equal(cacheChange.kind, 'stats', '缓存键是计算条件，不是处理前后');
  assert.equal(cacheChange.context.缓存键, KEYWORD);
  assert.equal(cacheChange.context.有效期, '3 分钟');
  assert.equal(cacheChange.context.季, '未指定');
  assert.equal(cacheChange.before, undefined);
  assert.equal(cacheChange.hit, undefined, '键值换算类记录不携带命中标记');
  assert.equal(trace.steps[0].outputs.count, 1);
});

test('finishTrace 保留真实步骤与本次读取到的配置', async () => {
  seedCache();
  const trace = createTrace('GET', '/api/v2/search/anime');
  await runWithTrace(trace, () => searchAnime(searchUrl(KEYWORD)));
  finishTrace(trace);
  const detail = getInterfaceDetail(trace.id);
  assert.equal(detail.steps[0].outputs.cachedCount, 1);
  // 只登记读取过的配置；未读取项由详情接口按配置目录补齐
  const readAccessors = Object.keys(detail.configs);
  assert.ok(readAccessors.length > 0 && readAccessors.length < 20, `读取项数量异常: ${readAccessors.length}`);
  for (const accessor of readAccessors) {
    assert.notEqual(accessor, 'danmuLimit', '本次未读取的配置不应出现在追踪记录里');
  }
  assert.equal(detail.configs.titleNoiseFilter.used, true);
  assert.equal(detail.configs.animeTitleSimplified.used, true);
  assert.equal(detail.configs.searchCacheMinutes.used, true);
});

test('searchAnime 关键字为空时记录 skip 步骤与归零候选数', async () => {
  seedCache();
  const trace = createTrace('GET', '/api/v2/search/anime');
  const response = await runWithTrace(trace, () => searchAnime(searchUrl('')));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.animes, []);

  assert.equal(trace.steps.length, 1);
  const step = trace.steps[0];
  assert.equal(step.name, '搜索·缓存查询');
  assert.equal(step.status, 'skip');
  assert.equal(step.inputs.q, '');
  assert.equal(step.outputs.finalCount, 0);
  assert.equal(step.outputs.count, 0);
});

test('searchAnime 无追踪作用域时正常返回且步骤打点为空操作', async () => {
  seedCache();
  const response = await searchAnime(searchUrl(KEYWORD));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.animes.length, 1);
  const trace = createTrace('GET', '/api/v2/search/anime');
  assert.equal(trace.steps.length, 0);
});

for (const cacheHit of [true, false]) {
  test(`弹幕接口${cacheHit ? '命中' : '未命中'}缓存时仅在追踪展示中遮蔽地址凭据`, async t => {
    const source = getSourceByKey('tencent');
    const comments = [{ p: '1,1,16777215,qq', m: '缓存追踪测试' }];
    t.mock.method(source, 'getComments', async () => comments);
    t.mock.method(source, 'getSegmentComments', async () => comments);
    t.after(resetSearchState);
    const url = 'https://v.qq.com/x/cover/trace/episode.html?token=synthetic-token&sign=synthetic-sign&episode=1';

    for (const entry of ['id', 'url', 'segment']) {
      resetSearchState();
      useAsyncLocalStorage(AsyncLocalStorage);
      Globals.envs.logLevel = 'error';
      Globals.localCacheValid = false;
      Globals.redisValid = false;
      Globals.localRedisValid = false;
      assert.equal(addAnime({
        animeId: 9002, bangumiId: 'TRACE-CREDENTIALS-9002', animeTitle: '缓存追踪测试',
        source: 'tencent', links: [{ title: '【qq】第1集', url }],
      }), true);
      const id = Globals.animes[0].links[0].id;
      if (cacheHit) setCommentCache(url, comments);
      const trace = createTrace('GET', '/api/v2/comment');
      const response = await runWithTrace(trace, () => {
        if (entry === 'id') return getComment(`/api/v2/comment/${id}`, 'json', false);
        if (entry === 'url') return getCommentByUrl(url, 'json', false);
        return getSegmentComment({ url, type: 'qq', segment_start: 0, segment_end: 30 }, 'json');
      });
      assert.equal(response.status, 200, entry);
      assert.equal((await response.json()).count, 1, entry);
      const cacheStep = trace.steps.find(step => step.name.endsWith('缓存查询'));
      assert.equal(cacheStep.status, cacheHit ? 'hit' : 'miss', entry);
      assert.equal(cacheStep.inputs.cacheKey.includes('episode=1'), true, entry);
      assert.equal(getCommentCache(url).length, 1, '真实地址仍是缓存键');
      assert.doesNotMatch(JSON.stringify(trace), /synthetic-token|synthetic-sign/, entry);
    }
  });
}

test('主源失败后兜底结果与不完整搜索的缓存状态进入真实搜索追踪', async t => {
  resetSearchState();
  t.after(resetSearchState);
  useAsyncLocalStorage(AsyncLocalStorage);
  Globals.envs.logLevel = 'error';
  Globals.envs.sourceOrderArr = ['tencent'];
  Globals.envs.sourceFallbackOrderArr = ['iqiyi'];
  Globals.envs.searchTimeoutMs = 1000;
  Globals.localCacheValid = false;
  Globals.redisValid = false;
  Globals.localRedisValid = false;
  t.mock.method(getSourceByKey('tencent'), 'search', async () => { throw new Error('合成源故障'); });
  const fallback = getSourceByKey('iqiyi');
  t.mock.method(fallback, 'search', async () => [{ title: KEYWORD }]);
  t.mock.method(fallback, 'handleAnimes', async (_raw, _title, animes, details) => {
    const anime = {
      animeId: 9003, bangumiId: 'TRACE-FALLBACK-9003', animeTitle: KEYWORD,
      source: 'iqiyi', episodeCount: 1,
      links: [{ title: '【qiyi】第1集', url: 'https://www.iqiyi.com/trace.html' }],
    };
    addAnime(anime, details);
    animes.push(anime);
  });
  const trace = createTrace('GET', '/api/v2/search/anime');
  const response = await runWithTrace(trace, () => searchAnime(searchUrl(KEYWORD)));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.animes[0].source, 'iqiyi');
  assert.equal(body.searchIncomplete, true);
  const sources = trace.steps.find(step => step.name === '搜索·逐源检索');
  const rows = sources.changes.find(change => change.config === 'SOURCE_ORDER').table.rows;
  assert.deepEqual(rows.map(row => row.状态), ['失败', '成功']);
  assert.deepEqual(rows.map(row => row.保留), [0, 1]);
  const persistence = trace.steps.find(step => step.name === '搜索·持久化与响应');
  assert.equal(persistence.outputs.searchCacheWritten, false);
  assert.equal(Globals.searchCache.has(KEYWORD), false);
});
