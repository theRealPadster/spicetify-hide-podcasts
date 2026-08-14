---
name: spicetify-drive
description: Attach to the running Spotify desktop client over the Chrome DevTools Protocol to inspect or drive it — read Spicetify internals, measure computed styles and geometry, check what this extension is actually hiding, dispatch real key/mouse/wheel input, and take screenshots. Also covers the build → copy → refresh → reload → attach loop for testing working-tree changes to this extension in the real client. Use when a claim about Spotify's DOM needs verifying rather than guessing (does this selector match, is that element hidden by us or absent for this account, which element receives this click), or when the user asks to run, test, or screenshot the extension in Spotify.
---

# Driving Spotify over the debug port

Spotify is Chromium, so it speaks the DevTools Protocol. That turns guesses about
its DOM into measurements. Reach for this whenever the honest answer would
otherwise be "probably" — hashed class names, computed styles, hit testing,
whether a selector matches anything on a page you cannot see.

This repo ships an **extension**, not a custom app. That changes the build loop and
the "am I looking at the new code" check below; both differ from the custom-app
version of this skill in the sibling `name-that-tune` repo.

CLAUDE.md's "Verifying against a live client" section is the *methodology* — drive
the UI that renders the thing, use `getComputedStyle` not `innerText`, A/B the body
classes. This skill is the *mechanics* for carrying it out.

## Preconditions

The endpoint only exists if devtools are enabled:

```bash
grep always_enable_devtools "$(spicetify -c)"   # want: = 1
```

If it is `0`: `spicetify enable-devtools`, then relaunch Spotify.

**The port is 8088, not the usual 9222.** There is no `--remote-debugging-port`
flag on the process, so do not go looking for one.

```bash
curl -s http://127.0.0.1:8088/json/version   # confirms the client is reachable
curl -s http://127.0.0.1:8088/json | python3 -m json.tool   # find the xpui target
```

## Inspecting vs driving

### Inspect — cheap, do this freely

Attaching changes nothing. No build, no restart, no disruption. Use it constantly.

```bash
node .claude/skills/spicetify-drive/driver.mjs ./probe.mjs
```

```js
// probe.mjs
export default async (d) => {
  console.log(await d.eval(`document.querySelectorAll('a[href^="/show/"]').length`));
};
```

Good for: does this selector match anything on the current page; is that element
hidden by us or simply absent; what are the computed styles; what does
`document.elementFromPoint` return; what is in the console (the extension logs
verbosely under `HidePodcasts:` and `=== … ===`).

Note it inspects **the installed build**, which is a separate copy from the working
tree — `build:local` writes to the repo root, not into the Extensions folder. Three
copies exist and drift independently:

```bash
ls -la hidePodcasts.js                                          # working tree build
ls -la "$(dirname "$(spicetify -c)")/Extensions/hidePodcasts.js"  # installed
ls -la /Applications/Spotify.app/Contents/Resources/Apps/xpui/extensions/hidePodcasts.js  # what runs
```

Only the third one is what the client executes. Compare checksums before drawing
conclusions from a measurement.

### Drive — build, copy, refresh, reload

Four steps, and skipping either of the last two is the classic mistake:

```bash
pnpm build:local                                                   # -> ./hidePodcasts.js
cp hidePodcasts.js "$(dirname "$(spicetify -c)")/Extensions/"      # -> installed copy
spicetify refresh -e                                               # -> into Spotify.app; PID unchanged
                                                                   # then reload the client -- see below
```

Spotify keeps running throughout, so playback survives. The reload does blank the
UI mid-use, so say what you are doing rather than cycling this repeatedly while the
user watches.

**The copy step is easy to forget** because the custom-app version of this loop does
not need one — `spicetify-creator` builds a custom app straight into its live folder,
but `build:local` here targets the repo root, since the built bundle is a committed
artifact. `refresh` copies from `~/.config/spicetify/Extensions/`, so without the
`cp` it faithfully re-copies the *old* build and reports success.

**`-e`, not `-a`.** Measured on this machine by appending a marker to the installed
copy and grepping for it inside `Spotify.app`:

| command | marker reached Spotify.app |
|---|---|
| `spicetify refresh -a` | no |
| `spicetify refresh -e` | yes |
| `spicetify refresh -a -e` | yes |

`-a` is for `CustomApps/` and does nothing for this repo while still printing
`success`. Note this is the mirror image of the name-that-tune skill's rule, and
that `-a -e` works here even though it was measured as copying *neither* there — so
do not carry that combined-flag warning across. Plain `-e` is the one to use.

`-l` is a `watch` flag that `refresh` quietly treats as `-e`.

