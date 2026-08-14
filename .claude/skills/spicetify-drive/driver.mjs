// Drives the Spotify desktop client over the Chrome DevTools Protocol.
//
//   node driver.mjs <script.mjs> [--endpoint http://127.0.0.1:8088]
//
// The script must default-export an async function taking the driver object.
// Node's built-in WebSocket does the work, so there is nothing to install.
//
//   export default async (d) => {
//     console.log(await d.eval(`Spicetify.Player.data?.item?.name`));
//   };

import { writeFileSync } from 'node:fs';

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const endpoint = arg('--endpoint', 'http://127.0.0.1:8088');
const scriptPath = process.argv[2];

if (!scriptPath || scriptPath.startsWith('--')) {
  console.error('usage: node driver.mjs <script.mjs> [--endpoint URL]');
  process.exit(1);
}

// Spotify may still be booting, especially right after `spicetify apply` and a
// relaunch, so poll rather than failing on the first refused connection.
let page;
for (let i = 0; i < 40; i += 1) {
  try {
    const targets = await (await fetch(`${endpoint}/json`)).json();
    page = targets.find((t) => t.url.includes('xpui.app.spotify.com'));
    if (page) break;
  } catch {
    // not listening yet
  }
  await new Promise((r) => setTimeout(r, 1000));
}

if (!page) {
  console.error(`No xpui target at ${endpoint} after 40s.`);
  console.error('Is Spotify running, and is always_enable_devtools = 1 in config-xpui.ini?');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const consoleLines = [];

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);

  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args
      .map((a) => a.value ?? a.description ?? a.unserializableValue ?? '?')
      .join(' ');
    consoleLines.push(`[${msg.params.type}] ${text}`);
    return;
  }

  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
  else p.resolve(msg.result);
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = (nextId += 1);
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

const boxOf = async (selector) => {
  const box = await d.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!box) throw new Error(`no element matched ${selector}`);
  return box;
};

const d = {
  send,
  consoleLines,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),

  /** Evaluate an expression in the page and return it by value. Awaits promises. */
  async eval(expression) {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    if (r.exceptionDetails) {
      const e = r.exceptionDetails;
      throw new Error(`eval failed: ${e.exception?.description ?? e.text}`);
    }
    return r.result?.value;
  },

  /** Poll an expression until it is truthy. Returns its value, throws on timeout. */
  async waitFor(expression, { timeout = 10000, interval = 200 } = {}) {
    const deadline = Date.now() + timeout;
    for (;;) {
      const value = await this.eval(expression);
      if (value) return value;
      if (Date.now() > deadline) throw new Error(`waitFor timed out: ${expression}`);
      await this.sleep(interval);
    }
  },

  /**
   * A non-printable key (Escape, ArrowDown, Tab...). Pass the DOM key name and
   * its keyCode: ArrowUp 38, ArrowDown 40, Enter 13, Escape 27, Tab 9,
   * Backspace 8.
   *
   * Enter is special-cased. A rawKeyDown suppresses the keypress, and without
   * that Chromium never runs a form's default submit -- so Enter needs a real
   * keyDown carrying \r or nothing happens.
   */
  async key(key, keyCode) {
    const base = {
      key,
      code: key,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
    };
    if (key === 'Enter') {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', text: '\r', ...base });
    } else {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
    }
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  },

  /**
   * Type printable text. Each character is a lone 'char' event: pairing it with
   * a keyDown that also carries `text` inserts every character twice.
   *
   * Real events matter here -- assigning to input.value directly does not drive
   * a React controlled input, and React is what Spotify's UI is built on.
   */
  async type(str, perCharDelay = 40) {
    for (const ch of str) {
      await send('Input.dispatchKeyEvent', { type: 'char', text: ch });
      await this.sleep(perCharDelay);
    }
  },

  /** Empty a React-controlled input, firing the input event React listens for. */
  async clear(selector) {
    await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('no element matched ' + ${JSON.stringify(selector)});
      // A [class*=...] selector matches the wrapper as well as the field, and the
      // wrapper wins on document order. Say so, rather than letting the value
      // setter below fail with a bare "Illegal invocation".
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        throw new Error(${JSON.stringify(selector)} + ' matched <' + el.tagName.toLowerCase() +
          '>, not an input -- lead the selector with the tag');
      }
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  },

  async click(selector) {
    const { x, y } = await boxOf(selector);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
  },

  /** Click by visible text, for buttons without a stable selector. */
  async clickText(text, tag = 'button') {
    const box = await this.eval(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(tag)})]
        .find((n) => n.textContent.trim() === ${JSON.stringify(text)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    if (!box) throw new Error(`no ${tag} with text ${JSON.stringify(text)}`);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
  },

  /**
   * Scroll over an element. Useful for overscroll and scroll-chaining checks.
   *
   * Wheel input is handled by the compositor, which does not run while the
   * window is hidden -- the event then neither scrolls nor gets acknowledged,
   * so an awaited dispatch hangs forever. Key and click events are unaffected,
   * which makes this look like wheel alone being broken. Fail fast instead.
   */
  async wheel(selector, deltaY, deltaX = 0) {
    if (await this.eval('document.hidden')) {
      throw new Error(
        'the Spotify window is hidden, so wheel events are not processed -- '
        + 'bring it to the front before scroll checks',
      );
    }
    const { x, y } = await boxOf(selector);
    await Promise.race([
      send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error('mouseWheel was not acknowledged within 5s')), 5000,
      )),
    ]);
  },

  async shot(path) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(data, 'base64'));
    return path;
  },
};

await send('Runtime.enable');
await send('Page.enable');

try {
  await (await import(scriptPath.startsWith('.') || scriptPath.startsWith('/')
    ? new URL(scriptPath, `file://${process.cwd()}/`).href
    : scriptPath)).default(d);
} finally {
  ws.close();
}
