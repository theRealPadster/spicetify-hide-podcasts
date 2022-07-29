// @ts-check

// NAME: Hide Podcasts
// AUTHOR: theRealPadster
// DESCRIPTION: Hide podcasts. Toggle in Profile menu.

/// <reference path="../spicetify-cli/globals.d.ts" />

const SETTINGS_KEY = 'HidePodcastsEnabled';
const AGGRESSIVE_MODE_KEY = 'HidePodcastsAggressiveMode';

/**
 * Get localStorage data (or fallback value), given a key
 * @param {string} key The localStorage key
 * @param {any} fallback Fallback value if the key is not found
 * @returns The data stored in localStorage, or the fallback value if not found
 */
const getLocalStorageDataFromKey = (key, fallback) => {
    const str = localStorage.getItem(key);
    if (!str) return fallback;
    return JSON.parse(str);
};

(function HidePodcasts() {
    const { Player, Menu, Platform } = Spicetify;
    const main = document.querySelector('.main-view-container__scroll-node-child');
    if (!(Player && Menu && Platform && main)) {
        // console.log('Not ready, waiting...');
        setTimeout(HidePodcasts, 1000);
        return;
    }

    let isEnabled = getLocalStorageDataFromKey(SETTINGS_KEY, true);
    let aggressiveMode = getLocalStorageDataFromKey(AGGRESSIVE_MODE_KEY, false);

    // Add menu item and menu click handler
    new Menu.SubMenu('Hide podcasts', [
        new Menu.Item('Enabled', isEnabled, (self) => {
            isEnabled = !isEnabled;
            localStorage.setItem(SETTINGS_KEY, isEnabled);
            self.setState(isEnabled);
            apply();
        }),
        new Menu.Item('Aggressive mode', aggressiveMode, (self) => {
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
    function listenThenApply(pathname) {
        const observer = new MutationObserver(function appchange(){
            // Look for specific section on search page, or any section on other pages
            const app = pathname === '/search'
                ? main.querySelector('#searchPage .main-shelf-shelf[aria-label="Browse all"]')
                : main.querySelector('section');

            if (app) {
                console.log(pathname, app);
                apply();
                if (!aggressiveMode) observer.disconnect();
            }
        })
        // I need to include subtree because the Search page only has one child and the content is under there
        observer.observe(main, { childList: true, subtree: true });
    }

    // Initial scan on app load
    listenThenApply(Platform.History.location.pathname);

    // Listen for page navigation events
    Platform.History.listen(({ pathname }) => {
        listenThenApply(pathname);
    });
})();

/**
 * Inject the css that allows us to toggle podcasts
 */
function injectCSS() {
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
        body.appendChild(style);
        body.classList.add('hide-podcasts--style-injected');
    }
}

/**
 * Add our class to any podcast elements
 */
function tagItems() {
    const yourEpisodesInSidebar = document.querySelector('a[href="/collection/episodes"]')?.parentElement;
    if (yourEpisodesInSidebar) yourEpisodesInSidebar.classList.add('podcast-item');

    // Remove podcast carousels
    const shelves = document.querySelectorAll('.main-shelf-shelf');
    shelves.forEach(shelf => {

        // Podcast links in carousels
        const podcastCardLinks = [
            ...shelf.querySelectorAll('.main-cardHeader-link[href^="/episode"]'),
            ...shelf.querySelectorAll('.main-cardHeader-link[href^="/show"]'),
        ];

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

    // Remove mention of podcasts from search entry placeholder
    const searchEntry = document.querySelector('.x-searchInput-searchInputInput');
    if (searchEntry) {
        console.log('Updating search entry placeholder text');
        searchEntry.setAttribute('placeholder', 'Artists, albums, or songs');
    }
}

/**
 * Add/remove the body class that hides podcasts
 * @param {boolean} isEnabled If we should hide podcasts or not
 */
function setState(isEnabled) {
    document.body.classList.toggle('hide-podcasts-enabled', isEnabled);
}
