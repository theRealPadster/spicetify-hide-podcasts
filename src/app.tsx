// NAME: Hide Podcasts
// AUTHOR: theRealPadster
// DESCRIPTION: Hide podcasts. Toggle in Profile menu.

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/spicetify.d.ts" />

import i18n from 'i18next';
import caLocale from './locales/ca.json';
import daLocale from './locales/da.json';
import enLocale from './locales/en.json';
import frLocale from './locales/fr.json';
import deLocale from './locales/de.json';
import itLocale from './locales/it.json';
import ptBrLocale from './locales/pt-BR.json';
import plPlLocale from './locales/pl-PL.json';
import ruLocale from './locales/ru.json';
import trLocale from './locales/tr.json';
import zhCNLocale from './locales/zh-CN.json';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { getLocalStorageDataFromKey, getPageLoadedSelector } from './util';

import './css/app.scss';

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .use(LanguageDetector)
  .init({
    // the translations
    resources: {
      ca: caLocale,
      da: daLocale,
      en: enLocale,
      fr: frLocale,
      de: deLocale,
      it: itLocale,
      'pt-BR': ptBrLocale,
      'pl-PL': plPlLocale,
      ru: ruLocale,
      tr: trLocale,
      'zh-CN': zhCNLocale,
    },
    detection: {
      order: [ 'navigator', 'htmlTag' ],
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    },
  });

const SETTINGS_KEY = 'HidePodcastsEnabled';
const AGGRESSIVE_MODE_KEY = 'HidePodcastsAggressiveMode';
const AUDIOBOOKS_KEY = 'HidePodcastsHideAudioBooks';

/** Add our class to any podcast elements */
const tagPodcasts = () => {
  const yourEpisodesInSidebar = document.querySelector('a[href="/collection/episodes"]')?.parentElement;
  if (yourEpisodesInSidebar) {
    console.debug('Tagging yourEpisodesInSidebar:', yourEpisodesInSidebar);
    yourEpisodesInSidebar.classList.add('podcast-item');
  }

  // Remove podcast carousels
  const shelves = document.querySelectorAll('.main-shelf-shelf');
  // console.debug({ shelves });
  shelves.forEach((shelf) => {
    const title = shelf.getAttribute('aria-label');

    const observer = new MutationObserver(function(mutationsList, observer) {
      // Look through all mutations that just occured
      for (const mutation of mutationsList) {
        // If the addedNodes property has one or more nodes
        if (mutation.addedNodes.length) {
          const addedNode = mutation.addedNodes[0];
          const cardLink = addedNode.querySelector('.main-cardHeader-link');
          if (cardLink) {
            // .main-cardHeader-link element has been added
            // console.debug(`New card added to '${title}' shelf:`, cardLink);

            const href = cardLink.getAttribute('href');
            const isPodcastCard = /^\/(episode|show)/.test(href);

            if (isPodcastCard) {
              console.debug(`Tagging carousel: ${title}`);
              shelf.classList.add('podcast-item');
            }

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
const tagAudioBooks = () => {
  const { t } = i18n;

  // Remove audiobooks card from search/browse page
  // The audiobooks card doesn't have an attribute I can use to select it, so I have to use the title
  const browseCardTitles = document.querySelectorAll('.x-categoryCard-CategoryCard .x-categoryCard-title');
  browseCardTitles.forEach(card => {
    if (card.textContent === t('search.audiobooksCardTitle')) {
      console.debug(`Tagging audiobooks card: ${card}`);
      card.closest('.x-categoryCard-CategoryCard')?.classList.add('audiobook-item');
    }
  });
};

/**
 * Add/remove the body classes that hide items
 * @param podcasts If we should hide podcasts
 * @param audiobooks If we should hide audiobooks
 */
const setState = ({ podcasts, audiobooks }: { podcasts: boolean, audiobooks: boolean }) => {
  document.body.classList.toggle('hide-podcasts-enabled', podcasts);
  document.body.classList.toggle('hide-audiobooks-enabled', audiobooks);
};

/********************
 * Main app
 ********************/
async function main() {
  const { t } = i18n;

  let { Player, Menu, Platform } = Spicetify;
  let mainElem = document.querySelector('.main-view-container__scroll-node-child');

  while (!Player || !Menu || !Platform || !mainElem) {
    // Wait for Spicetify to load
    await new Promise(resolve => setTimeout(resolve, 100));
    Player = Spicetify.Player;
    Menu = Spicetify.Menu;
    Platform = Spicetify.Platform;
    mainElem = document.querySelector('.main-view-container__scroll-node-child');
  }

  console.debug('HidePodcasts: Loaded');

  let isEnabled = getLocalStorageDataFromKey(SETTINGS_KEY, true);
  let aggressiveMode = getLocalStorageDataFromKey(AGGRESSIVE_MODE_KEY, false);
  let hideAudioBooks = getLocalStorageDataFromKey(AUDIOBOOKS_KEY, false);

  const hideAudiobooksMenuItem = new Menu.Item(t('menu.hideAudiobooks'), hideAudioBooks, (self) => {
    hideAudioBooks = !hideAudioBooks;
    localStorage.setItem(AUDIOBOOKS_KEY, hideAudioBooks);
    // self.setState(isEnabled && hideAudioBooks);
    self.setState(hideAudioBooks);
    apply();
  });

  // Add menu item and menu click handler
  const enabledMenuItem = new Menu.Item(t('menu.enabled'), isEnabled, (self) => {
    isEnabled = !isEnabled;
    localStorage.setItem(SETTINGS_KEY, isEnabled);
    self.setState(isEnabled);
    // hideAudiobooksMenuItem.setState(isEnabled && hideAudioBooks);
    apply();
  });

  const aggressiveModeMenuItem = new Menu.Item(t('menu.aggressiveMode'), aggressiveMode, (self) => {
    aggressiveMode = !aggressiveMode;
    localStorage.setItem(AGGRESSIVE_MODE_KEY, aggressiveMode);
    self.setState(aggressiveMode);
    location.reload();
  });

  new Menu.SubMenu(t('menu.title'), Object.values([
    enabledMenuItem,
    aggressiveModeMenuItem,
    hideAudiobooksMenuItem,
  ])).register();

  // Run the app logic
  function apply() {
    setState({ podcasts: isEnabled, audiobooks: hideAudioBooks });
    tagPodcasts();
    tagAudioBooks();
  }

  // Listen to page navigation and re-apply when DOM is ready
  function listenThenApply(pathname: string) {
    const observer = new MutationObserver(function appchange() {
      // console.debug('HidePodcasts: DOM changed');
      if (!mainElem) return; // ts protection

      // Get the relevant selector to verify the current page has loaded
      const appLoadedSelector = getPageLoadedSelector(t, pathname);
      const app = mainElem.querySelector(appLoadedSelector);

      if (app) {
        console.debug(pathname, app);
        apply();
        if (!aggressiveMode) observer.disconnect();
      }
    });
    // I need to include subtree because the Search page only has one child and the content is under there
    observer.observe(mainElem as Element, { childList: true, subtree: true });
  }

  // Initial scan on app load
  listenThenApply(Platform.History.location.pathname);

  // Listen for page navigation events
  Platform.History.listen(({ pathname }: { pathname: string }) => {
    listenThenApply(pathname);
  });
}

export default main;
