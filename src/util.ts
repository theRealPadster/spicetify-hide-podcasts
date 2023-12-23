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
export const tagPodcasts = (t: TFunction) => {
  console.debug('=== Tagging podcasts ===');

  t('search.podcastsCardTitle');

  const yourEpisodesInSidebar = document.querySelector('a[href="/collection/episodes"]')?.parentElement;
  if (yourEpisodesInSidebar) {
    console.debug('Tagging yourEpisodesInSidebar:', yourEpisodesInSidebar);
    yourEpisodesInSidebar.classList.add('podcast-item');
  }

  const checkCarouselCard = (shelf: HTMLElement, cardLink: HTMLElement) => {
    const title = shelf.getAttribute('aria-label');
    console.debug(`New card added to '${title}' shelf:`, cardLink);
    const href = cardLink.getAttribute('href') as string;
    const isPodcastCard = /^\/(episode|show)/.test(href);

    if (isPodcastCard) {
      console.debug(`Tagging carousel: ${title}`);
      shelf.classList.add('podcast-item');
    }
  };

  const checkCategoryCard = (shelf: HTMLElement, cardLink: HTMLElement) => {
    const title = shelf.getAttribute('aria-label');
    console.debug(`New category card added to '${title}' shelf:`, cardLink);
    const categoryTitle = cardLink.innerText;
    const isPodcastCard = categoryTitle === t('search.podcastsCardTitle');

    if (isPodcastCard) {
      console.debug(`Tagging category card: ${title}`);
      cardLink.classList.add('podcast-item');
    }
  };

  // Remove podcast carousels
  // This also grabs the shelves on the search page.
  const shelves = document.querySelectorAll<HTMLElement>('.main-shelf-shelf');
  // console.debug({ shelves });
  shelves.forEach((shelf) => {
    const title = shelf.getAttribute('aria-label');

    const observer = new MutationObserver(function(mutationsList, observer) {
      // Look through all mutations that just occured
      for (const mutation of mutationsList) {
        // If the addedNodes property has one or more nodes
        if (mutation.addedNodes.length) {
          const addedElem = mutation.addedNodes[0] as Element;
          const carouselCardLink = addedElem.querySelector<HTMLElement>('.main-cardHeader-link');
          const categoryCardLink = addedElem.querySelector<HTMLElement>('.x-categoryCard-CategoryCard');
          if (carouselCardLink) {
            checkCarouselCard(shelf, carouselCardLink);
            // Reset the disconnect timer whenever a new card is added
            clearTimeout(disconnectTimer);
            disconnectTimer = setTimeout(() => {
              console.debug(`Disconnecting '${title}' shelf observer. No cards added in 5 seconds.`);
              observer.disconnect();
            }, 5000); // disconnect after 5 seconds of no new cards
          } else if (categoryCardLink) {
            checkCategoryCard(shelf, categoryCardLink);
            // Reset the disconnect timer whenever a new card is added
            clearTimeout(disconnectTimer);
            disconnectTimer = setTimeout(() => {
              console.debug(`Disconnecting '${title}' shelf observer. No cards added in 5 seconds.`);
              observer.disconnect();
            }, 5000); // disconnect after 5 seconds of no new cards
          }
        }
      }
    });

    let disconnectTimer;

    console.debug(`Observing '${title}' shelf for new cards...`);
    // Check currently-existing cards
    const categoryCards = shelf.querySelectorAll<HTMLElement>('.x-categoryCard-CategoryCard');
    const carouselCards = shelf.querySelectorAll<HTMLElement>('.main-cardHeader-link');
    console.debug({ categoryCards, carouselCards });
    categoryCards.forEach((card) => checkCategoryCard(shelf, card));
    carouselCards.forEach((card) => checkCarouselCard(shelf, card));

    // Start observing the target node for configured mutations
    observer.observe(shelf, { attributes: false, childList: true, subtree: true });
  });

  // Remove podcast card from search/browse page
  const browsePodcastsCard = document.querySelector('.x-categoryCard-CategoryCard[href="/genre/podcasts-web"]');
  if (browsePodcastsCard) {
    console.debug('Tagging browsePodcastsCard:', browsePodcastsCard);
    browsePodcastsCard.classList.add('podcast-item');
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
