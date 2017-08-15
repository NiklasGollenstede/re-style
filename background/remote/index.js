(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Storage: { local: Storage, }, },
	'node_modules/web-ext-utils/loader/native': connect,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'fetch!./native.js': script,
	'common/options': options,
	'../style': Style,
	require,
}) => {

const urlList = options.remote.children.urls.values; const styles = new Map/*<id, Style>*/;

(await Promise.all(urlList.current.map(url => load(url))));

options.remote.children.refreshNow.onChange(resetAndReport(() => {
	Promise.all(Array.from(styles.values(), style => refresh(style))).catch(reportError);
}));

async function createStyle(url) {
	const style = (await new Style(url, ''));
	styles.set(style.id, style);
	style.options.children.refresh.onChange(resetAndReport(() => refresh(style)));
	style.options.children.remove .onChange(resetAndReport(() => remove(style)));
	return style;
}

async function addFromUrl(url) {
	if (urlList.current.includes(url)) { throw new Error(`URL ${ url } is already loaded as a style`); }

	const style = (await createStyle(url));
	(await refresh(style));

	(await insertUrl(url));
}

async function load(url) {
	const style = (await createStyle(url));

	const key = 'remote.css.'+ style.id;
	const css = (await Storage.get(key))[key];
	(await style.setSheet(css));
}

async function refresh(style) {
	const hash = style.hash;

	const css = (await fetchText(style.url));

	(await style.setSheet(css));
	style.hash !== hash && (await Storage.set({ ['remote.css.'+ style.id]: css, }));
}

async function remove(style) {
	const { id, url, } = style;

	(await Storage.remove('remote.css.'+ id));
	(await removeUrl(url));

	(await style.options.resetAll());
	style.destroy(); styles.delete(id);
}

function resetAndReport(action) { return async function(_, __, { values, }) {
	if (!values.isSet) { return; } values.reset();
	try { (await action.apply(null, arguments)); } catch (error) { reportError(error); }
}; }

async function fetchText(url) {
	if (!options.remote.children.fetchWithNode.value) {
		return (await global.fetch(url)).text();
	} else {
		const native = (await connect({ script, sourceURL: require.toUrl('./native.js'), }));
		const text = (await native.request('fetchText', url));
		native.destroy();
		return text;
	}
}

let running = Promise.resolve(); // like a mutex for mutation operations on the urlList
const insertUrl = url => queueUrlOp(urls => urls.push(url));
const removeUrl = url => queueUrlOp(urls => { const at = urls.indexOf(url); at >= 0 && urls.splice(at, 1); });
const queueUrlOp = op => new Promise((resolve, reject) => (running = running.then(async () => { try {
	const urls = urlList.current.slice(); op(urls);
	(await urlList.replace(urls));
	resolve();
} catch (error) { reject(error); } })));

return {
	addFromUrl,
	get styles() {
		return Array.from(styles.values())
		.sort((a, b) => a.url < b.url ? -1 : 1)
		.map(_=>_.options.children);
	},
};

}); })(this);
