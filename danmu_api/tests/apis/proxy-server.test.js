import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the actual proxy factory without starting the main server, reading .env,
// watching configuration, or initializing persistent production storage.
const serverSource = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
const start = serverSource.indexOf('function createProxyServer() {');
const end = serverSource.indexOf('\n/**', start);
assert.ok(start >= 0 && end > start);
const createProxyServer = vm.runInNewContext(
  `${serverSource.slice(start, end)}; createProxyServer`,
  { http, https, URL, process: { env: {} }, console: { log() {}, error() {} } },
);

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('local proxy preserves POST bytes and waits for a response after request completion', { timeout: 5000 }, async t => {
  const upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    setTimeout(() => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ method: req.method, body: Buffer.concat(chunks).toString('utf8') }));
    }, 30);
  });
  const proxy = createProxyServer();
  t.after(() => { proxy.closeAllConnections(); proxy.close(); upstream.closeAllConnections(); upstream.close(); });
  const target = await listen(upstream);
  const proxyUrl = await listen(proxy);
  const payload = JSON.stringify({ title: '弹幕测试', page: 2 });
  const result = await new Promise((resolve, reject) => {
    const req = http.request(`${proxyUrl}/proxy?url=${encodeURIComponent(target + '/search')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    }, async res => {
      const chunks = [];
      for await (const chunk of res) chunks.push(chunk);
      resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) });
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('proxy response timed out')));
    const bytes = Buffer.from(payload);
    req.write(bytes.subarray(0, 13));
    req.end(bytes.subarray(13));
  });
  assert.deepEqual(result, { status: 200, body: { method: 'POST', body: payload } });
});

test('local proxy returns an error when upstream resets a connected client request', { timeout: 5000 }, async t => {
  const upstream = http.createServer(req => req.socket.destroy());
  const proxy = createProxyServer();
  t.after(() => { proxy.closeAllConnections(); proxy.close(); upstream.closeAllConnections(); upstream.close(); });
  const target = await listen(upstream);
  const proxyUrl = await listen(proxy);
  const response = await fetch(`${proxyUrl}/proxy?url=${encodeURIComponent(target)}`, { signal: AbortSignal.timeout(2000) });
  assert.equal(response.status, 500);
  assert.match(await response.text(), /Proxy Error/);
});
