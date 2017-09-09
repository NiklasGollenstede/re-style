(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/loader/native': connect,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'fetch!./native.js': script,
	'common/options': options,
	'../style': Style,
	require,
}) => {

class LocalStyle extends Style {
	static get(id) { return styles.get(id); }
	static [Symbol.iterator]() { return styles[Symbol.iterator](); }
}

let native = null/*Port*/; const styles = new Map/*<id, LocalStyle>*/; let exclude = null/*RegExp*/;
let active = options.local.value; options.local.onChange(async ([ value, ]) => { try { (await (value ? enable() : disable())); } catch (error) { reportError(error); } });
let unloading = false; global.addEventListener('unload', () => (unloading = true));

if (active) { (await enable(true)); } else { if (global.__startupSyncPoint__) { global.__startupSyncPoint__(); } else { global.__startupSyncPoint__ = () => null; } }

async function enable(init) {
	if (active && !init) { return; } active = options.local.value = true;
	// console.log('enable local styles');
	exclude = new RegExp(options.local.children.exclude.value || '^.^');
	native = (await connect({ script, sourceURL: require.toUrl('./native.js'), }));
	// native.addHandler('log', console.log.bind(console, 'native log'));

	const files = (await native.request('readStyles', options.local.children.folder.value, onCange));
	native.afterEnded('release', onCange);

	// console.log('got local styles', files);
	(await Promise.all(
		(await Promise.all(Object.entries(files).map(async ([ path, sheet, ]) => { try {
			if (exclude.test(path)) { return; }
			const style = (await new LocalStyle(path, ''));
			styles.set(style.id, style);
			style.disabled = true;
			(await style.setSheet(sheet));
		} catch (error) { reportError(`Failed to add local style`, path, error); } })))
	));

	if (init) { // on initial enable, sync with ../remote/
		if (global.__startupSyncPoint__) { global.__startupSyncPoint__(); }
		else { (await Promise.race([ new Promise(done => (global.__startupSyncPoint__ = done)), require.async('../local/'), ])); }
		delete global.__startupSyncPoint__;
	}

	styles.forEach(style => { try { style.disabled = false; } catch (error) { reportError(`Failed to add local style`, error); } });

	native.ended.then(() => global.setTimeout(() => {
		!unloading && active && reportError('Connection to native extension lost');
		// TODO: show permanent notification with option to restart
	}, 20));
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

function disable() {
	if (!active) { return; } active = options.local.value = false;
	// console.log('disable local styles');
	Array.from(styles.values(), _=>_.destroy()); styles.clear();
	native && native.destroy(); native = null;
}

return LocalStyle;

}); })(this);
