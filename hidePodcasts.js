// @ts-check

// NAME: Hide Podcasts
// AUTHOR: theRealPadster
// DESCRIPTION: Hide podcasts. Toggle in Profile menu. Based on ChristianSpotify extension.

/// <reference path="../globals.d.ts" />

/**
 * TODO:
 * - v2 doesn't seem to apply on toggle (load search page with extension disabled, then enable and it won't go)
 * - Revert search entry placeholder text when disable extension
 * - Do I still need to check for "podcast" in the name/description of carousels?
 */

(function HidePodcasts() {
    const { Player, Menu, LocalStorage, Platform } = Spicetify;
    if (!(Player && Menu && LocalStorage && Platform)) {
        setTimeout(HidePodcasts, 1000);
        return;
    }

    const SETTINGS_KEY = 'HidePodcastsMode';
    let isEnabled = LocalStorage.get(SETTINGS_KEY) === '1';

    // Add menu item and menu click handler
    new Menu.Item('Hide podcasts', isEnabled, (self) => {
        isEnabled = !isEnabled;
        LocalStorage.set(SETTINGS_KEY, isEnabled ? '1' : '0');
        self.setState(isEnabled);
        setState(isEnabled);
    }).register();

    // Run the app logic
    function apply(initialLoad = false) {
        // Run logic on app start or if extension is enabled
        if (initialLoad || isEnabled) {
            setState(isEnabled);
            injectCSS();
            tagItems();
        }
    }

    const main = document.querySelector('.main-view-container__scroll-node-child');

    // Listen to page navigation and re-apply when DOM is ready
    function listenThenApply(pathname) {
        const observer = new MutationObserver(function appchange(){
            const app = main.querySelector('section');
            if (app) {
                console.log(pathname, app);
                // TODO: do I need to pass this initialLoad the first time as well?
                apply();
                observer.disconnect();
            }
        })
        // I need to include subtree because the Search page only has one child and the content is under there
        observer.observe(main, { childList: true, subtree: true });
    }

    // Initial scan on app load
    listenThenApply('/');

    Platform.History.listen(({ pathname }) => {
        listenThenApply(pathname);
    });
})();


/**
 * Inject the css that allows us to toggle podcasts
 */
function injectCSS() {
    const body = document.querySelector('body');

    // Inject style if it doesnt have it already
    if (!body.classList.contains('hide-podcasts--style-injected')) {
        let style = document.createElement('style');
        // TODO: Need to add the queue-tabBar bit to block the Podcasts tab on the Your Library page
        // Because it resets itself when the window resizes and it go in/out of the overflow menu
        // Technically I should block the li.queue-tabBar-headerItem above it, but can't do that with just CSS
        style.innerHTML =
        `
        .hide-podcasts-enabled .podcast-item {
            display: none !important;
        }
        .queue-tabBar-header a[href="/collection/podcasts"] {
            display: none !important;
        }
        `;
        body.appendChild(style);
        body.classList.add('hide-podcasts--style-injected');
    }
}

/**
 * Add our class to any podcast elements
 */
function tagItems() {
    // Remove podcast carousels
    let shelves = document.querySelectorAll('.main-shelf-shelf');
    shelves.forEach(shelf => {
        let title = shelf.querySelector('.main-shelf-title');
        title = title ? title.innerText : '';

        let description = shelf.querySelector('.main-type-mesto');
        description = description ? description.innerText : '';

        // Podcast links in carousels
        const podcastCardLinks = [
            ...shelf.querySelectorAll('.main-cardHeader-link[href^="/episode"'),
            ...shelf.querySelectorAll('.main-cardHeader-link[href^="/show"'),
        ];

        // I still need to check for 'Podcast' in title/description because the 'Made For You' section
        // has a 'Podcasts and more' carousel that's technically got playlists made up of podcast episodes
        if (podcastCardLinks.length > 0 || title.includes('Podcast') || description.includes('Podcast')) {
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

    // Remove mention of podcasts from search entry
    const searchEntry = document.querySelector('.x-searchInput-searchInputInput.main-type-mesto');
    if (searchEntry) {
        console.log(`Updating search entry placeholder text: ${searchEntry}`);
        searchEntry.setAttribute('placeholder', 'Artists, albums, or songs');
    }
}

/**
 * Add/remove the body class that hides podcasts
 * @param {boolean} isEnabled If we should hide podcasts or not
 */
function setState(isEnabled) {
    const body = document.querySelector('body');
    if (isEnabled) body.classList.add('hide-podcasts-enabled');
    else body.classList.remove('hide-podcasts-enabled');
}
