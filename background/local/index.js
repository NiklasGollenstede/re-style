(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/loader/native': connect,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'fetch!./native.js': script,
	'common/options': options,
	'../style': Style,
	require,
}) => {
let native = null/*Port*/; const styles = new Map/*<path, Style>*/; let exclude = null/*RegExp*/;
let active = false; options.local.whenChange(async ([ value, ]) => { try { (await (value ? enable() : disable())); } catch (error) { reportError(error); } });
let unloading = false; global.addEventListener('unload', () => (unloading = true));

async function enable() {
	if (active) { return; } active = options.local.value = true;
	console.log('enable local styles');
	exclude = new RegExp(options.local.children.exclude.value || '^.^');
	native = (await connect({ script, sourceURL: require.toUrl('./native.js'), }));
	native.addHandler('log', console.log.bind(console, 'native log'));

	const files = (await native.request('readStyles', 'C:/dev/stylish/', onCange));
	native.afterEnded('release', onCange);

	console.log('got local styles', files);
	for (const [ path, css, ] of Object.entries(files)) {
		if (exclude.test(path)) { continue; }
		(await createStyle(path, css));
	}

	native.ended.then(() => global.setTimeout(() => {
		!unloading && active && reportError('Connection to native extension lost');
		// TODO: show permanent notification with option to restart
	}, 20));
}

async function onCange(path, css) { try {
	const old = styles.get(path);
	if (old) { if (css) {
		console.log('change', path);
		old.setSheet(css);
	} else {
		console.log('delete', path);
		old.destroy(); styles.delete(path);
	} } else if (css) {
		console.log('create', path);
		(await createStyle(path, css));
	}
} catch (error) { console.error('Error in fs.watch handler',  error); } }

function disable() {
	if (!active) { return; } active = options.local.value = false;
	console.log('disable local styles');
	Array.from(styles.values(), _=>_.destroy()); styles.clear();
	native && native.destroy(); native = null;
}

async function createStyle(path, css) {
	const style = (await new Style(path, css));
	styles.set(path, style);
	style.options.model.remove.hidden = true;
	style.options.children.refresh.onChange(resetAnd(() => reportError('Not implemented')));
	return style;
}

function resetAnd(action) { return function(_, __, { values, }) {
	if (!values.isSet) { return; } values.reset(); action.apply(null, arguments);
}; }

return {
	get native() { return native; },
	get styles() {
		return Array.from(styles.values())
		.sort((a, b) => a.url < b.url ? -1 : 1)
		.map(_=>_.options.children);
	},
};

}); })(this);
