import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { Globals } from '../danmu_api/configs/globals.js';

test('standalone Forward bundle runs without Node modules or server storage', async () => {
  const code = await fs.readFile(new URL('../dist/logvar-danmu.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {}, info() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Widget: { http: {}, storage: { get() { return null; }, set() {}, remove() {} } },
  });
  new vm.Script(code).runInContext(context, { timeout: 5000 });
  assert.equal(context.WidgetMetadata.version, Globals.VERSION);
  for (const name of ['searchDanmu', 'getDetailById', 'getCommentsById', 'getDanmuWithSegmentTime']) {
    assert.equal(typeof context[name], 'function', name);
  }
  assert.equal(context.process, undefined);
  assert.equal(context.require, undefined);
  const rows = await new vm.Script("getSourceByKey('local').search('测试剧集')").runInContext(context);
  assert.equal(rows.length, 0);
  const fallback = await new vm.Script("findLocalDanmu({ title: '测试剧集' })").runInContext(context);
  assert.equal(fallback, null);
});
