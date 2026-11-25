import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const WIDTH = 1440;
const HEIGHT = 900;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForWs(timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(150);
  }
  throw new Error('Timed out waiting for Chrome DevTools target');
}

function connectCdp(wsUrl) {
  return new Promise((resolveConn, rejectConn) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    ws.addEventListener('open', () => {
      resolveConn({
        send(method, params = {}) {
          const id = nextId++;
          return new Promise((res, rej) => {
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      }
    });
    ws.addEventListener('error', rejectConn);
  });
}

async function run() {
  const outHtml = resolve('out/dashboard/index.html');
  const baseUrl = pathToFileURL(outHtml).href;
  const shotsDir = resolve('screenshots');
  mkdirSync(shotsDir, { recursive: true });
  const profileDir = mkdtempSync(join(tmpdir(), 'radar-chrome-'));

  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    `--window-size=${WIDTH},${HEIGHT}`,
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const wsUrl = await waitForWs();
    const cdp = await connectCdp(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const capture = async (hash, fileName) => {
      const targetUrl = hash ? `${baseUrl}#${hash}` : baseUrl;
      await cdp.send('Page.navigate', { url: 'about:blank' });
      await sleep(100);
      await cdp.send('Page.navigate', { url: targetUrl });
      await sleep(700);
      const check = await cdp.send('Runtime.evaluate', {
        expression: 'document.getElementById("app").children.length',
        returnByValue: true,
      });
      if (!check?.result?.value) {
        throw new Error(`Dashboard rendered empty on ${fileName}`);
      }
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const outPath = join(shotsDir, fileName);
      writeFileSync(outPath, Buffer.from(data, 'base64'));
      const size = statSync(outPath).size;
      console.log(`Captured ${fileName}: ${size} bytes`);
    };

    await capture('', '1-board.png');
    await capture('p=bittensor-dtao', '2-detail.png');
    await capture('category=Dexs&scope=early', '3-filtered.png');
    cdp.close();
  } finally {
    chrome.kill('SIGTERM');
    await sleep(400);
    try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