**Copying the files is not enough, and the failure is silent.** The running renderer
keeps serving the bundle it already parsed, so measuring before a reload measures
the **old** build while the correct file sits on disk — indistinguishable from a fix
that did not work.

### Confirming you are on the new build

The extension's compiled SCSS is injected as an **inline `<style id="hidePodcasts">`
with no `href`**, so any check that filters `document.styleSheets` by `s.href` finds
nothing and returns `undefined` — which reads as "the rule is gone" rather than "the
check is wrong". Go through the style element instead:

```js
await d.eval(`(() => {
  const el = document.getElementById('hidePodcasts');
  if (!el) return 'NO STYLE ELEMENT';   // extension did not load at all
  for (const r of el.sheet.cssRules) {
    if (/podcast-item/.test(r.selectorText || '')) return r.cssText;
  }
  return 'rule not found';
})()`);
// -> ".hide-podcasts-enabled .podcast-item { display: none !important; }"
```

`util.ts` injects two more style elements at runtime,
`hide-podcasts-chip-styles` and `hide-audiobooks-chip-styles`. Their absence is not
necessarily a bug — they are only written when matching chips are found.

A full apply **is** required after Spotify itself updates: the update replaces
`Spotify.app` and takes the patch with it, so the extension stops loading and the
debug port stops answering. Take a fresh backup in the same breath, because the
existing one describes the previous Spotify. Apply quits the client and does not
relaunch it:

```bash
spicetify backup apply && open -a Spotify && sleep 14
```

To tell whether the backup matches the installed client — and so whether this has
already been done — compare the version Spicetify recorded against the running one:

```bash
grep -A1 '^\[Backup\]' "$(spicetify -c)"      # version = 1.2.96.518.g366879e1
defaults read /Applications/Spotify.app/Contents/Info.plist CFBundleVersion
```

`always_enable_devtools` lives in the config and survives the update, but the patch
that acts on it does not, so the port comes back with the re-apply rather than
needing `enable-devtools` run again.

## Reloading

```js
const reload = async (d, safeRoute = '/collection/tracks') => {
  // Park somewhere stock, so the reload does not restore a custom-app route.
  await d.eval(`Spicetify.Platform.History.push({ pathname: ${JSON.stringify(safeRoute)} })`)
    .catch(() => {});
  await d.eval(`new Promise(r => setTimeout(r, 1500))`).catch(() => {});

  await d.send('Page.enable', {}).catch(() => {});
  await d.send('Page.reload', { ignoreCache: true });

  // Wait on the extension, NOT on Spicetify.Platform -- see below.
  await d.waitFor(`document.body.classList.contains('hide-podcasts-enabled') ? 1 : 0`,
    { timeout: 40000 });
};
```

**Do not gate on `window.Spicetify && Spicetify.Platform`.** It is already truthy on
the *outgoing* page, so `waitFor` returns in the same second the reload is issued,
before navigation has committed — and everything measured after it describes the old
document. Measured here: `Platform back` at `20:57:02`, the extension's body class
at `20:57:04`. Gate on something this extension owns, which by definition only exists
once it has re-run: the `hide-podcasts-enabled` body class, or `#hidePodcasts`.

If the toggle is off, gate on `#hidePodcasts` instead — the body class will never
appear.

**Park on a stock route first.** Spotify restores the last route on startup, and
restoring *any* Spicetify custom-app route can land on "Something went wrong" — a
route-level error boundary inside `.Root__main-view`, not a dead client. This repo
ships no route of its own, but `marketplace`, `name-that-tune`, `ncs-visualizer`,
`stats` and `library` are installed on this machine, so it is reachable. The boundary
latches and reloading restores the failed route, so every reload lands back on it.

Two consequences:

- **Scope any health check to the main view.** `document.body.innerText` cannot tell
  a dead client from one bad route, because the body contains both the boundary and
  the working chrome. `Spicetify` being present proves nothing either.
- The worse variant is the client never finishing boot — no `.Root__main-view`, no
  `Spicetify.Locale`. No amount of reloading recovers it; quit and relaunch Spotify.

`spicetify restart` is the heavier fallback — but it **quits Spotify without
relaunching it**, so follow it with `open -a Spotify` and wait for the port.

## Side effects, and putting things back

### Never play a podcast or audiobook

**Hard rule, no exceptions, and it is not recoverable by restoring state.** Do not
click a podcast or audiobook row, do not call `Spicetify.Player.playUri` on a
`spotify:show:`, `spotify:episode:` or audiobook URI, and do not trigger a play
button on one. Playing one feeds Spotify's recommendation model; the account owner
has deliberately never played this content precisely so it stays out of their
recommendations, and there is no undo.

