
# reStyle — UI styles for Firefox 57

This user style manager supports the usual installation of styles from URL and polling those URLs for updates. In addition to that:


## UI styles

Starting with Firefox 57, it is no longer possible for Add-ons to directly apply user styles to anything else than normal websites.<br>
As a workaround, reStyle recognizes styles that will no longer work and writes them to the
<code>userCrome.css</code> (e.g. for the UI) and <code>userContent.css</code> (e.g. for about:-pages).<br>
NOTE: This overwrites all previous content and all changes to those files.<br>
NOTE: The browser must be restarted for changes to those files to ally.

Most UI styles will still be broken due to the actual changes in the browser UI, but at least it will be possible to fix that and distribute the styles in a reasonably simple manner.


## Development Mode

You can load local files as user styles.
Styles matching normal content pages should be re-applied immediately when the files are saved.<br>
To apply changes to any of the values below, dis- then enable this option.


## NativeExt

In order to do the things described above, [NativeExt](https://github.com/NiklasGollenstede/native-ext) must be installed on the system.
To allow reStyle to connect, add this JSON file to `%APPDATA%\de.niklasg.native_ext\vendors\de.niklasg.json`:
```json
{
	"firefox-ext-ids": [
		"@re-style"
	],
	"chrome-ext-urls": [ ]
}
```
Then run the `refresh.bat` in the directory above.

## Build

`npm install`
`npm start`
Then see the `/build/` directory.

Create `.png` icon from `.svg`:
`svgexport icon.svg icon.png :128`
Then compress with `pngquant`.
