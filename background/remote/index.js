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
	const actions = [ ];
	(await Promise.all(urlList.current.map(async url => { try {
		const id = (await Style.url2id(url));
		const key = 'remote.cache.'+ id;
		const stored = (await Storage.get(key))[key];
		if (stored) {
			actions.push(() => styles.set(id, Style.fromJSON(stored)));
		} else {
			const style = (await new Style(url, ''));
			styles.set(style.id, style); style.onChanged(onChanged);
			style.disabled = true;
			(await update(style.id));
			actions.push(() => (style.disabled = false));
		}
	} catch (error) { reportError(`Failed to restore Style`, url, error); } })));

	if (global.__startupSyncPoint__) { global.__startupSyncPoint__(); } // sync with ../local/
	else { (await Promise.race([ new Promise(done => (global.__startupSyncPoint__ = done)), require.async('../local/'), ])); }

	// enable all styles at once to allow later optimizations
	actions.forEach(action => { try { action(); } catch (error) { reportError(`Failed to restore Style`, error); } });

	styles.forEach(_=>_.onChanged(onChanged));
}

function onChanged(style) {
	Storage.set({ ['remote.cache.'+ style.id]: style.toJSON(), });
}

async function add(/*url*/) {
	const [ , url, query = '', ] = (/^(.*?)(?:$|\?(.*))/).exec(arguments[0]);
	if (urlList.current.includes(url)) { throw new Error(`URL ${ url } is already loaded as a style`); }

	const style = (await new Style(url, ''));
	styles.set(style.id, style); style.onChanged(onChanged);
	query && (style.options.query.value = query);
	(await update(style.id, query));

	(await insertUrl(url));
	return style.id;
}

async function update(id, query) {
	const style = styles.get(id);
	query = query || style.options.query.value;

	const { data, type, } = (await fetchText(style.url + (query ? query.replace(/^\??/, '?') : '')));

	let changed = false; if (!(/^text\/css$/).test(type)) {
		const json = JSON.parse(data);
		// TODO: should do some basic data validation
		changed = (await style.setSheet(json));
	} else if (!(/^application\/json$/).test(type)) {
		changed = (await style.setSheet(data));
	} else {
		throw new TypeError(`Unexpected MIME-Type ${ type } for style ${ style.name }`);
	}
}

async function remove(id) {
	const style = styles.get(id), url = style.url;

	(await Storage.remove('remote.cache.'+ id));
	(await removeUrl(url));

	style.destroy(true); styles.delete(id);
}

async function updateAll() {
	const updated = [ ], failed = [ ];
	(await Array.from(styles.values(),
		style => update(style.id).then(() => updated.push(style))
		.catch(error => { console.error(error); failed.push(style); })
	));
	return { updated, failed, };
}

async function fetchText(url) {
	if (!options.remote.children.fetchWithNode.value) {
		const reply = (await global.fetch(url));
		const type = reply.headers.get('content-type');
		return { data: (await reply.text()), type, };
	} else {
		const native = (await connect({ script, sourceURL: require.toUrl('./native.js'), }));
		const reply = (await native.request('fetchText', url));
		native.destroy();
		return reply;
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

async function setDisabled(id, disabled) {
	const style = styles.get(id);
	if (style.disabled === disabled) { return; }
	style.disabled = disabled;
	(await Storage.set({ ['remote.cache.'+ style.id]: style.toJSON(), }));
}

return {
	add, update, updateAll, remove,
	async enable(id) { return setDisabled(id, false); },
	async disable(id) { return setDisabled(id, true); },
	get() { return Array.from(styles.values()).sort((a, b) => a.url < b.url ? -1 : 1); },
};

}); })(this);
