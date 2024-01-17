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
 * Add our class to any podcast elements.
 * This is currently done with CSS,
 * but we may need to add more functionality here in the future.
 */
export const tagPodcasts = () => {
  console.debug('=== Tagging podcasts ===');
  console.debug('=== (All done via CSS) ===');
};

/**
 * Add our class to any audiobook elements.
 * This is currently done with CSS,
 * but we may need to add more functionality here in the future.
 */
export const tagAudioBooks = () => {
  console.debug('=== Tagging audiobooks ===');
  console.debug('=== (All done via CSS) ===');
};
