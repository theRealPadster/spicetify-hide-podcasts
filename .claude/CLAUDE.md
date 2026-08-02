# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A [Spicetify](https://github.com/spicetify/cli) extension that hides podcasts (and optionally audiobooks) from the Spotify desktop client. It is injected into Spotify's own React app at runtime, so nearly all of the work is *reacting to Spotify's DOM*, which changes without warning between Spotify releases.

## Commands

Uses **pnpm** (npm/yarn are blocked via `engines`), Node >= 24 (pinned in `.nvmrc`, which all three workflows read).

```bash
pnpm install
pnpm watch          # rebuild on change (spicetify-creator)
pnpm build:local    # build minified bundle to ./hidePodcasts.js (what CI ships)
pnpm lint           # eslint --fix src
pnpm lint:ci        # eslint src (no fix) — run by CI and by the husky pre-commit hook
pnpm type-check     # tsc --noEmit
pnpm update-types   # refresh src/types/spicetify.d.ts from spicetify/cli's globals.d.ts
```

### pnpm 11 gotchas

Two defaults will bite you, and both surface as a failing `pnpm install` that also blocks every `pnpm run` (the deps check runs first, so `build` and `lint` fail too):

- **`minimumReleaseAge` is enabled by default on pnpm 11** (1440 minutes / 1 day; it is 0 on pnpm 10 and earlier). Any lockfile entry published within the last day is rejected. If you hit this, don't relax the policy — `pnpm clean --lockfile && pnpm install` re-resolves to a version old enough to pass. `.github/dependabot.yml` carries a matching 7-day `cooldown` so update PRs don't trip it.
- **Dependency build scripts are skipped unless allowlisted.** The allowlist is `allowBuilds` in `pnpm-workspace.yaml` — *not* `onlyBuiltDependencies`, and *not* the `pnpm` field in `package.json`, which pnpm 11 no longer reads at all. `esbuild` and `@parcel/watcher` are listed there; without them `pnpm install` exits non-zero. `pnpm approve-builds --all` writes the correct form.

There is no test suite. Verification is manual: build, copy `hidePodcasts.js` into the Spicetify Extensions directory (see README for per-platform paths), then `spicetify apply` and check the affected Spotify pages.

## Build output is committed

`hidePodcasts.js` at the repo root is the built artifact **and is tracked in git**. The `push.yml` workflow rebuilds it on every push to `main` and auto-commits as "Built new version". Do not hand-edit it; edit `src/` and let the build (or CI) regenerate it. Releases are plain version-bump commits on `main` (e.g. `3.1.4`) with the version in `package.json`.

## Architecture

Three pieces, and knowing which one to touch is most of the work:

- [src/app.tsx](../src/app.tsx) — entry point (`export default main`). Polls until `Spicetify.Player/Menu/Platform/Locale` and `.main-view-container__scroll-node-child` exist, registers the profile-menu submenu, then wires up navigation handling. State is three booleans in `localStorage` (`HidePodcastsEnabled`, `HidePodcastsAggressiveMode`, `HidePodcastsHideAudioBooks`). Toggling only flips body classes (`hide-podcasts-enabled` / `hide-audiobooks-enabled`) and re-runs tagging — the aggressive-mode toggle forces a `location.reload()` because the observer lifetime differs.
- [src/css/app.scss](../src/css/app.scss) — **where most hiding actually happens.** Everything is nested under the two body classes so toggling is instant and cheap. Prefer adding a selector here over adding JS.
- [src/util.ts](../src/util.ts) — the JS escape hatch, for cases CSS alone can't express: it reads localized strings via `Spicetify.Locale.get(...)`, finds matching filter chips, tags them with `.podcast-item` / `.audiobook-item`, **and** injects a `<style>` element of `aria-label*=` rules (`hide-podcasts-chip-styles` / `hide-audiobooks-chip-styles`) so chips rendered after tagging are still hidden.

### Navigation and the MutationObserver

`listenThenApply(pathname)` creates a `MutationObserver` on the main view, waits for a page-specific "loaded" selector from `getPageLoadedSelector()`, then calls `apply()`. A new observer is created per navigation via `Platform.History.listen`. When adding support for a new page, add its "loaded" selector to `getPageLoadedSelector()`.

The observer disconnects after the first successful apply, **except** in aggressive mode and on search results pages (`/search/<query>`), where content streams in after the page first "loads". Two rules follow from that:

- **Anything `apply()` does must be idempotent.** A page that has settled has to stop producing mutations, or the observer spins. Row tagging skips already-tagged rows, and chip-style injection no-ops when the generated CSS is unchanged.
- **`listenThenApply` disconnects the previous observer before creating the next.** Observers that never self-disconnect would otherwise accumulate one per navigation.

