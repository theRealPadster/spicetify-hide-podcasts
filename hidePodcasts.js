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

    const SETTINGS_KEY = 'HidePodcastsMode';

    injectCSS();
    tagItems();

    let isEnabled = LocalStorage.get(SETTINGS_KEY) === '1';
    setState(isEnabled);

    // Add menu item and menu click handler
    new Menu.Item('Hide podcasts', isEnabled, (self) => {
        isEnabled = !isEnabled;
        LocalStorage.set(SETTINGS_KEY, isEnabled ? '1' : '0');
        self.setState(isEnabled);
        setState(isEnabled);
    }).register();

    Player.addEventListener('appchange', () => {
        if (!isEnabled) return;
        tagItems();
    });
})();

// Inject the css that allows us to toggle podcasts
function injectCSS() {
    let style = document.createElement('style');
    style.innerHTML =
    `
    .hide-podcasts-enabled .podcast-item {
        display: none;
    }
    `;
    document.querySelector('body').appendChild(style);
}

// Add our class to any podcast elements
function tagItems() {
    // Remove podcast sidebar link (only needs to run once)
    let podcastSidebarItem = document.querySelector('.SidebarListItemLink[href="spotify:app:collection:podcasts"]');
    if (podcastSidebarItem) podcastSidebarItem.closest('.SidebarListItem').classList.add('podcast-item');

    // Run on app change
    // Remove podcast carousels (e.g. 'Home' and 'Made For You')
    let carousels = document.querySelectorAll('.Carousel');
    carousels.forEach(carousel => {
        let title = carousel.querySelector('.GlueSectionDivider__title');
        title = title ? title.innerText : '';
        let description = carousel.querySelector('.GlueSectionDivider__description');
        description = description ? description.innerText : '';
        if (title.includes('Podcast') || description.includes('Podcast')) {
            console.log(`Tagging carousel: ${title}`);
            carousel.classList.add('podcast-item');
        }
    });

    // Remove podcast tab from Browse
    let browseFrame = document.getElementById('app-browse');
    if (browseFrame) {
        let doc = browseFrame.contentDocument;
        let tab = doc.body.querySelector('[data-navbar-item-id="spotify:app:browse:podcasts"]');
        if (tab) tab.classList.add('podcast-item');
    }
}

// Add/remove the body class that hides podcasts
function setState(isEnabled) {
    let body = document.querySelector('body');
    if (isEnabled) body.classList.add('hide-podcasts-enabled');
    else body.classList.remove('hide-podcasts-enabled');
}
