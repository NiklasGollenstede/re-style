(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/browser/storage': { sync: storage, },
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
				input: [ { type: 'control', label: `Import`, suffix: `remote styles from a whitespace separated list of URLs.`, }, ],
			},
			export: {
				default: true,
				input: [ { type: 'control', label: `Export`, suffix: `all remote styles as a list of URLs.`, }, ],
			},
		},
	},
	chrome: {
		title: 'UI Styles',
		description: `Starting with Firefox 57, it is no longer possible for Add-ons to directly apply user styles to anything else than normal websites.<br>
		As a workaround, ${ manifest.name } recognizes styles that will no longer work and writes them to the <code>userCrome.css</code> (e.g. for the UI) and <code>userContent.css</code> (e.g. for about:-pages) files of the current Firefox profile.<br>
		NOTE: The browser must be restarted for changes to those files to apply.`,
		default: firefox, hidden: !firefox,
		restrict: { type: 'boolean', },
		input: { type: 'boolean', suffix: `enable`, },
	},
	local: {
		title: 'Development Mode',
		// expanded: false,
		description: `You can load local files as user styles.
		Styles matching normal web pages should be re-applied immediately when the files are saved.<br>
		To apply changes to any of the values below, dis- then enable this option`,
		default: false,
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
				description: `To develop chrome styles without restarting the browser after every change, the corresponding sections in the <code>userCrome.css</code>/<code>userContent.css</code> files can be edited through the Style Editor in the <i>Browser Toolbox</i> (<code>Ctrl</code> + <code>Shift</code> + <code>Alt</code> + <code>I</code>) or the page inspector on <code>about:</code>-pages.<br>
				Firefox applies changes made there after a short delay, and when saving (<code>Ctrl</code>+<code>S</code>), writes the new files to the disc.
				As an <b>experimental</b> feature, reStyle can detect these on-disc changes and map them back to the original (local) style files.<br>
				Activate at your own risc and always make backups!`,
				default: false,
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
		input: { type: 'integer', suffix: `set to > 0 to enable some diagnostic logging`, },
	},
};

return (await new Options({ model, storage, prefix: 'options', })).children;

}); })(this);
