import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { get } from 'node:http';
import { setTimeout } from 'node:timers/promises';

let child;
let base;
let output = '';
before(async () => {
  const portProbe = createServer();
  portProbe.listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const port = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['dist/server.mjs', '--production'], {
    env: { ...process.env, PORT: String(port), OPENAI_API_KEY: '', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Servidor encerrou: ${output}`);
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await setTimeout(100);
  }
  throw new Error(`Servidor não iniciou: ${output}`);
});
after(async () => {
  if (child && child.exitCode === null) {
    const ended = once(child, 'exit');
    child.kill();
    await ended;
  }
});

test('inicia sem chave e informa modo manual', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.deepEqual(await response.json(), { ok: true, aiConfigured: false });
});
test('serve a interface e seus assets em produção', async () => {
  const response = await fetch(base);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /AutoStamp PDF/);
  const asset = html.match(/src="([^" ]+\.js)"/)[1];
  assert.equal((await fetch(`${base}${asset}`)).status, 200);
});
test('não faz análise automática sem chave', async () => {
  const response = await fetch(`${base}/api/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /OPENAI_API_KEY/);
});
test('recusa requisições de outra origem web', async () => {
  const response = await fetch(`${base}/api/analyze`, {
    method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 403);
});
test('recusa host externo mesmo apontando para loopback', async () => {
  const status = await new Promise((resolve, reject) => {
    get(`${base}/api/health`, { headers: { Host: 'example.com' } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(status, 403);
});
test('não serve código do servidor nem variáveis de ambiente', async () => {
  for (const route of ['/server.mjs', '/.env.local']) {
    const body = await (await fetch(`${base}${route}`)).text();
    assert.doesNotMatch(body, /process\.env|OPENAI_API_KEY=/);
  }
});
