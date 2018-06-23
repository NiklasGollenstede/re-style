(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/loader/views': { openView, },
	'node_modules/web-ext-utils/utils/notify': notify,
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

	/// creates a new `.css` file in the local folder
	static async createStyle(name, file) {
		if (!native) { throw new Error(`Can only write files if NativeExt is set up and Development mode is enabled`); }
		const path = options.local.children.folder.value.replace(/([\\/])?$/, _=>_ || '/') + name;
		(await native.createStyle(path, file)); return path;
	}

	/// opens a `.css` file in the local folder with the systems default editor
	static async openStyle(name) {
		if (!native) { throw new Error(`Can only open files if NativeExt is set up and Development mode is enabled`); }
		const path = options.local.children.folder.value.replace(/([\\/])?$/, _=>_ || '/') + name;
		(await native.openStyle(path)); return path;
	}

	/// opens the `LocalStyle` file with the systems default editor
	async show() { (await native.openStyle(this.url)); }

	/// doesn't need to be restored from JSON

	/// Retrieves a `Style` by its `.id`, only if it is a `LocalStyle`.
	static get(id) { return styles.get(id); }
	/// Iterator over all `RemoteStyle` instances as [ id, style, ].
	static [Symbol.iterator]() { return styles[Symbol.iterator](); }
}

//// start implementation

let native = null/*exports*/, onSpawn, waiting;
const styles = new Map/*<id, LocalStyle>*/; let exclude = null/*RegExp*/;
options.local.children.folder.onChange(async () => {
	if (active) { try { disable(); (await enable()); } catch (error) { notify.error(error); } }
});
let active = options.local.value; options.local.onChange(async ([ value, ]) => {
	try { (await (value ? enable() : disable())); } catch (error) { notify.error(error); }
});
if (active) { enable(true).catch(notify.error); } else { letRemoteProceed(); }


// reads the local dir and starts listening for changes of it or the chrome/ dir
async function enable(init) {
	if (active && !init) { return; } active = options.local.value = true;

	if (!(await Native.getApplicationName({ stale: true, }))) { {
		notify.error('Set up NativeExt',
			`Loading local styles requires NativeExt, but it is not installed or not set up correctly.`,
		).then(_=>_ && openView('setup'));
		!waiting && (waiting = Native.getApplicationName({ blocking: true, }).then(() => enable()));
		active = false; letRemoteProceed();
	} return; } waiting = null;

	// console.log('enable local styles');
	exclude = new RegExp(options.local.children.exclude.value || '^.^');
	const files = (await Native.on((onSpawn = async process => {
		native = (await process.require(require.resolve('./native')));

		if (options.local.children.chrome.value) { debounceIdle(() => {
			files && active && native && native.watchChrome(onChromeChange);
		}, 2500)(); }

		return native.readStyles(options.local.children.folder.value, onCange);
	})));

	if (files === null) { {
		Native.on.removeListener(onSpawn); active = false; letRemoteProceed();
		notify.error(`Can't read local dir`, `The folder "${options.local.children.folder.value}" does not exist or can not be read. To use local styles, create the folder or change it in the options.`);
	} return; }

	// console.log('got local styles', files);
	(await Promise.all(
		(await Promise.all(Object.entries(files).map(async ([ path, css, ]) => { try {
			css && (css = css.replace(/\r\n?/g, '\n'));
			if (exclude.test(path)) { return; }
			const style = (await new LocalStyle(path, ''));
			styles.set(style.id, style);
			style.disabled = true;
			(await style.setSheet(css));
		} catch (error) { notify.error(`Failed to add local style`, path, error); } })))
	));

	if (init) { // on initial enable, sync with ../remote/
		if (global.__startupSyncPoint__) { global.__startupSyncPoint__(); }
		else { (await new Promise((resolve, reject) => { global.__startupSyncPoint__ = resolve; require.async('../remote/').catch(reject); })); }
		delete global.__startupSyncPoint__;
	}

	styles.forEach(style => { try { style.disabled = false; } catch (error) { notify.error(`Failed to add local style`, error); } });
}

function disable() {
	options.local.value = false; if (!active) { return; } active = false;
	// console.log('disable local styles');
	Array.from(styles.values(), _=>_.destroy()); styles.clear();

	native && native.release(onCange);
	native && native.release(onChromeChange);
	Native.on.removeListener(onSpawn); native = null;
}


