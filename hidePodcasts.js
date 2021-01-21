// @ts-check

// NAME: Hide Podcasts
// AUTHOR: theRealPadster
// DESCRIPTION: Hide podcasts. Toggle in Profile menu. Based on ChristianSpotify extension.

/// <reference path="../globals.d.ts" />

(function HidePodcasts() {
    const { Player, Menu, LocalStorage } = Spicetify;
    if (!(Player && Menu && LocalStorage)) {
        setTimeout(HidePodcasts, 1000);
        return;
    }

    // Store the app's documents (main document and grab Browse iframe if possible)
    let documents = getDocuments();
    const SETTINGS_KEY = 'HidePodcastsMode';
    let isEnabled = LocalStorage.get(SETTINGS_KEY) === '1';

    setState(documents, isEnabled);
    injectCSS(documents);
    tagItems(documents);

    // Add menu item and menu click handler
    new Menu.Item('Hide podcasts', isEnabled, (self) => {
        isEnabled = !isEnabled;
        LocalStorage.set(SETTINGS_KEY, isEnabled ? '1' : '0');
        self.setState(isEnabled);
        setState(documents, isEnabled);
    }).register();

    Player.addEventListener('appchange', () => {
        if (!isEnabled) return;
        // Refresh documents (to try and grab Browse frame)
        documents = getDocuments();

        setState(documents, isEnabled);
        injectCSS(documents);
        tagItems(documents);
    });
})();

// Helpers

function getDocuments() {
    let documents = [document];
    let browseFrame = document.getElementById('app-browse');
    if (browseFrame) {
        let browseDocument = browseFrame.contentDocument;
        documents.push(browseDocument);
    }
    return documents;
}

// Inject the css that allows us to toggle podcasts
function injectCSS(documents) {
    documents.forEach(doc => {
        let body = doc.querySelector('body');

        // Inject style if it doesnt have it already
        if (!body.classList.contains('hide-podcasts--style-injected')) {
            let style = doc.createElement('style');
            style.innerHTML =
            `
            .hide-podcasts-enabled .podcast-item {
                display: none !important;
            }
            `;
            body.appendChild(style);
            body.classList.add('hide-podcasts--style-injected');
        }
    });
}


// Add our class to any podcast elements
function tagItems(documents) {
    documents.forEach(doc => {

        // Remove podcast sidebar link (only needs to run once)
        let podcastSidebarItem = doc.querySelector('.SidebarListItemLink[href="spotify:app:collection:podcasts"]');
        if (podcastSidebarItem) podcastSidebarItem.closest('.SidebarListItem').classList.add('podcast-item');

        // Run on app change
        // Remove podcast carousels (e.g. 'Home' and 'Made For You')
        let carousels = doc.querySelectorAll('.Carousel');
        carousels.forEach(carousel => {
            let title = carousel.querySelector('.GlueSectionDivider__title');
            title = title ? title.innerText : '';

            // It seems to tag podcast items with the Card--show class
            let podcastCards = carousel.querySelectorAll('.Card.Card--show');
            if (podcastCards.length > 0) {
                console.log(`Tagging carousel: ${title}`);
                carousel.classList.add('podcast-item');
            }
        });

        // Remove podcast tab from Browse (only in browse frame document)
        let tab = doc.body.querySelector('[data-navbar-item-id="spotify:app:browse:podcasts"]');
        if (tab) tab.classList.add('podcast-item');
    });
}

// Add/remove the body class that hides podcasts
function setState(documents, isEnabled) {
    documents.forEach(doc => {
        let body = doc.querySelector('body');
        if (isEnabled) body.classList.add('hide-podcasts-enabled');
        else body.classList.remove('hide-podcasts-enabled');
    });
}