This is a real hazard here rather than a hypothetical, because every interesting
test target *is* a podcast or audiobook row. Test against them without playing them:

- Navigate by URL (`History.push` to `/search/<query>`) instead of clicking through.
- Count, measure and screenshot rows; do not activate them.
- To confirm a row is the right one, read its `href` or subtitle text — not a click.
- If a check seems to need playback, it does not. Say what you could not verify.

Searching for podcast *terms* is fine — it puts rows on screen without any play
event. Clicking is where the line is.

Driving a real client leaves marks. Save state first, restore after, and tell the
user what moved:

```js
const before = await d.eval(`({
  pathname: Spicetify.Platform.History.location.pathname,
  enabled: localStorage.getItem('HidePodcastsEnabled'),
  aggressive: localStorage.getItem('HidePodcastsAggressiveMode'),
  audiobooks: localStorage.getItem('HidePodcastsHideAudioBooks'),
})`);
```

Those three keys are the extension's entire state. Restore any you changed, then
navigate back.

**Toggling aggressive mode calls `location.reload()`** (`src/app.tsx`), so flipping it
from a probe reloads the client out from under you — the observer lifetime differs, so
this is deliberate, not a bug. Flip the other two freely; they only swap body classes
and re-tag.

Playback position and the current track generally cannot be restored — say so rather
than implying it was.

To try a **light theme** without touching the user's actual theme, override the
Spicetify vars inline and remove them afterwards:

```js
await d.eval(`(() => { const s = document.documentElement.style;
  s.setProperty('--spice-main', '#ffffff'); s.setProperty('--spice-text', '#121212'); })()`);
// ... screenshot ...
await d.eval(`['--spice-main','--spice-text'].forEach(p => document.documentElement.style.removeProperty(p))`);
```

## Gotchas

Every one of these cost real debugging time, and every one presents as a bug in the
extension rather than in the harness. Rule out the harness first.

**Navigation**

- **`History.push` to the route you are already on does not re-fire
  `History.listen`.** The extension hangs all of its per-page work off that listener,
  so nothing re-applies and the body classes look stale — which reads as the
  extension failing. Navigate away and back to test that path for real.
- Search results live at `/search/<query>`. Pushing straight to
  `/search/joe%20rogan` works and is far cheaper than typing, but it exercises a
  different code path from a user typing into the box; do both if the bug is about
  the search dropdown.

**Input**

- **Printable characters must be a lone `char` event.** Pairing `char` with a
  `keyDown` that also carries `text` types everything twice — `bohem` arrives as
  `bboohheemm`. `d.type()` handles this.
- **Enter needs a real `keyDown` with `text: '\r'`.** A `rawKeyDown` suppresses the
  keypress, so Chromium never runs the default submit. `d.key('Enter', 13)` handles it.
- **Dispatch real events, never `el.value = x`.** Spotify's UI is React, and assigning
  to `value` does not drive a controlled input.
- `input[role=combobox]` is Spotify's main search bar — which here is a *feature*, not
  a collision: it is how you populate `#search-dropdown`, which only exists once
  something is typed.

**Selectors**

- **`d.clickText` matches the full trimmed text, not a prefix.** Filter chips carry
  localized labels that can grow suffixes, and that reads as the chip having
  vanished. Prefer `aria-label` or `href` matching, which is what the extension
  itself does.
- Do not trust hashed class names in a probe any more than in a stylesheet;
  `.x-categoryCard-CategoryCard` became `Wz3dEPV2mIQW7nLE`. Match on `href`.

**Window state**

- **Wheel events need a visible window; key and click events do not.** Scrolling is
  handled by the compositor, which stops when the window is hidden or minimised, so
  an awaited dispatch hangs forever. Because everything else keeps working, this
  reads as `d.wheel` alone being broken. Bring Spotify to the front for scroll
  checks — and you will need them, since search results stream in on scroll:

  ```js
  await d.eval(`({ hidden: document.hidden, visibility: document.visibilityState })`);
  ```

## Driver API