// called when a .css file in the local dir was actually changed
async function onCange(path, css) { try {
	css && (css = css.replace(/\r\n?/g, '\n'));
	if (exclude.test(path)) { return; }
	const id = (await Style.url2id(path));
	const style = styles.get(id);
	if (style) { if (css) { // update
		const changed = (await style.setSheet(css));
		console.info(changed
			? `File ${path} was changed on disk, reloaded style "${style.options.name.value}"`
			: `Already knew changes in ${path}` // happens after changes caused by `onChromeChange`
		);
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
	// TODO: if local styles disabled return
	css && (css = css.replace(/\r\n?/g, '\n'));
	css = ChromeStyle.extractSection(css);
	if (!css) { return; } // file deleted / section cleared
	const type = (/[\\/]userChrome[.]css$/).test(path) ? 'chrome' : 'content';
	// TODO: expose `loaded` and `written` on ChromeStyle, then:
	// if (ChromeStyle.written[type] === css) { return; } // own write update
	// ChromeStyle.applied[type] = css; // assume update by browser, which means these styles are the actually loaded ones
	// // TODO: cause `ChromeStyle.onWritten` to fire (even if there are no changes to any styles), e.g. by calling a `.forceWrite()`, to make sure the badge is updated
	console.info(`${path.split(/\\|\//g).pop()} ${type} file changed, applying changes to local files in ${options.local.children.folder.value} (if any)`);

	// for each file segment ...
	(await Promise.all(Object.entries(ChromeStyle.parseFiles(css)).map(async ([ path, css, ]) => {
		const id = (await Style.url2id(path));
		const style = styles.get(id), old = style && style.chrome.sheets[type];
		if (!old) { console.error(`Unexpected chrome style section ${id}`); return; }
		if (style.chrome[type] === css) { return; } // the segment of the style actually changed
		const oldSections = old.sections.slice();

		const parts = [ style.code, ];
		const now = Sheet.fromCode(css.replace(/\/\*rS\*\/!important/g, ''), { onerror: error => { throw error; }, });
		!now.sections[0].tokens.length && now.sections.shift(); // should not have any global code anyway

		let lastPos = 0; for (const section of now.sections) { // for each `@document` section
			const oldSection = oldSections.find(old => // find old section with same includes
				   sameArray(section.urls, old.urls, 'value')
				&& sameArray(section.urlPrefixes, old.urlPrefixes, 'value')
				&& sameArray(section.domains, old.domains, 'value')
				&& sameArray(section.regexps, old.regexps, 'value')
			);
			if (!oldSection) { console.error(`can't find old section for`, { code: section.tokens.join(''), }); return; }
			oldSections.splice(oldSections.indexOf(oldSection), 1); // only use each old section once
			if (sameArray(oldSection.tokens, section.tokens)) { continue; } // section wasn't changed
			if (!oldSection.location) { console.warn(`can't apply changes to global CSS`); continue; }

			// "un-apply" any user-overwritten options
			const newSetction = section.cloneWithoutIncludes();
			const prefs = { }; style.options.options.children.forEach(
				({ name, default: value, values: { isSet, }, model: { unit, }, }) =>
				isSet && (prefs[name] = value + (unit || ''))
			); Object.keys(prefs).length && newSetction.setOptions(prefs);

			// write the changed section
			parts.splice( // TODO: this requires the sections to stay in the same order
				parts.length - 1, 1, // pop last
				style.code.slice(lastPos, oldSection.location[0]),
				newSetction.tokens.join(''), // new code with user selected settings applied
				style.code.slice(lastPos = oldSection.location[1])
			);
		}

		const file = parts.join(''); if (file === style.code) { console.error('no change', path); return; }
		console.info(`Found change in "${style.options.name.value}", writing ${style.url}`);
		native.writeStyle(path, file);
		style.setSheet(file);
	})));
} catch (error) { console.error('Error in fs.watch handler', error); } }

function letRemoteProceed() { if (global.__startupSyncPoint__) {
	global.__startupSyncPoint__();
} else {
	global.__startupSyncPoint__ = () => null;
} }

return LocalStyle;

function sameArray(a, b, key) {
	if (a === b) { return true; }
	if (a.length !== b.length) { return false; }
	if (key == null) {
		for (let i = 0, l = a.length; i < l; ++i) {
			if (a[i] !== b[i]) { return false; }
		}
	} else {
		for (let i = 0, l = a.length; i < l; ++i) {
			if (a[i] !== b[i] && (!a[i] || !b[i] || a[i][key] !== b[i][key])) { return false; }
		}
	}
	return true;
}

}); })(this);
