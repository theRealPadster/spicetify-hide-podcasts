# spicetify-hide-podcasts
[Spicetify](https://github.com/spicetify/spicetify-cli) extension to hide podcasts. 
* Hides podcast carousels on the homepage
* Hides the podcasts tab on the Your Library page
* Hides the "Your Episodes" sidebar section
* Hides the podcasts genre card on the Search page
## Install
Copy `hidePodcasts.js` into your [Spicetify](https://github.com/spicetify/spicetify-cli) extensions directory:
| **Platform** | **Path**                                                                               |
|------------|------------------------------------------------------------------------------------------|
| **Linux**      | `~/.config/spicetify/Extensions` or `$XDG_CONFIG_HOME/.config/spicetify/Extensions/` |
| **MacOS**      | `~/.config/spicetify/Extensions` or `$SPICETIFY_CONFIG/Extensions`                   |
| **Windows**    | `%appdata%/spicetify/Extensions/`                                               |

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
Toggle in the profile menu. Aggressive mode constantly watches the page for changes instead of stopping once initial load is complete. This should help if you face issues with podcast content loading in later on. 

[![Screenshot](screenshot.png)](https://raw.githubusercontent.com/theRealPadster/spicetify-hide-podcasts/main/screenshot.png)

## More
🌟 Like it? Gimme some love!    
[![Github Stars badge](https://img.shields.io/github/stars/theRealPadster/spicetify-hide-podcasts?logo=github&style=social)](https://github.com/theRealPadster/spicetify-hide-podcasts/)

If you find any bugs or places where podcasts are still showing up, please [create a new issue](https://github.com/theRealPadster/spicetify-hide-podcasts/issues/new/choose) on the GitHub repo.    
![https://github.com/theRealPadster/spicetify-hide-podcasts/issues](https://img.shields.io/github/issues/theRealPadster/spicetify-hide-podcasts?logo=github)
