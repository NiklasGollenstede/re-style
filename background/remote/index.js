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

{ // load existing
	(await Promise.all(
		(await Promise.all(urlList.current.map(url => Style.url2id(url))))
		.map(id => 'remote.cache.'+ id)
		.map(key => Storage.get(key).then(_=>_[key]))
	)).forEach(stored => {
		const style = Style.fromJSON(stored);
		styles.set(style.id, style);
	});
}

options.remote.children.updateNow.onChange(resetAndReport(() => {
	Promise.all(Array.from(styles.values(), style => update(style))).catch(reportError);
}));

async function add(url) {
	if (urlList.current.includes(url)) { throw new Error(`URL ${ url } is already loaded as a style`); }

	const style = (await new Style(url, ''));
	styles.set(style.id, style);
	(await update(style.id));

	(await insertUrl(url));
	return style.id;
}

async function update(id) {
	const style = styles.get(id);

	const css = (await fetchText(style.url));

	(await style.setSheet(css))
	&& (await Storage.set({ ['remote.cache.'+ style.id]: style.toJSON(), }));
}

async function remove(id) {
	const style = styles.get(id), url = style.url;

	(await Storage.remove('remote.cache.'+ id));
	(await removeUrl(url));

	(await (await style.options).resetAll());
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

async function setDisabled(id, disabed) {
	const style = styles.get(id);
	if (style.disabled === disabed) { return; }
	style.disabled = disabed;
	(await Storage.set({ ['remote.cache.'+ style.id]: style.toJSON(), }));
}

return {
	add, update, remove,
	async enable(id) { return setDisabled(id, false); },
	async disable(id) { return setDisabled(id, true); },
	async get() {
		return (await Promise.all(
			Array.from(styles.values())
			.sort((a, b) => a.url < b.url ? -1 : 1)
			.map(_=>_.options)
		)).map(_=>_.children);
	},
};

}); })(this);
