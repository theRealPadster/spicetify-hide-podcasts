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

const PODCAST_CHIP_STYLE_ID = 'hide-podcasts-chip-styles';

/**
 * Inject CSS that targets aria-label attributes with localized strings
 * @param labels The labels of the chips to inject styles for
 */
const injectPodcastChipStyles = (labels: string[]) => {
  const existingStyle = document.getElementById(PODCAST_CHIP_STYLE_ID);
  if (existingStyle) {
    existingStyle.remove();
  }

  const cssRules: string[] = [];

  for (const container of CHIP_CONTAINERS) {
    for (const label of labels) {
      const escapedLabel = CSS.escape(label);
      cssRules.push(`
        .hide-podcasts-enabled ${container} button[aria-label*="${escapedLabel}"],
        .hide-podcasts-enabled ${container} div[class*="ChipComponent"][aria-label*="${escapedLabel}"],
        .hide-podcasts-enabled ${container} div[role="option"]:has([aria-label*="${escapedLabel}"])
      `);
    }
  }

  const cssContent = `${cssRules.join(', ')} { display: none !important; }`;

  const styleElement = document.createElement('style');
  styleElement.id = PODCAST_CHIP_STYLE_ID;
  styleElement.textContent = cssContent;
  document.head.appendChild(styleElement);

  console.debug('=== Injected podcast chip styles ===', cssContent);
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

  injectPodcastChipStyles([PODCASTS_STRING, PODCAST_AND_SHOWS_STRING]);

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

  console.debug('=== audiobookChips ===', audiobookChips);

  audiobookChips.forEach((chip) => {
    chip.classList.add('audiobook-item');
  });
};