`driver.mjs` needs no dependencies (Node's built-in `WebSocket`). Your script
default-exports an async function taking `d`:

| | |
|---|---|
| `d.eval(expr)` | evaluate in the page, by value, awaits promises |
| `d.waitFor(expr, {timeout})` | poll until truthy |
| `d.type(str, delay?)` | printable text as real key events |
| `d.key(name, keyCode)` | ArrowUp 38, ArrowDown 40, Enter 13, Escape 27, Tab 9 |
| `d.clear(selector)` | empty a React-controlled input |
| `d.click(selector)` / `d.clickText(text, tag?)` | real mouse events |
| `d.wheel(selector, deltaY)` | for scrolling content into existence |
| `d.shot(path)` | PNG screenshot |
| `d.consoleLines` | captured console output |
| `d.send(method, params)` | any raw CDP call |

**`d.eval` has no timeout.** It sets `awaitPromise`, so an expression whose promise
never settles hangs the whole run with no output — and if you piped through `tail`,
no partial output either, which looks like the client being stuck rather than your
own probe. Log progress with timestamps in any probe that does more than a couple of
steps, so a hang points at the step rather than the harness.

## Worked checks

**Is this hidden by us, or absent for this account?** The question CLAUDE.md warns
about. A/B the body class from the same probe, and test visibility with
`checkVisibility()` — not `getComputedStyle`, for the reason below:

```js
const count = (sel) => `document.querySelectorAll(${JSON.stringify(sel)}).length`;
const shown = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})]
  .filter(el => el.checkVisibility()).length`;

const sel = 'a[href^="/show/"]';
const on  = await d.eval(`({ total: ${count(sel)}, shown: ${shown(sel)} })`);
await d.eval(`document.body.classList.remove('hide-podcasts-enabled')`);
const off = await d.eval(`({ total: ${count(sel)}, shown: ${shown(sel)} })`);
await d.eval(`document.body.classList.add('hide-podcasts-enabled')`);
// off.shown > on.shown  -> we are hiding them
// off.shown === 0       -> the account has none here; the selector proves nothing
```

Measured on `/search/joe rogan`: 10 `/show/` anchors, 0 visible with the class on
and 8 with it off.

Never use `innerText` for this: hidden elements return empty text, so a text scan
reports the extension's own success as absence.

**And do not use per-element `getComputedStyle` either.** The extension hides
*ancestors* — `.podcast-item` on the row, shelves via `:has()` — and computed style
is not inherited for `display`, so a descendant of a `display: none` row still
reports its own `display: inline`. The same probe as above, scored with
`getComputedStyle(el).display !== 'none'`, returned **10 of 10 visible in both
states**: a clean false negative that reads as the extension being broken.

| scoring method | class on | class off |
|---|---|---|
| `el.checkVisibility()` | 0 | 8 |
| `getBoundingClientRect().height > 0` | 0 | 8 |
| `getComputedStyle(el).display !== 'none'` | 10 | 10 |

So `getComputedStyle` is only trustworthy on the element that actually carries the
rule. When you do not know which ancestor that is, walk up and find it:

```js
await d.eval(`(() => {
  let p = document.querySelector('a[href^="/show/"]');
  while (p && p !== document.body) {
    const cs = getComputedStyle(p);
    if (cs.display === 'none' || cs.visibility === 'hidden')
      return { cls: p.className, display: cs.display, visibility: cs.visibility };
    p = p.parentElement;
  }
  return 'nothing hiding it';
})()`);
// -> { cls: "podcast-item", display: "none", visibility: "visible" }
```

That also tells you *which* rule fired, which `checkVisibility()` alone does not.
Note the count with the class off is 8, not 10 — Spotify culls offscreen rows, so
rect- and visibility-based counts move with scroll position. Compare the two states
back to back without scrolling in between.

**Did the tagging pass run?** `util.ts` tags rows rather than relying on CSS alone:

```js
await d.eval(`({
  podcast: document.querySelectorAll('.podcast-item').length,
  audiobook: document.querySelectorAll('.audiobook-item').length,
  chipStyles: [...document.querySelectorAll('style')]
    .filter(s => /chip-styles/.test(s.id)).map(s => [s.id, s.textContent.length]),
})`);
```

**Is the observer still spinning?** `apply()` must be idempotent or the observer
never settles. Count mutations over a quiet second on a settled page:

```js
await d.eval(`new Promise(r => {
  let n = 0;
  const o = new MutationObserver(ms => { n += ms.length; });
  o.observe(document.querySelector('.main-view-container__scroll-node-child'),
    { childList: true, subtree: true, attributes: true });
  setTimeout(() => { o.disconnect(); r(n); }, 1000);
})`);
// a settled page should be at or near 0
```

**Which element really receives a click?** Settles overlay questions that reading CSS
cannot.

```js
await d.eval(`(() => {
  const r = document.querySelector('button').getBoundingClientRect();
  const hit = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
  return hit.tagName + '.' + hit.className;
})()`);
```

## Reporting

Quote the measurement, not the impression: "17 `/show/` links, 0 visible with the
class on, 17 with it off" beats "podcasts seem to be hidden". When a fix is verified,
show before and after from the same probe.

If the harness is what misbehaved, say so rather than reporting it as an extension
bug — and if you have already reported it the other way round, correct it plainly.
