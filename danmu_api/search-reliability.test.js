import test from 'node:test';
import assert from 'node:assert/strict';
import { Globals, globals } from './configs/globals.js';
import { searchAnime, searchEpisodes, getBangumi } from './apis/dandan-api.js';
import { refreshFavoriteByKeyword } from './apis/favorite-api.js';
import { getSourceByKey } from './sources/registry.js';
import { httpGet, httpPost, httpGetWithStreamCheck } from './utils/http-util.js';
import { addAnime, setSearchCache } from './utils/cache-util.js';
import { addFavorite } from './utils/favorite-util.js';
import { requestBudgetContext, runWithRequestBudget } from './utils/request-budget-util.js';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const searchUrl = (title = '光阴之外') => new URL(`https://test.invalid/api/v2/search/anime?keyword=${encodeURIComponent(title)}`);
const never = () => new Promise(() => {});

function reset(primary = ['tencent', 'iqiyi'], fallback = []) {
  Globals.init({ LOG_LEVEL: 'error' });
  Object.assign(Globals, {
    animes: [], episodeIds: [], episodeNum: 10001, searchCache: new Map(),
    commentCache: new Map(), favoriteCache: new Map(), lastSelectMap: new Map(),
    localCacheValid: false, redisValid: false, localRedisValid: false, aiValid: false,
  });
  globals.sourceOrderArr = primary;
  globals.sourceFallbackOrderArr = fallback;
  globals.searchTimeoutMs = 100;
}

function candidate(id, source, title = '光阴之外') {
  return { animeId: id, bangumiId: String(id), animeTitle: title, source, type: '动漫',
    episodeCount: 20, links: Array.from({ length: 20 }, (_, i) => ({
      url: `https://test.invalid/${source}/${id}/${i + 1}`, title: `【${source}】 第${i + 1}集`,
    })) };
}

async function withSources(definitions, run) {
  const restores = [];
  for (const [key, methods] of Object.entries(definitions)) {
    const instance = getSourceByKey(key);
    for (const [method, value] of Object.entries(methods)) {
      const original = Object.getOwnPropertyDescriptor(instance, method);
      instance[method] = value;
      restores.push(() => original ? Object.defineProperty(instance, method, original) : delete instance[method]);
    }
  }
  try { return await run(); } finally { restores.reverse().forEach(restore => restore()); }
}

function healthy(id, source, delay = 0) {
  return {
    search: async () => [{ title: '光阴之外' }],
    handleAnimes: async (_raw, _title, results, details) => {
      if (delay) await pause(delay);
      const anime = candidate(id, source);
      addAnime(anime, details);
      results.push(anime);
    },
  };
}

async function withFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await run(); } finally { globalThis.fetch = original; }
}

function stalledBody(_url, { signal }) {
  return new Response(new ReadableStream({
    start(controller) {
      const abort = () => controller.error(new DOMException('aborted', 'AbortError'));
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    },
  }), { headers: { 'content-type': 'application/json' } });
}

