// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/spicetify.d.ts" />

/**
 * Get localStorage data (or fallback value), given a key
 * @param key The localStorage key
 * @param fallback Fallback value if the key is not found
 * @returns The data stored in localStorage, or the fallback value if not found
 */
export const getLocalStorageDataFromKey = (key: string, fallback?: unknown) => {
  const data = localStorage.getItem(key);

  if (data) {
    try {
      // If it's json parse it
      return JSON.parse(data);
    } catch {
      // If it's just a string or something
      return data;
    }
  } else {
    return fallback;
  }
};

/**
 * Get the relevant selector to verify the current page has loaded.
 * @param t The string translation function
 * @param pathname Spotify pathname
 */
export const getPageLoadedSelector = (pathname: string) => {
  // Search results (`/search/<query>`) render no <section> inside the main view,
  // so the `default` case below never matched and apply() never ran here at all.
  // The result rows are the payload, so wait for those instead.
  if (isSearchResultsPage(pathname)) {
    return '#searchPage [role="row"]';
  }

  switch (pathname) {
  case '/search':
    // `.search-searchBrowse-browseAllWrapper` no longer exists, so this never
    // matched and apply() never ran on the browse-all page. The genre cards are
    // the page's actual payload, so use them as the "loaded" marker.
    // NB: `.search-searchCategory-categoryGrid` looks like a candidate but is
    // the left sidebar's library filter row, not part of #searchPage.
    return '#searchPage a[href^="/genre/"]';
  case '/':
    return '.main-shelf-shelf';
  default:
    return 'section';
  }
};

/** Search *results* pages, e.g. `/search/joe%20rogan` (not the browse-all page) */
export const isSearchResultsPage = (pathname: string) => /^\/search\/.+/.test(pathname);

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether a result row's subtitle describes the given entity type.
 * Subtitles read `Podcast • Joe Rogan` / `Audiobook • Stephen King`, and may be
 * preceded by an explicit-content badge, giving `EEpisode • ...` in textContent.
 * We use textContent (not innerText) so already-hidden rows still report a type.
 * @param text The subtitle's textContent
 * @param label The localized type label to look for
 */
const subtitleHasType = (text: string, label: string) => {
  if (!label) {
    return false;
  }
  // The bullet separator is what distinguishes the type prefix from a creator
  // name that merely contains the word (e.g. `Episode • Dwarkesh Podcast`).
  return new RegExp(`${escapeRegExp(label)}\\s*[•·]`, 'i').test(text);
};

const CHIP_CONTAINERS = [
  '.main-yourLibraryX-filters',
  '.main-yourLibraryX-filterArea',
  '.search-searchCategory-categoryGrid',
];

/**
 * Get all chips matching a given label
 * @param label The label of the chips to get
 */
const getChipsByLabel = (label: string) => {
  let chips: HTMLElement[] = [];

  CHIP_CONTAINERS.forEach((container) => {
    const filterDivs = Array.from(document.querySelectorAll(container));
    if (!filterDivs) {
      return;
    }

    for (const filterDiv of filterDivs) {
      const buttonChips = Array.from(filterDiv.querySelectorAll('button'))
        .filter((btn) => {
          console.debug('=== btn ===', btn);
          const currLabel = btn.querySelector('span')?.innerText;
          return currLabel?.includes(label);
        });

      const divChips = Array.from(filterDiv.querySelectorAll('div[class*="ChipComponent"]'))
        .filter((div) => {
          console.debug('=== div ===', div);
          const spanText = div.querySelector('span')?.innerText;
          return spanText?.includes(label);
        })
        .map((div) => {
          const parentOption = div.closest('div[role="option"]');
          return (parentOption as HTMLElement) || div;
        });

      chips = chips.concat(buttonChips, divChips);
    }
  });

  return chips;
};

/**
 * Inject CSS that targets aria-label attributes with localized strings
 * @param rootClass The root class to inject styles for
 * @param styleId The ID for the style element
 * @param labels The labels of the chips to hide
 */
const injectHideChipStyles = (rootClass: string, styleId: string, labels: string[]) => {
  const cssRules: string[] = [];

  for (const container of CHIP_CONTAINERS) {
    for (const label of labels) {
      const escapedLabel = CSS.escape(label);
      cssRules.push(`
        .${rootClass} ${container} button[aria-label*="${escapedLabel}"],
        .${rootClass} ${container} div[class*="ChipComponent"][aria-label*="${escapedLabel}"],
        .${rootClass} ${container} div[role="option"]:has([aria-label*="${escapedLabel}"])
      `);
    }
  }

  const cssContent = `${cssRules.join(', ')} { display: none !important; }`;

  // On search results pages apply() runs on every mutation, so avoid churning
  // the <style> element when nothing has actually changed.
  const existingStyle = document.getElementById(styleId);
  if (existingStyle?.textContent === cssContent) {
    return;
  }
  existingStyle?.remove();

  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = cssContent;
  document.head.appendChild(styleElement);

  console.debug('=== Injected hide chip styles ===', { rootClass, styleId, cssContent });
};

