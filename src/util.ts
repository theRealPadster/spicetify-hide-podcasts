import { TFunction } from 'i18next';

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
export const getPageLoadedSelector = (t: TFunction, pathname: string) => {
  switch (pathname) {
  case '/search':
    return '#searchPage .search-searchBrowse-browseAllWrapper';
  case '/':
    return '.main-shelf-shelf';
  default:
    return 'section';
  }
};

/** Add our class to any podcast elements */
export const tagPodcasts = () => {
  console.debug('=== Tagging podcasts ===');

  const yourEpisodesInSidebar =
    // Old style?
    document.querySelector('a[href="/collection/episodes"]')?.parentElement ||
    // New style?
    document.querySelector('#listrow-title-spotify:collection:your-episodes')?.closest('li');
  if (yourEpisodesInSidebar) {
    console.debug('Tagging yourEpisodesInSidebar:', yourEpisodesInSidebar);
    yourEpisodesInSidebar.classList.add('podcast-item');
  }
};

/** Add our class to any audiobook elements */
export const tagAudioBooks = (t: TFunction) => {
  console.debug('=== Tagging audiobooks ===');

  // Remove audiobooks card from search/browse page
  // The audiobooks card doesn't have an attribute I can use to select it, so I have to use the title
  const browseCardTitles = document.querySelectorAll('.x-categoryCard-CategoryCard .x-categoryCard-title');
  console.debug({ browseCardTitles });
  browseCardTitles.forEach(card => {
    if (card.textContent === t('search.audiobooksCardTitle')) {
      console.debug(`Tagging audiobooks card: ${card}`);
      card.closest('.x-categoryCard-CategoryCard')?.classList.add('audiobook-item');
    }
  });
};
