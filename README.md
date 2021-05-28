# spicetify-hide-podcasts
[Spicetify](https://github.com/khanhas/spicetify-cli) extension to hide podcasts. 
* Hides podcast carousels on the homepage
* Hides the podcasts tab on the Your Library page
* Hides the podcasts genre card on the Search page
* Also removes mention of podcasts in the search entry placeholder text
## Install
Copy `hidePodcasts.js` into your [Spicetify](https://github.com/khanhas/spicetify-cli) extensions directory:
| **Platform** | **Path**                                                                            |
|------------|-----------------------------------------------------------------------------------|
| **Linux**      | `~/.config/spicetify/Extensions` or `$XDG_CONFIG_HOME/.config/spicetify/Extensions/` |
| **MacOS**      | `~/spicetify_data/Extensions` or `$SPICETIFY_CONFIG/Extensions`                      |
| **Windows**    | `%userprofile%\.spicetify\Extensions\`                                              |

After putting the extension file into the correct folder, run the following command to install the extension:
```
spicetify config extensions hidePodcasts.js
spicetify apply
```
Note: Using the `config` command to add the extension will always append the file name to the existing extensions list. It does not replace the whole key's value.

Or you can manually edit your `config-xpui.ini` file. Add your desired extension filenames in the extensions key, separated them by the | character.
Example:

```ini
[AdditionalOptions]
...
extensions = autoSkipExplicit.js|shuffle+.js|trashbin.js|hidePodcasts.js
```

Then run:

```
spicetify apply
```

## Usage
Toggle in the Profile menu.

[![Screenshot](screenshot.png)](https://raw.githubusercontent.com/theRealPadster/spicetify-hide-podcasts/main/screenshot.png)

## More
🌟 Like it? Gimme some love!    
[![Github Stars badge](https://img.shields.io/github/stars/theRealPadster/spicetify-hide-podcasts?logo=github&style=social)](https://github.com/theRealPadster/spicetify-hide-podcasts/)

If you find any bugs or places where podcasts are still showing up, please [create a new issue](https://github.com/theRealPadster/spicetify-hide-podcasts/issues/new/choose) on the GitHub repo.    
![https://github.com/theRealPadster/spicetify-hide-podcasts/issues](https://img.shields.io/github/issues/theRealPadster/spicetify-hide-podcasts?logo=github)
