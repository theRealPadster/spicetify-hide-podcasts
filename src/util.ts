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
    } catch (err) {
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
  switch (pathname) {
  case '/search':
    return '#searchPage .search-searchBrowse-browseAllWrapper';
  case '/':
    return '.main-shelf-shelf';
  default:
    return 'section';
  }
};

/**
 * Get a filter chip given its label
 * @param label The label of the chip to get
 */
const getFilterChip = (label: string) => {
  const filterDiv = document.querySelector('.main-yourLibraryX-filters');
  if (!filterDiv) {
    return null;
  }

  const chip = Array.from(filterDiv.querySelectorAll('button'))
    .find((btn) => {
      console.debug('=== btn ===', btn);
      const currLabel = btn.querySelector('span')?.innerText;
      return currLabel === label;
    });
  return chip;
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
  const podcastsFilterChip = getFilterChip(PODCASTS_STRING);
  console.debug('=== podcastsFilterChip ===', podcastsFilterChip);
  if (podcastsFilterChip) {
    podcastsFilterChip.classList.add('podcast-item');
  }
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
  const audiobooksFilterChip = getFilterChip(AUDIOBOOKS_STRING);
  if (audiobooksFilterChip) {
    audiobooksFilterChip.classList.add('audiobook-item');
  }
};
