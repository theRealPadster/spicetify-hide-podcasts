// @ts-check

// NAME: Hide Podcasts
// AUTHOR: theRealPadster
// DESCRIPTION: Hide podcasts. Toggle in Profile menu. Based on ChristianSpotify extension.

/// <reference path="../globals.d.ts" />

/**
 * TODO:
 * - v2 doesn't seem to apply on toggle (load search page with extension disabled, then enable and it won't go)
 * - Revert search entry placeholder text when disable extension
 * - v1 probably doesn't work if I wait for Spicetify.Platform to exist
 */

(function HidePodcasts() {
    const { Player, Menu, LocalStorage, Platform } = Spicetify;
    if (!(Player && Menu && LocalStorage && Platform)) {
        setTimeout(HidePodcasts, 1000);
        return;
    }

    // Store the app's documents (main document and grab Browse iframe if possible)
    let documents = getDocuments();
    const SETTINGS_KEY = 'HidePodcastsMode';
    let isEnabled = LocalStorage.get(SETTINGS_KEY) === '1';

    // Add menu item and menu click handler
    new Menu.Item('Hide podcasts', isEnabled, (self) => {
        isEnabled = !isEnabled;
        LocalStorage.set(SETTINGS_KEY, isEnabled ? '1' : '0');
        self.setState(isEnabled);
        setState(documents, isEnabled);
    }).register();

    // Run the app logic
    function apply(initialLoad = false) {
        // Run logic on app start or if extension is enabled
        if (initialLoad || isEnabled) {
            // Refresh documents
            documents = getDocuments();

            setState(documents, isEnabled);
            injectCSS(documents);
            tagItems(documents);
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
 * Grab any Spotify app document objects.
 * This is to ensure that we have the Browse iframe when it exists.
 */
function getDocuments() {
    // TODO: looks like this isn't needed for v2; can I clean up v1 vs v2?
    let documents = [document];
    let browseFrame = document.getElementById('app-browse');
    if (browseFrame) {
        let browseDocument = browseFrame.contentDocument;
        documents.push(browseDocument);
    }
    return documents;
}

/**
 * Inject the css that allows us to toggle podcasts
 * @param {Document[]} documents Array of documents to run on
 */
function injectCSS(documents) {
    documents.forEach(doc => {
        let body = doc.querySelector('body');

        // Inject style if it doesnt have it already
        if (!body.classList.contains('hide-podcasts--style-injected')) {
            let style = doc.createElement('style');
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
    });
}

/**
 * Add our class to any podcast elements
 * @param {Document[]} documents Array of documents to run on
 */
function tagItems(documents) {
    documents.forEach(doc => {

        // Remove podcast carousels (e.g. 'Home' and 'Made For You')
        let shelves = doc.querySelectorAll('.main-shelf-shelf');
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
        const browsePodcastsCard = doc.body.querySelector('.x-categoryCard-CategoryCard[href="/genre/podcasts-web"]');
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
        const searchEntry = doc.body.querySelector('.x-searchInput-searchInputInput.main-type-mesto');
        if (searchEntry) {
            console.log(`Updating search entry placeholder text: ${searchEntry}`);
            searchEntry.setAttribute('placeholder', 'Artists, albums, or songs');
        }
    });
}

/**
 * Add/remove the body class that hides podcasts
 * @param {Document[]} documents Array of documents to run on
 * @param {boolean} isEnabled If we should hide podcasts or not
 */
function setState(documents, isEnabled) {
    documents.forEach(doc => {
        let body = doc.querySelector('body');
        if (isEnabled) body.classList.add('hide-podcasts-enabled');
        else body.classList.remove('hide-podcasts-enabled');
    });
}