/**
 * Tag podcast/audiobook rows on the search *results* page.
 *
 * This has to be done in JS rather than CSS: audiobooks and podcasts both use
 * `/show/` hrefs and render with identical markup, so the only thing that
 * distinguishes them is the localized type in the row's subtitle. Hiding
 * `a[href^="/show/"]` in CSS would tie the two toggles together.
 * @param Locale The Spicetify.Locale object, for getting strings
 */
export const tagSearchResultRows = (Locale: typeof Spicetify.Locale) => {
  const PODCAST = Locale.get('card.tag.show') as string || 'Podcast';
  const EPISODE = Locale.get('card.tag.episode') as string || 'Episode';
  const AUDIOBOOK = Locale.get('card.tag.audiobook') as string || 'Audiobook';

  const rows = Array.from(document.querySelectorAll('#searchPage [role="row"]'));
  let podcasts = 0;
  let audiobooks = 0;

  for (const row of rows) {
    // Idempotent: re-tagging on every mutation would keep the observer busy
    if (row.classList.contains('podcast-item') || row.classList.contains('audiobook-item')) {
      continue;
    }

    const subtitle = row.querySelector('p[id^="listrow-subtitle"]')?.textContent;
    if (!subtitle) {
      continue;
    }

    if (subtitleHasType(subtitle, AUDIOBOOK)) {
      row.classList.add('audiobook-item');
      audiobooks++;
    } else if (subtitleHasType(subtitle, PODCAST) || subtitleHasType(subtitle, EPISODE)) {
      row.classList.add('podcast-item');
      podcasts++;
    }
  }

  if (podcasts || audiobooks) {
    console.debug('=== Tagged search result rows ===', { podcasts, audiobooks, of: rows.length });
  }
};

/**
 * Add our class to any podcast elements.
 * This is currently done mostly with CSS,
 * but we may need to add more functionality here in the future.
 * @param Locale The Spicetify.Locale object, for getting strings
 */
export const tagPodcasts = (Locale: typeof Spicetify.Locale) => {
  console.debug('=== Tagging podcasts ===');
  console.debug('=== (Most of this is done via CSS) ===');

  const PODCASTS_STRING = Locale.get('search.title.shows') as string || 'Podcasts';
  const podcastChips = getChipsByLabel(PODCASTS_STRING);

  const PODCAST_AND_SHOWS_STRING = Locale.get('web-player.whats-new-feed.filters.episodes') as string || 'Podcast & Shows';
  const podcastAndShowsChips = getChipsByLabel(PODCAST_AND_SHOWS_STRING);

  console.debug('=== podcastChips ===', podcastChips);
  console.debug('=== podcastAndShowsChips ===', podcastAndShowsChips);

  injectHideChipStyles('hide-podcasts-enabled',
    'hide-podcasts-chip-styles',
    [PODCASTS_STRING, PODCAST_AND_SHOWS_STRING],
  );

  const addPodcastClass = (chip: HTMLElement) => {
    chip.classList.add('podcast-item');
  };
  podcastChips.forEach(addPodcastClass);
  podcastAndShowsChips.forEach(addPodcastClass);
};

/**
 * Add our class to any audiobook elements.
 * This is currently done mostly with CSS,
 * but we may need to add more functionality here in the future.
 * @param Locale The Spicetify.Locale object, for getting strings
 */
export const tagAudioBooks = (Locale: typeof Spicetify.Locale) => {
  console.debug('=== Tagging audiobooks ===');
  console.debug('=== (Most of this is done via CSS) ===');

  const AUDIOBOOKS_STRING = Locale.get('shared.library.filter.book') as string || 'Audiobooks';
  const audiobookChips = getChipsByLabel(AUDIOBOOKS_STRING);

  injectHideChipStyles('hide-audiobooks-enabled',
    'hide-audiobooks-chip-styles',
    [AUDIOBOOKS_STRING],
  );

  console.debug('=== audiobookChips ===', audiobookChips);

  audiobookChips.forEach((chip) => {
    chip.classList.add('audiobook-item');
  });
};
