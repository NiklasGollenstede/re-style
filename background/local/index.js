(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/loader/native': connect,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'fetch!./native.js': script,
	'common/options': options,
	'../style': Style,
	require,
}) => {
let native = null/*Port*/; const styles = new Map/*<id, Style>*/; let exclude = null/*RegExp*/;
let active = false; options.local.whenChange(async ([ value, ]) => { try { (await (value ? enable() : disable())); } catch (error) { reportError(error); } });
let unloading = false; global.addEventListener('unload', () => (unloading = true));

async function enable() {
	if (active) { return; } active = options.local.value = true;
	// console.log('enable local styles');
	exclude = new RegExp(options.local.children.exclude.value || '^.^');
	native = (await connect({ script, sourceURL: require.toUrl('./native.js'), }));
	// native.addHandler('log', console.log.bind(console, 'native log'));

	const files = (await native.request('readStyles', options.local.children.folder.value, onCange));
	native.afterEnded('release', onCange);

	// console.log('got local styles', files);
	(await Promise.all(
		(await Promise.all(Object.keys(files).map(path => !exclude.test(path) && new Style(path, ''))))
		.filter(_=>_).map(async style => {
			styles.set(style.id, style);
			try { (await style.setSheet(files[style.url])); }
			catch (error) { reportError(`Failed to add local style`, style.url, error); }
		})
	));

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
		const style = (await new Style(path, css));
		styles.set(id, style);
	}
} catch (error) { console.error('Error in fs.watch handler',  error); } }

function disable() {
	if (!active) { return; } active = options.local.value = false;
	// console.log('disable local styles');
	Array.from(styles.values(), _=>_.destroy()); styles.clear();
	native && native.destroy(); native = null;
}

return {
	get _native() { return native; },
	enable(id) { styles.get(id).disabled = false; },
	disable(id) { styles.get(id).disabled = true; },
	async get() {
		return (await Promise.all(
			Array.from(styles.values())
			.sort((a, b) => a.url < b.url ? -1 : 1)
			.map(_=>_.options)
		)).map(_=>_.children);
	},
};

}); })(this);
