// NAME: Hide Podcasts
// AUTHOR: theRealPadster
// DESCRIPTION: Hide podcasts. Toggle in Profile menu.

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./types/spicetify.d.ts" />

import i18n from 'i18next';
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

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .use(LanguageDetector)
  .init({
    // the translations
    resources: {
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

/**
 * Inject the css that allows us to toggle podcasts
 */
const injectCSS = () => {
  const body = document.body;

  // Inject style if it doesnt have it already
  if (!body.classList.contains('hide-podcasts--style-injected')) {
    const style = document.createElement('style');
    // TODO: Need to add the queue-tabBar bit to block the Podcasts tab on the Your Library page
    // Because it resets itself when the window resizes and it go in/out of the overflow menu
    // Technically I should block the li.queue-tabBar-headerItem above it, but can't do that with just CSS

    style.innerHTML =
      // General rule
      `.hide-podcasts-enabled .podcast-item {
          display: none !important;
        }`
      + // Podcasts tab in Your Library page
      `.hide-podcasts-enabled .queue-tabBar-header a[href="/collection/podcasts"] {
          display: none !important;
        }`;
    style.className = 'hide-podcasts--style';
    document.head.appendChild(style);
    body.classList.add('hide-podcasts--style-injected');
  }
};

/**
 * Add our class to any podcast elements
 */
const tagItems = () => {
  const yourEpisodesInSidebar = document.querySelector('a[href="/collection/episodes"]')?.parentElement;
  if (yourEpisodesInSidebar) yourEpisodesInSidebar.classList.add('podcast-item');

  // Remove podcast carousels
  const shelves = document.querySelectorAll('.main-shelf-shelf');
  // console.log({ shelves });
  shelves.forEach(shelf => {
    // Podcast links in carousels
    const podcastCardLinks = [
      ...shelf.querySelectorAll('.main-cardHeader-link[href^="/episode"]'),
      ...shelf.querySelectorAll('.main-cardHeader-link[href^="/show"]'),
    ];

    // console.log({ podcastCardLinks });

    if (podcastCardLinks.length > 0) {
      const title = shelf.getAttribute('aria-label');
      console.log(`Tagging carousel: ${title}`);
      shelf.classList.add('podcast-item');
    }
  });

  // Remove podcast card from search/browse page
  const browsePodcastsCard = document.querySelector('.x-categoryCard-CategoryCard[href="/genre/podcasts-web"]');
  if (browsePodcastsCard) {
    console.log(`Tagging browsePodcastsCard: ${browsePodcastsCard}`);
    browsePodcastsCard.classList.add('podcast-item');
  }

  // Remove podcast card from Your Library page
  // TODO: I changed this to just use CSS since the element resets when it goes in/out of overflow menu
  // let libraryPodcastsTab = doc.body.querySelector('.queue-tabBar-header a[href="/collection/podcasts"]');
  // if (libraryPodcastsTab) {
  //     // Find the actual li tag
  //     libraryPodcastsTab = libraryPodcastsTab.closest('.queue-tabBar-headerItem');
  //     console.log(`Tagging libraryPodcastsTab: ${libraryPodcastsTab}`);
  //     libraryPodcastsTab.classList.add('podcast-item');
  // }
};

/**
 * Add/remove the body class that hides podcasts
 * @param isEnabled If we should hide podcasts or not
 */
const setState = (isEnabled: boolean) => {
  document.body.classList.toggle('hide-podcasts-enabled', isEnabled);
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

  console.log('HidePodcasts: Loaded');

  let isEnabled = getLocalStorageDataFromKey(SETTINGS_KEY, true);
  let aggressiveMode = getLocalStorageDataFromKey(AGGRESSIVE_MODE_KEY, false);

  // Add menu item and menu click handler
  new Menu.SubMenu(t('menuTitle'), [
    new Menu.Item(t('enabled'), isEnabled, (self) => {
      isEnabled = !isEnabled;
      localStorage.setItem(SETTINGS_KEY, isEnabled);
      self.setState(isEnabled);
      apply();
    }),
    new Menu.Item(t('aggressiveMode'), aggressiveMode, (self) => {
      aggressiveMode = !aggressiveMode;
      localStorage.setItem(AGGRESSIVE_MODE_KEY, aggressiveMode);
      self.setState(aggressiveMode);
      location.reload();
    }),
  ]).register();

  // Run the app logic
  function apply() {
    setState(isEnabled);
    injectCSS();
    tagItems();
  }

  // Listen to page navigation and re-apply when DOM is ready
  function listenThenApply(pathname: string) {
    const observer = new MutationObserver(function appchange() {
      // console.log('HidePodcasts: DOM changed');
      if (!mainElem) return; // ts protection

      // Get the relevant selector to verify the current page has loaded
      const appLoadedSelector = getPageLoadedSelector(t, pathname);
      const app = mainElem.querySelector(appLoadedSelector);

      if (app) {
        console.log(pathname, app);
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
