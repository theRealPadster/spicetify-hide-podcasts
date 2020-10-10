// @ts-check

// NAME: Hide Podcasts
// AUTHOR: theRealPadster
// DESCRIPTION: Hide podcasts. Toggle in Profile menu. Based on ChristianSpotify extension.

/// <reference path="../globals.d.ts" />

(function HidePodcasts() {
    if (!Spicetify.LocalStorage) {
        setTimeout(HidePodcasts, 1000);
        return;
    }

    let isEnabled = Spicetify.LocalStorage.get('HidePodcastsMode') === '1';

    new Spicetify.Menu.Item('Hide podcasts', isEnabled, (self) => {
        isEnabled = !isEnabled;
        Spicetify.LocalStorage.set('HidePodcastsMode', isEnabled ? '1' : '0');
        self.setState(isEnabled);
    }).register();

    // Remove podcast sidebar link
    let podcastSidebarItem = document.querySelector('.SidebarListItemLink[href="spotify:app:collection:podcasts"]');
    if (podcastSidebarItem) podcastSidebarItem.closest('.SidebarListItem').remove();

    Spicetify.Player.addEventListener('appchange', () => {
        if (!isEnabled) return;

        // Remove podcast carousels (e.g. 'Home' and 'Made For You')
        let carousels = document.querySelectorAll('.Carousel');
        carousels.forEach(carousel => {
            let title = carousel.querySelector('.GlueSectionDivider__title');
            title = title ? title.innerText : '';
            let description = carousel.querySelector('.GlueSectionDivider__description');
            description = description ? description.innerText : '';
            if (title.includes('Podcast') || description.includes('Podcast')) {
                console.log(`Removing carousel: ${title}`);
                carousel.remove();
            }
        });

        // Remove podcast tab from Browse
        let browseFrame = document.getElementById('app-browse');
        if (browseFrame) {
            let doc = browseFrame.contentDocument;
            let tab = doc.body.querySelector('[data-navbar-item-id="spotify:app:browse:podcasts"]');
            if (tab) tab.remove();
        }
    });
})();
