
# reStyle — UI styles for Firefox 57

This user style manager supports the usual installation of styles from URL  and polling those URLs for updates.
In addition to that, you can load <b>local styles</b> and apply styles to the <b>browser UI</b>.

<b>Installing styles</b>

Styles can be installed from userstyles.org, GitHub or any other website that offers appropriate styles for download.
On userstyles.org, open the styles detail page, choose your settings if the style offers any, then click the reStyle icon in the browsers toolbar and "Add style" in the popup.
On other pages, you need to open the .css file before clicking the reStyle icon.

<b>UI styles</b>

Starting with Firefox 57, it is no longer possible for Add-ons to directly apply user styles to anything else than normal websites.
As a workaround, reStyle recognizes styles that will no longer work and writes them to the <a href="http://kb.mozillazine.org/index.php?title=UserChrome.css"><code>userCrome.css</code></a> (e.g. for the UI) and <a href="http://kb.mozillazine.org/index.php?title=userContent.css"><code>userContent.css</code></a> (e.g. for <code>about:</code>-pages).
The only major drawback of this compared to how Stylish for Firefox used to apply styles is that the browser must be restarted for changes to those files to be applied.
When developing styles, it is possible to avoid frequent restarts, see <b>Development Mode</b> for more information.

Many UI styles will still be broken in Firefox 57+ due to the actual changes in the browser UI, but at least it will be possible to fix that and distribute the styles in a reasonably simple manner.

<b>Development Mode</b>

You can load styles from a local folder on your computer as user styles.
Styles matching normal content pages should be re-applied immediately when the files are saved.

To develop chrome styles without restarting the browser after every change, the corresponding sections in the <code>userCrome.css</code>/<code>userContent.css</code> files can be edited through the Style Editor in the <i>Browser Toolbox</i> (<code>Ctrl</code> + <code>Shift</code> + <code>Alt</code> + <code>I</code>) or the page inspector on <code>about:</code>-pages.<br>
Firefox applies changes made there after a short delay, and when saving (<code>Ctrl</code>+<code>S</code>), writes the new files to the disc.
As an experimental feature, reStyle can detect these on-disc changes and map them back to the original (local) style files.

<b>NativeExt</b>

In order to do the things described above, <a href="https://github.com/NiklasGollenstede/native-ext">NativeExt</a> must be installed on the system.
The add-on contains instructions on how to do that easily.


<b>Permissions used</b>

- "Access your data for all websites": To apply styles to any website you choose.
- "Access browser tabs": Apply styles to existing tabs (when installed/enabled/started).
- "Access browser activity during navigation": Apply styles to new tabs/pages.
- "Exchange messages with programs other than Firefox": Use NativeExt if installed. Useless otherwise.
- "Display notifications to you": Success messages after user actions, error messages. <!-- Optional for --> Status changes.
- "Access recently closed tabs": Under some rare conditions, reStyle needs to open temporary popups. This is used to remove them from the history after they are closed.


<b>Implementation status</b>

Reading styles locally, re-applying them on changes and applying UI styles works as intended (there is no way around the restart requirement).
Applying normal content styles works, bit is still somewhat expensive. Improvements here require patches to Firefox.
Automatic updates of remote styles (those installed from the internet) can not be disabled per style.
The initial setup UI of this add-on itself still needs some work.

<b>Meta comments</b>

reStyle supports meta comment blocks similar to those used in user scripts. They start with <code>==UserStyle==</code> and can, besides the non-functional properties <code>@name</code>, <code>@author</code>, <code>@license</code> and <code>@description</code>, contain <code>@include</code> rules, which allow authors to wirte styles that can be included on domains chosen by the user via reStyles UI.


## Build

`npm install`
`npm start`
Then see the `/build/` directory.

Create `.png` icon from `.svg`:
`svgexport icon.svg icon.png :128`
Then compress with `pngquant`.


## Project layout

The internal style management is entirely handled by scripts in the `/background/` folder, `/common/` contains a declarative description of the `#options` the user can set, and `/views/` contains the `.js` and `.css` files that create reStyles UI (popup, extension pages).

### Styles

There are tow places styles can come from and two places they can go. Styles can be installed as
* [`RemoteStyle`](./background/remote/index.js)s from any URL that points at a `.css` file (or `.json` in the format used by `userstyles.org`)
* [`LocalStyle`](./background/remote/index.js)s from a user chosen directory on the local computer.

Both extend [`Style`](./background/style.js). Their code is [parsed](./background/parser.js) into a `Sheet` with each `@document` block as a `Section`.
When activated, the `Style` sorts through it's `Section`s and detects weather each section
* can be dynamically applied as a [`WebStyle`](./background/web/index.js)
* or has to be written to `userChrome`/`Content.css` as a [`ChromeStyle`](./background/chrome/index.js) (which has a `.chrome` and a `.content` property).

`RemoteStyle`s store a JSON representation of themselves in `browser.storage.local` and can be restored after restarts with quite little computational effort.
`LocalStyles` are re-parsed from their files on the disk at every start.

### Views

Every `.js` or `.html` file or folder with a `index.js` or `index.html` in the `/views/` folder will implicitly result in a extension page available as `...-extension://.../reStyle#<folder/file name without ext>`.
The scripts themselves are loaded in the background context and must export a function that will be passed the `window` of the visible page when one with the matching `#`-name is opened.


##  AMO code review notes

The exact version of the included YAML parser is <https://github.com/jeremyfa/yaml.js/blob/v0.3.0/dist/yaml.min.js>.
