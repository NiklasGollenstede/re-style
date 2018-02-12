(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/loader/views': { openView, },
	'node_modules/web-ext-utils/utils/': { reportError, },
	'node_modules/native-ext/': Native,
	'common/options': options,
	'../chrome/': ChromeStyle,
	'../parser': Sheet,
	'../style': Style,
	'../util': { debounceIdle, },
	require,
}) => {

/**
 * If `options.local` is enabled, this module recursively reads all files from `options.local.folder`
 * and creates `LocalStyle`s for all non-hidden `.css` files therein.
 * Then it monitors the folder for changes and applies them to the existing `Style`s.
 * If `options.local.chrome` is enabled, it also monitors the `userChrome`/`Content.css` files;
 * if they are edited though firefox' dev tools, the changes are mapped back to the original source files.
 */

/**
 * Represents a style loaded from the local disk.
 * LocalStyles are loaded anew every time the extension starts and ace not cached.
 */
class LocalStyle extends Style {
	/// doesn't need any methods or be restored from JSON

	/// Retrieves a `Style` by its `.id`, only if it is a `RemoteStyle`.
	static get(id) { return styles.get(id); }
	/// Iterator over all `RemoteStyle` instances as [ id, style, ].
	static [Symbol.iterator]() { return styles[Symbol.iterator](); }
}

//// start implementation

let native = null/*Port*/; const styles = new Map/*<id, LocalStyle>*/; let exclude = null/*RegExp*/;
let active = options.local.value; options.local.onChange(async ([ value, ]) => { try { (await (value ? enable() : disable())); } catch (error) { reportError(error); } });
let unloading = false; global.addEventListener('unload', () => (unloading = true));

if (active) { enable(true).catch(reportError); } else { if (global.__startupSyncPoint__) { global.__startupSyncPoint__(); } else { global.__startupSyncPoint__ = () => null; } }

// reads the local dir and starts listening for changes of it or the chrome/ dir
async function enable(init) {
	if (active && !init) { return; } active = options.local.value = true;

	if (!(await Native.test())) {
		reportError(`NativeExt unaviable`, `${manifest.name} could not connect to it's native counterpart. To use local styles, please follow the setup instructions.`);
		disable(); openView('setup'); return;
	}

	// console.log('enable local styles');
	exclude = new RegExp(options.local.children.exclude.value || '^.^');
	native = (await Native.require(
		require.resolve('./native'),
		{ onDisconnect: () => global.setTimeout(() => {
			!unloading && active && reportError('Connection to native extension lost');
			// TODO: show permanent notification with option to restart
		}, 20), },
	));

	const files = (await native.readStyles(options.local.children.folder.value, onCange));

	if (files === null) { return void reportError(`Can't read local dir`,
		`The folder "${options.local.children.folder.value}" does not exist of can not be read. To use local styles, create the folder or change it in the options.`
	); }

	// console.log('got local styles', files);
	(await Promise.all(
		(await Promise.all(Object.entries(files).map(async ([ path, css, ]) => { try {
			css && (css = css.replace(/\r\n?/g, '\n'));
			if (exclude.test(path)) { return; }
			const style = (await new LocalStyle(path, ''));
			styles.set(style.id, style);
			style.disabled = true;
			(await style.setSheet(css));
		} catch (error) { reportError(`Failed to add local style`, path, error); } })))
	));

	if (init) { // on initial enable, sync with ../remote/
		if (global.__startupSyncPoint__) { global.__startupSyncPoint__(); }
		else { (await new Promise((resolve, reject) => { global.__startupSyncPoint__ = resolve; require.async('../remote/').catch(reject); })); }
		delete global.__startupSyncPoint__;
	}

	styles.forEach(style => { try { style.disabled = false; } catch (error) { reportError(`Failed to add local style`, error); } });

	if (!options.local.children.chrome.value) { return; }

	(await new Promise(done => debounceIdle(done, 2500)()));
	native.watchChrome(onChromeChange);
}

// called when a .css file in the local dir was actually changed
async function onCange(path, css) { try {
	css && (css = css.replace(/\r\n?/g, '\n'));
	if (exclude.test(path)) { return; }
	const id = (await Style.url2id(path));
	const style = styles.get(id);
	if (style) { if (css) { // update
		const changed = (await style.setSheet(css));
		console.info(changed ? `File ${path} was changed on disk, reloaded style "${style.options.name.value}"` : `Already knew changes in ${path}`);
	} else { // delete
		console.info(`File ${path} was deleted, removing style "${style.options.name.value}"`);
		style.destroy(); styles.delete(id);
	} } else if (css) { // create
		const style = (await new LocalStyle(path, css)); styles.set(id, style);
		console.info(`File ${path} was created, added style "${style.options.name.value}"`);
	} // else deleted non-existing
} catch (error) { console.error('Error in fs.watch handler', error); } }

// called when `userChrome`/`Content.css` was changed
async function onChromeChange(path, css) { try {
	css && (css = css.replace(/\r\n?/g, '\n'));
	if (!css) { return; } // file deleted
	console.info(`${path.split(/\\|\//g).pop()} changed, applying changes to local files in ${options.local.children.folder.value} (if any)`);
	const isChrome = (/[\/\\]userChrome[.]css$/).test(path);

	// for each file segment ...
	(await Promise.all(Object.entries(ChromeStyle.extractFiles(css)).map(async ([ path, css, ]) => {
		const id = (await Style.url2id(path));
		const style = styles.get(id); if (!style) { return; }
		if (style.chrome[isChrome ? 'chrome' : 'content'] === css) { return; }
		// the segment of the style actually changed

		const parts = [ style.code, ];
		const now = Sheet.fromCode(css.replace(/\/\*rS\*\/!important/g, ''), { onerror: error => { throw error; }, });
		const old = style.sheet, oldSections = old.sections.slice();

		let lastPos = 0; for (const section of now.sections) { // each `@document` section
			const oldSection = oldSections.find(old => // find old section with same includes
				   sameArray(section.urls, old.urls)
				&& sameArray(section.urlPrefixes, old.urlPrefixes)
				&& sameArray(section.domains, old.domains)
				&& sameArray(section.regexps, old.regexps)
			);
			if (!oldSection) { console.error(`can't find old section for`, section.code); return; }
			oldSections.splice(oldSections.indexOf(oldSection), 1); // only use each old section once
			if (sameArray(oldSection.tokens, section.tokens)) { continue; } // section wasn't changed
			if (!oldSection.location) { console.warn(`can't apply changes to global CSS`); continue; }
			parts.splice( // this requires the sections to stay in the same order
				parts.length - 1, 1, // pop last
				style.code.slice(lastPos, oldSection.location[0]),
				section.tokens.join(''),
				style.code.slice(lastPos = oldSection.location[1])
			);
		}

		const file = parts.join(''); if (file === style.code) { console.error('no change', path); return; }
		console.info(`Found change in "${style.options.name.value}", writing ${style.url}`);
		native.writeStyle(path, file);
		style.setSheet(file);
	})));
} catch (error) { console.error('Error in fs.watch handler', error); } }

function disable() {
	if (!active) { return; } active = options.local.value = false;
	// console.log('disable local styles');
	Array.from(styles.values(), _=>_.destroy()); styles.clear();
	native && native.release(onCange);
	Native.unref(native); native = null;
}

return LocalStyle;

function sameArray(a, b) {
	if (a === b) { return true; }
	if (a.length !== b.length) { return false; }
	for (let i = 0, l = a.length; i < l; ++i) {
		if (a[i] !== b[i]) { return false; }
	}
	return true;
}

}); })(this);
