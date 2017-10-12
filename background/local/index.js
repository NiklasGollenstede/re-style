(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/utils/': { reportError, },
	'node_modules/native-ext/': Native,
	'common/options': options,
	'../chrome/': ChromeStyle,
	'../parser': Sheet,
	'../style': Style,
	'../util': { debounceIdle, },
	require,
}) => {

class LocalStyle extends Style {
	static get(id) { return styles.get(id); }
	static [Symbol.iterator]() { return styles[Symbol.iterator](); }
}

let native = null/*Port*/; const styles = new Map/*<id, LocalStyle>*/; let exclude = null/*RegExp*/;
let active = options.local.value; options.local.onChange(async ([ value, ]) => { try { (await (value ? enable() : disable())); } catch (error) { reportError(error); } });
let unloading = false; global.addEventListener('unload', () => (unloading = true));

if (active) { enable(true).catch(reportError); } else { if (global.__startupSyncPoint__) { global.__startupSyncPoint__(); } else { global.__startupSyncPoint__ = () => null; } }

async function enable(init) {
	if (active && !init) { return; } active = options.local.value = true;
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

	// console.log('got local styles', files);
	(await Promise.all(
		(await Promise.all(Object.entries(files).map(async ([ path, sheet, ]) => { try {
			if (exclude.test(path)) { return; }
			const style = (await new LocalStyle(path, ''));
			styles.set(style.id, style);
			style.disabled = true;
			(await style.setSheet(sheet.replace(/\r\n?/g, '\n')));
		} catch (error) { reportError(`Failed to add local style`, path, error); } })))
	));

	if (init) { // on initial enable, sync with ../remote/
		if (global.__startupSyncPoint__) { global.__startupSyncPoint__(); }
		else { (await Promise.race([ new Promise(done => (global.__startupSyncPoint__ = done)), require.async('../local/'), ])); }
		delete global.__startupSyncPoint__;
	}

	styles.forEach(style => { try { style.disabled = false; } catch (error) { reportError(`Failed to add local style`, error); } });

	if (!options.local.children.chrome.value) { return; }

	(await new Promise(done => debounceIdle(done, 2500)()));
	native.watchChrome(onChromeChange);
}

async function onCange(path, css) { try {
	const id = (await Style.url2id(path));
	const old = styles.get(id);
	if (old) { if (css) {
		console.info('change', path);
		old.setSheet(css);
	} else {
		console.info('delete', path);
		old.destroy(); styles.delete(id);
	} } else if (css) {
		console.info('create', path);
		const style = (await new LocalStyle(path, css));
		styles.set(id, style);
	}
} catch (error) { console.error('Error in fs.watch handler',  error); } }

async function onChromeChange(path, css) { try {
	console.log('onChromeChange start');
	if (!css) { return; } // file deleted
	const isChrome = (/[\/\\]userChrome[.]css$/).test(path);

	(await Promise.all(Object.entries(ChromeStyle.extractFiles(css.replace(/\r\n?/g, '\n'))).map(async ([ path, css, ]) => {
		const id = (await Style.url2id(path));
		const style = styles.get(id); if (!style) { return; }
		if (style.chrome[isChrome ? 'chrome' : 'content'] === css) { return; }

		const parts = [ style.code, ]; let lastPos = 0;
		const now = Sheet.fromCode(css.replace(/\/\*rS\*\/!important/g, ''), { onerror: error => { throw error; }, });
		const old = style.sheet, oldSections = old.sections.slice();

		for (const section of now.sections) {
			const oldSection = oldSections.find(old =>
				   section.urls.every(_=>old.urls.includes(_))
				&& section.urlPrefixes.every(_=>old.urlPrefixes.includes(_))
				&& section.domains.every(_=>old.domains.includes(_))
				&& section.regexps.every(_=>old.regexps.includes(_))
			);
			if (!oldSection) { console.error(`can't find old section for`, section.code); return; }
			oldSections.splice(oldSections.indexOf(oldSection), 1);
			if (sameArray(oldSection.tokens, section.tokens)) { continue; }
			if (!oldSection.location) { console.warn(`can't apply changes to global CSS`); continue; }
			parts.splice(parts.length - 1, 1, style.code.slice(lastPos, oldSection.location[0]), section.tokens.join(''), style.code.slice(lastPos = oldSection.location[1]));
		}

		const file = parts.join(''); if (file === style.code) { console.error('no change', path); return; }
		console.log('writing', style.url);
		native.writeStyle(path, file);
		style.setSheet(file);
	})));
	console.log('onChromeChange done');
} catch (error) { console.error('Error in fs.watch handler',  error); } }

function disable() {
	if (!active) { return; } active = options.local.value = false;
	// console.log('disable local styles');
	Array.from(styles.values(), _=>_.destroy()); styles.clear();
	native.release(onCange);
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
