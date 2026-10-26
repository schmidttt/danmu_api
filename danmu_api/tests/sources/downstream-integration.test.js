import test from 'node:test';
import assert from 'node:assert/strict';
import { Globals } from '../../configs/globals.js';
import HongguoSource, { HONGGUO_WEB_TIMEOUT_MS } from '../../sources/hongguo.js';
import { fetchTencentDanmuSegments } from '../../sources/tencent.js';
import SohuSource from '../../sources/sohu.js';
import { withMockFetch } from '../helpers/context.js';

test('Tencent deadline cancels a bounded batch without starting queued shards later', async () => {
  const started = [];
  const segments = Array.from({ length: 5 }, (_, index) => ({ url: String(index) }));
  const result = await fetchTencentDanmuSegments(segments, {
    concurrency: 2,
    deadlineMs: 30,
    request: async (url, { signal }) => {
      started.push(url);
      if (url === '0') return { data: { barrage_list: [{ content: 'healthy' }] } };
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
      });
    },
  });
  assert.equal(result.timedOut, true);
  assert.deepEqual(started, ['0', '1']);
  assert.equal(result.results.find(item => item.status === 'fulfilled').value.data.barrage_list[0].content, 'healthy');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(started, ['0', '1']);
});

test('Hongguo uses the new search API with bounded requests and deduplicates pages', async () => {
  Globals.init({ LOG_LEVEL: 'error' });
  const source = new HongguoSource();
  source.request = async () => { throw new Error('complete web results must not use app fallback'); };
  const pages = [];
  const item = id => ({ video_data: { series_id: id, series_name: `剧${id}`, episode_cnt: 2 } });
  const results = await withMockFetch(async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/api/search/result/');
    assert.equal(url.searchParams.get('query'), '短剧');
    const page = Number(url.searchParams.get('page'));
    pages.push(page);
    assert.ok(options.signal, 'request must retain its timeout/abort signal');
    return new Response(JSON.stringify({ searchList: page === 1 ? [item('1')] : page === 2 ? [item('1'), item('2')] : [] }), {
      headers: { 'content-type': 'application/json' },
    });
  }, () => source.search('短剧'));
  assert.deepEqual(pages, [1, 2, 3]);
  assert.deepEqual(results.map(item => item.seriesId), ['1', '2']);
  assert.equal(HONGGUO_WEB_TIMEOUT_MS, 5000);
});

test('Sohu decimal colors remain native, while color conversion receives a white input', () => {
  const source = new SohuSource();
  const input = [{ c: '弹幕', t: { c: '16711680' }, v: 1 }];
  Globals.init({ CONVERT_COLOR: 'default' });
  const native = source.formatComments(input);
  assert.equal(Number(native[0].p.split(',')[3]), 16711680);
  Globals.init({ CONVERT_COLOR: 'color' });
  const converted = source.formatComments(input);
  assert.equal(Number(converted[0].p.split(',')[3]), 16777215);
});