### Hiding strategies, in order of preference

1. **Structural CSS selector** — e.g. `:has(a[href^="/show/"])`, `:has(a[href^="/episode/"])`. Robust across Spotify versions. **But see the `/show/` collision below — this cannot separate podcasts from audiobooks.**
2. **Shelf/genre ID** — the `$podcastShelfIds` / `$audiobookShelfIds` / `$podcastGenreIds` / `$audiobookGenreIds` SCSS lists, matched against `href`. Precise and leaves no layout gap. Shelf IDs rot; genre IDs have proven stable. Add a comment naming the shelf or category.
3. **Localized string matching in `util.ts`** — last resort, for content whose only stable signal is visible text.

### Spotify DOM gotchas

Hard-won, and each one has already caused a wrong fix:

- **Audiobooks and podcasts both live under `/show/`** and render byte-identical markup — same classes, same `spotify:show:` URIs, same containers. The *only* distinguishing signal is the localized type in the row subtitle (`Podcast • …` vs `Audiobook • …`). Any CSS rule on `a[href^="/show/"]` therefore ties the two toggles together, which is why search-result rows are classified in JS instead.
- **`.search-searchCategory-categoryGrid` is not the search page's grid.** It wraps the left sidebar's library filter row *and* the home filter row. The search browse-all grid lives under `#searchPage`. A "loaded" selector built on the former matches zero elements on `/search`.
- **Hashed class names rot.** `.x-categoryCard-CategoryCard` became `Wz3dEPV2mIQW7nLE` and silently killed every genre-card rule. Prefer `href` matching, which has been stable.
- **Search results render no `<section>`** inside the main view, so a generic `section` "loaded" selector never fires there.

### Verifying against a live client

A selector matching zero elements is **not** evidence that it is dead. Before removing anything:

- **Drive the UI that renders it.** `#search-dropdown` only exists once you type in the search box; the queue tabs only exist with the panel open. Both were nearly deleted as "dead" after being measured on pages that never render them.
- **Check visibility with `getComputedStyle`, not `innerText`.** Hidden elements return empty text, so a text-based scan reports the extension's own success as absence.
- **A/B the body classes.** Toggling `hide-podcasts-enabled` / `hide-audiobooks-enabled` off separates "hidden by us" from "absent for this account" — an account with no podcasts in its library legitimately has no podcast filter chips.
- **Scroll, and confirm `scrollTop` actually moved.** The main view's scroll container is not always the element you'd expect.

`display: none` vs the `hide-visibility` mixin matters: for homepage shelves matched by `:has()`, `display: none` causes React to cull children, which makes the `:has()` stop matching, which un-hides the shelf — an infinite flicker loop. Those use `@include hide-visibility` (`visibility: hidden; height: 0`), which leaves a grid gap but is stable. ID-matched shelves can safely use `hide-display`. This tradeoff is documented inline at the top of the mixins — don't "fix" it by switching to `display: none`.

## Adding locales

Add `src/locales/<code>.json` (copy `en.json`'s shape), then import it **and register it in the `locales` map** in [src/app.tsx](../src/app.tsx) — i18next resolves the language from the browser/navigator. Adding the file without registering it is a silent no-op; `fr-CA` sat unused that way for a long time.

`fallbackLng` is an object, not a plain string. Regional variants that only override a few keys should chain through their base language before English (`'fr-CA': ['fr', 'en']`), otherwise every key they don't define falls all the way back to English.

## Finding Spotify's localized strings

Run `Spicetify.Locale.getDictionary()` in the Spotify devtools console and search the output for the key you need (this is how `search.title.shows`, `shared.library.filter.book`, etc. were found).

Keys currently relied on: `search.title.shows` ("Podcasts"), `shared.library.filter.book` ("Audiobooks"), `web-player.whats-new-feed.filters.episodes` ("Podcast & Shows"), and the entity-type tags used by search-result subtitles — `card.tag.show`, `card.tag.episode`, `card.tag.audiobook`.

## Conventions

ESLint enforces 2-space indent, single quotes, semicolons, trailing commas in multiline, and no trailing whitespace; config lives in `eslint.config.mjs` (flat config, ESLint 10). The pre-commit hook runs `pnpm run lint:ci` — it reports violations rather than auto-fixing, since `--fix` would edit files without re-staging them. Debug output goes through `console.debug` prefixed with `HidePodcasts:` or `=== ... ===` — it's intentionally verbose since debugging happens in a live Spotify client.