test('search reliability regressions', { timeout: 15000 }, async t => {
  for (const method of ['GET', 'POST']) {
    await t.test(`${method} timeout includes response body consumption`, { timeout: 1000 }, async () => {
      reset();
      await withFetch(stalledBody, async () => {
        const run = method === 'GET'
          ? httpGet('https://test.invalid/body', { timeout: 20 })
          : httpPost('https://test.invalid/body', '{}', { timeout: 20 });
        await assert.rejects(run, { name: 'AbortError' });
      });
    });
  }

  await t.test('completed HTTP bodies retain response and allowed-status semantics', async () => {
    reset();
    await withFetch(async () => new Response('{"ok":true}', { status: 404 }), async () => {
      for (const result of [
        await httpGet('https://test.invalid/body', { validStatusCodes: [404] }),
        await httpPost('https://test.invalid/body', '{}', { validStatusCodes: [404] }),
      ]) {
        assert.equal(result.status, 404);
        assert.deepEqual(result.data, { ok: true });
      }
    });
  });

  await t.test('deadline cancels retry backoff without launching another request', async () => {
    reset();
    let calls = 0;
    await withFetch(async () => { calls++; return new Response('{}', { status: 503 }); }, async () => {
      await assert.rejects(runWithRequestBudget(25, () => httpGet('https://test.invalid/retry', { retries: 3 })), { name: 'AbortError' });
      await pause(30);
      assert.equal(calls, 1);
    });
  });

  await t.test('external cancellation rejects before fetch', async () => {
    reset();
    const controller = new AbortController();
    controller.abort();
    await withFetch(() => assert.fail('cancelled requests must not start'), async () => {
      await assert.rejects(httpGet('https://test.invalid/', { signal: controller.signal }), { name: 'AbortError' });
      await assert.rejects(httpPost('https://test.invalid/', '{}', { signal: controller.signal }), { name: 'AbortError' });
    });
  });

  await t.test('stream probing inherits source cancellation', async () => {
    reset();
    await withFetch(stalledBody, async () => {
      await assert.rejects(runWithRequestBudget(20, () => httpGetWithStreamCheck('https://test.invalid/stream', { timeout: 1000 })), { name: 'AbortError' });
    });
  });

  await t.test('a stalled source cannot hold healthy results or populate full search cache', async () => {
    reset();
    await withSources({ tencent: { search: never }, iqiyi: healthy(101, 'iqiyi') }, async () => {
      const started = Date.now();
      const response = await searchAnime(searchUrl());
      const body = await response.json();
      assert.ok(Date.now() - started < 1000);
      assert.equal(response.status, 200);
      assert.deepEqual(body.animes.map(a => a.animeId), [101]);
      assert.equal(body.searchIncomplete, true);
      assert.equal(globals.searchCache.has('光阴之外'), false);
      const details = await (await getBangumi('/api/v2/bangumi/101')).json();
      assert.equal(details.bangumi.episodes.length, 20);
    });
  });

  await t.test('primary deadline reserves time for fallback; fallback is not duplicated', async () => {
    reset(['tencent'], ['tencent', 'youku', 'youku']);
    const calls = [];
    const youku = healthy(102, 'youku');
    youku.search = async () => { calls.push('youku'); return []; };
    await withSources({ tencent: { search: () => { calls.push('tencent'); return never(); } }, youku }, async () => {
      const body = await (await searchAnime(searchUrl())).json();
      assert.deepEqual(calls, ['tencent', 'youku']);
      assert.deepEqual(body.animes.map(a => a.animeId), [102]);
      assert.equal(body.searchIncomplete, true);
    });
  });

  await t.test('healthy sources preserve configured order, skip fallback, cache details and find episode 20', async () => {
    reset(['tencent', 'iqiyi'], ['youku']);
    await withSources({ tencent: healthy(103, 'tencent', 10), iqiyi: healthy(104, 'iqiyi'), youku: { search: () => assert.fail('unneeded fallback') } }, async () => {
      const body = await (await searchAnime(searchUrl())).json();
      assert.deepEqual(body.animes.map(a => a.animeId), [103, 104]);
      assert.equal(body.searchIncomplete, false);
      assert.ok(body.animes.every(a => !('links' in a)));
      assert.equal(globals.searchCache.get('光阴之外').results.length, 2);
      const episodeResult = await (await searchEpisodes(new URL('https://test.invalid/api/v2/search/episodes?anime=光阴之外&episode=20'))).json();
      assert.equal(episodeResult.animes.length, 2);
      assert.ok(episodeResult.animes.every(a => a.episodes.length === 1 && a.episodes[0].episodeTitle.includes('第20集')));
    });
  });

  await t.test('late handlers cannot write shared state, launch requests, or evict healthy cache', async () => {
    reset();
    let release, lateFinished;
    const gate = new Promise(resolve => { release = resolve; });
    const done = new Promise((resolve, reject) => { lateFinished = error => error ? reject(error) : resolve(); });
    await withSources({ tencent: {
      search: async () => [],
      handleAnimes: async () => {
        await gate;
        try {
          assert.throws(() => addAnime(candidate(999, 'tencent')), { name: 'AbortError' });
          assert.throws(() => setSearchCache('late', []), { name: 'AbortError' });
          await assert.rejects(httpGet('https://test.invalid/late'), { name: 'AbortError' });
          lateFinished();
        } catch (error) { lateFinished(error); }
      },
    }, iqiyi: healthy(105, 'iqiyi') }, async () => {
      const searching = searchAnime(searchUrl(), null, null, null, null, true);
      await pause(20);
      setSearchCache('光阴之外', [{ animeId: 777 }]); // another request completed first
      await searching;
      assert.equal(globals.searchCache.get('光阴之外').results[0].animeId, 777);
      await withFetch(() => assert.fail('late request escaped cancellation'), async () => {
        release(); await done;
      });
      assert.ok(!globals.animes.some(a => a.animeId === 999));
      assert.equal(globals.searchCache.has('late'), false);
    });
  });

  await t.test('all timed-out sources return an explicit failure rather than a cached empty search', async () => {
    reset(['tencent'], ['youku']);
    await withSources({ tencent: { search: never }, youku: { search: never } }, async () => {
      const started = Date.now();
      const response = await searchAnime(searchUrl());
      const body = await response.json();
      assert.ok(Date.now() - started < 1000);
      assert.equal(response.status, 503);
      assert.equal(body.success, false);
      assert.equal(body.searchIncomplete, true);
      assert.equal(globals.searchCache.size, 0);
    });
  });

  await t.test('ordinary empty searches remain successful and uncached', async () => {
    reset(['tencent']);
    await withSources({ tencent: { search: async () => [], handleAnimes: async () => {} } }, async () => {
      const response = await searchAnime(searchUrl());
      assert.equal(response.status, 200);
      assert.equal((await response.json()).success, true);
      assert.equal(globals.searchCache.size, 0);
    });
  });

  await t.test('episode search preserves a source-deadline failure instead of turning it into no results', async () => {
    reset(['tencent']);
    await withSources({ tencent: { search: never } }, async () => {
      const response = await searchEpisodes(new URL('https://test.invalid/api/v2/search/episodes?anime=光阴之外&episode=20'));
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.searchIncomplete, true);
    });
  });

  await t.test('cross-season expansion shares the search deadline', async () => {
    reset(['tencent']);
    await withSources({ tencent: {
      search: async () => [{ title: '光阴之外 第2季' }],
      handleAnimes: async (_raw, _title, results, details, season) => {
        if (season === 2) await never();
        else {
          const anime = candidate(108, 'tencent');
          anime.links = anime.links.slice(0, 1);
          anime.episodeCount = 1;
          addAnime(anime, details);
          results.push(anime);
        }
      },
    } }, async () => {
      const url = searchUrl(); url.searchParams.set('season', '1'); url.searchParams.set('episode', '20');
      const response = await searchAnime(url);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).searchIncomplete, true);
      assert.equal(globals.searchCache.size, 0);
    });
  });

  await t.test('partial refresh does not replace an existing favorite', async () => {
    reset();
    globals.deployPlatform = 'node';
    const original = candidate(106, 'iqiyi');
    addFavorite('光阴之外', [original], [original]);
    const snapshot = structuredClone(globals.favoriteCache.get('光阴之外'));
    await withSources({ tencent: { search: never }, iqiyi: healthy(107, 'iqiyi') }, async () => {
      await assert.rejects(refreshFavoriteByKeyword('光阴之外', searchUrl(), { persist: false }), { status: 503 });
      assert.deepEqual(globals.favoriteCache.get('光阴之外'), snapshot);
    });
  });

  await t.test('request scopes isolate cancellation and respect parent deadlines', async () => {
    reset();
    let childSignal;
    await assert.rejects(runWithRequestBudget(20, () => runWithRequestBudget(1000, () => {
      childSignal = requestBudgetContext.getStore().signal; return never();
    })), { name: 'AbortError' });
    assert.equal(childSignal.aborted, true);
    assert.equal(requestBudgetContext.getStore(), undefined);
    assert.equal(await runWithRequestBudget(100, async () => 'healthy'), 'healthy');
  });
});
