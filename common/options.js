(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/browser/version': { firefox, },
	'node_modules/web-ext-utils/options/': Options,
}) => {
const isBeta = (/^\d+\.\d+.\d+(?!$)/).test((global.browser || global.chrome).runtime.getManifest().version); // version doesn't end after the 3rd number ==> bata channel

const model = {
	remote: {
		title: 'Online styles',
		default: true,
		children: {
			urls: {
				hidden: true,
				default: [ ],
				maxLength: Infinity,
				restrict: { type: 'string', },
			},
			updateNow: {
				default: true,
				input: { type: 'control', label: 'Update', suffix: `all remote styles from their origins and refreshes them if necessary.`, },
			},
			import: {
				default: true,
				input: [ { type: 'control', label: `Import`, suffix: `styles from a whitespace separated list of URLs.`, id: `import-from-urls`, }, ],
			},
			fetchWithNode: {
				default: false,
				restrict: { type: 'boolean', },
				input: { type: 'boolean', suffix: `use node.js to fetch scripts`, },
			},
		},
	},
	chrome: {
		title: 'UI Styles',
		description: `Starting with Firefox 57, it is no longer possible for Add-ons to directly apply user styles to anything else than normal websites.<br>
		As a workaround, ${ manifest.name } recognizes styles that will no longer work and writes them to the
		<code>userCrome.css</code> (e.g. for the UI) and <code>userContent.css</code> (e.g. for about:-pages) files of the current Firefox profile.<br>
		NOTE: This overwrites all previous content and all changes to those files.<br>
		NOTE: The browser must be restarted for changes to those files to apply.`,
		default: firefox, hidden: !firefox,
		restrict: { type: 'boolean', },
		input: { type: 'boolean', suffix: `enable`, },
		children: {
			profile: {
				expanded: false, hidden: firefox,
				title: 'Profile location',
				description: `To change the files in your browser profile, ${ manifest.name } needs to know where that profile is.
				There is a chance that this can be automatically detected. If not, you will see a corresponding error message.
				If that is the case, please paste the path to the root of the profile directory below.<br>
				To get that path, open <code>about:support</code>,
				click the "Open Folder" button in the "Profile Folder" row of its first table and copy that path.`,
				default: [ '', ],
				restrict: { type: 'string', },
				input: { type: 'string', },
			},
		},
	},
	local: {
		title: 'Development Mode',
		// expanded: false,
		description: `You can load local files as user styles.
		Styles matching normal content pages should be re-applied immediately when the files are saved.<br>
		To apply changes to any of the values below, dis- then enable this option`,
		default: true,
		restrict: { type: 'boolean', },
		input: { type: 'boolean', suffix: `enable`, },
		children: {
			folder: {
				title: 'Local folder',
				description: `All <abbr title="Files or folders starting with a '.' (dot) are considered hidden">non-hidden</abbr> files in this folder and its subfolders ending with <code>.css</code> are applied as user styles.`,
				default: [ ((/\(Windows/i).test(global.navigator.userAgent) ? 'C:' : '~') +'/dev/user-styles/', ],
				restrict: { type: 'string', },
				input: { type: 'string', },
			},
			exclude: {
				title: 'Exclude files',
				description: `A case-insensitive RegExp matching parts of names of <code>.css</code> files to ignore.`,
				default: [ 'thunderbird', ],
				restrict: { type: 'string', },
				input: { type: 'string', },
			},
			chrome: {
				title: 'Chrome debugging',
				description: `To develop chrome styles without restarting the browser after every change, you can open the <i>Browser Toolbox</i> (<code>Ctrl</code> + <code>Shift</code> + <code>Alt</code> + <code>I</code>)
				and ...
				`,
				default: true,
				restrict: { type: 'boolean', },
				input: { type: 'boolean', suffix: `enable`, },
			},
		},
	},
	debug: {
		title: 'Debug Level',
		expanded: false,
		default: +isBeta,
		hidden: !isBeta,
		restrict: { type: 'number', from: 0, to: 2, },
		input: { type: 'integer', suffix: `set to > 0 to enable debugging`, },
	},
};

return (await new Options({ model, })).children;

}); })(this);
