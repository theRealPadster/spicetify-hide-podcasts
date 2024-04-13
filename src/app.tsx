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

import {
  getLocalStorageDataFromKey, getPageLoadedSelector,
  tagPodcasts, tagAudioBooks,
} from './util';

import './css/app.scss';

// the translations
const locales = {
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
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .use(LanguageDetector)
  .init({
    resources: locales,
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

  let { Player, Menu, Platform, Locale } = Spicetify;
  let mainElem = document.querySelector('.main-view-container__scroll-node-child');

  while (!Player || !Menu || !Platform || !Locale || !mainElem) {
    // Wait for Spicetify to load
    await new Promise(resolve => setTimeout(resolve, 100));
    Player = Spicetify.Player;
    Menu = Spicetify.Menu;
    Platform = Spicetify.Platform;
    Locale = Spicetify.Locale;
    mainElem = document.querySelector('.main-view-container__scroll-node-child');
  }

  console.debug('HidePodcasts: Loaded');

  let isEnabled = getLocalStorageDataFromKey(SETTINGS_KEY, true);
  let aggressiveMode = getLocalStorageDataFromKey(AGGRESSIVE_MODE_KEY, false);
  let hideAudioBooks = getLocalStorageDataFromKey(AUDIOBOOKS_KEY, false);

  // Add menu item and menu click handler
  const enabledMenuItem = new Menu.Item(t('menu.enabled'), isEnabled, (self) => {
    isEnabled = !isEnabled;
    localStorage.setItem(SETTINGS_KEY, isEnabled);
    self.setState(isEnabled);
    apply();
  });

  const aggressiveModeMenuItem = new Menu.Item(t('menu.aggressiveMode'), aggressiveMode, (self) => {
    aggressiveMode = !aggressiveMode;
    localStorage.setItem(AGGRESSIVE_MODE_KEY, aggressiveMode);
    self.setState(aggressiveMode);
    location.reload();
  });

  const hideAudiobooksMenuItem = new Menu.Item(t('menu.hideAudiobooks'), hideAudioBooks, (self) => {
    hideAudioBooks = !hideAudioBooks;
    localStorage.setItem(AUDIOBOOKS_KEY, hideAudioBooks);
    self.setState(hideAudioBooks);
    apply();
  });

  new Menu.SubMenu(t('menu.title'), [
    enabledMenuItem,
    aggressiveModeMenuItem,
    hideAudiobooksMenuItem,
  ]).register();

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
      const appLoadedSelector = getPageLoadedSelector(pathname);
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
    console.debug('HidePodcasts: Page changed', pathname);
    listenThenApply(pathname);
  });
}

export default main;
