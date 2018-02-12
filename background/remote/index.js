(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Storage: { local: Storage, }, },
	'node_modules/web-ext-utils/utils/': { reportError, },
	'common/options': options,
	'../style': Style,
	require,
}) => {

/**
 * Restores all previously added `RemoteStyle`s.
 */

/**
 * Represents a style downloaded from the Internet.
 * Successfully added styles are automatically saved.
 */
class RemoteStyle extends Style {

	/**
	 * Downloads, adds and saves a style from a remote url.
	 * Uses that url, excluding it's query, as the unique identifier of the style.
	 * @param  {string}       url  Url to fetch and update the style from. Can include a query part for settings.
	 * @return {RemoteStyle}       The new Style.
	 * @throws {Error}             If style fails to download or has a wrong MIME type.
	 */
	static async add(url) { return add(url); }

	/**
	 * Updates a style from it's original url including the query.
	 */
	async update() { return update(this); }
	/**
	 * Permanently removes the style and deletes all associated information.
	 */
	async remove() { return remove(this); }

	/**
	 * Restores a RemoteStyle from it's JSON representation.
	 */
	static fromJSON() { return Style.fromJSON.apply(this, arguments); }

	/// Retrieves a `Style` by its `.id`, only if it is a `RemoteStyle`.
	static get(id) { return styles.get(id); }
	/// Iterator over all `RemoteStyle` instances as [ id, style, ].
	static [Symbol.iterator]() { return styles[Symbol.iterator](); }
}

//// start implementation

const urlList = options.remote.children.urls.values; const styles = new Map/*<id, RemoteStyle>*/;

(async () => { // load existing
	const actions = [ ];
	(await Promise.all(urlList.current.map(async url => { try {
		const id = (await Style.url2id(url));
		const key = 'remote.cache.'+ id;
		const stored = (await Storage.get(key))[key];
		if (stored) {
			actions.push(() => styles.set(id, RemoteStyle.fromJSON(stored)));
		} else {
			const style = (await new RemoteStyle(url, ''));
			styles.set(style.id, style); style.onChanged(onChanged);
			style.disabled = true;
			(await update(style));
			actions.push(() => (style.disabled = false));
		}
	} catch (error) { reportError(`Failed to restore remote style`, url, error); } })));

	if (global.__startupSyncPoint__) { global.__startupSyncPoint__(); } // sync with ../local/
	else { (await new Promise((resolve, reject) => { global.__startupSyncPoint__ = resolve; require.async('../local/').catch(reject); })); }

	// add all restored styles at once, so that `ChromeStyle` and `WebStyle` don't need to update multiple times
	actions.forEach(action => { try { action(); } catch (error) { reportError(`Failed to restore remote style`, error); } });

	styles.forEach(_=>_.onChanged(onChanged));
})();

function onChanged(style) {
	Storage.set({ ['remote.cache.'+ style.id]: style.toJSON(), });
}

async function add(/*url*/) {
	const [ , url, query = '', ] = (/^(.*?)(?:$|\?(.*))/).exec(arguments[0]);
	if (urlList.current.includes(url)) { throw new Error(`URL ${ url } is already loaded as a style`); }

	const style = (await new RemoteStyle(url, ''));
	styles.set(style.id, style); style.onChanged(onChanged);
	query && (style.options.query.value = query);
	try {
		(await update(style, query));
		if (!style.code) { throw new Error(`Can not install an empty style sheet`); }
	} catch (error) {
		style.destroy();
		throw error;
	}

	(await insertUrl(url));
	return style;
}

async function update(style, query) {
	query = query || style.options.query.value;

	const reply = (await global.fetch(style.url + (query ? query.replace(/^\??/, '?') : '')));
	const type = reply.headers.get('content-type'), data = (await reply.text());

	if ((/^application\/json(?:;|$)/).test(type)) {
		const json = JSON.parse(data.replace(/\\r(?:\\n)?/g, '\\n'));
		// TODO: should do some basic data validation
		(await style.setSheet(json));
	} else if ((/^text\/(?:css|plain)(?:;|$)/).test(type)) { // also accepts plain text as css
		const css = data.replace(/\r\n?/g, '\n');
		(await style.setSheet(css));
	} else {
		throw new TypeError(`Unexpected MIME-Type ${ type } for style ${ style.name }`);
	}
}

async function remove(style) {
	const { id, url, } = style;

	(await Storage.remove('remote.cache.'+ id));
	(await removeUrl(url));

	style.destroy(true); styles.delete(id);
}

let running = Promise.resolve(); // like a mutex for mutation operations on the urlList
const insertUrl = url => queueUrlOp(urls => urls.push(url));
const removeUrl = url => queueUrlOp(urls => { const at = urls.indexOf(url); at >= 0 && urls.splice(at, 1); });
const queueUrlOp = op => new Promise((resolve, reject) => (running = running.then(async () => { try {
	const urls = urlList.current.slice(); op(urls);
	(await urlList.replace(urls));
	resolve();
} catch (error) { reject(error); } })));

return RemoteStyle;

}); })(this);
