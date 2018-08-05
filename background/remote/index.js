(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/storage': { local: Storage, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'common/options': options,
	'../parser': { json2css, },
	'../style': Style,
	require,
}) => { /* global setTimeout, clearTimeout, */

/**
 * Restores all previously added `RemoteStyle`s
 * and handles the auto-update (if enabled).
 */

/**
 * Represents a style downloaded from the Internet.
 * Successfully added styles are automatically saved.
 */
class RemoteStyle extends Style {

	constructor() { return super(...arguments).then(_=>Style_constructor.call(_)); } // eslint-disable-line constructor-super

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

	get updated() { return Self.get(this).updated; }

	/**
	 * Permanently removes the style and deletes all associated information.
	 */
	async remove() { (await removeUrl(this.url)); this.destroy(true); }

	/// Returns a JSON object stat can be stored and later passed to `this.constructor.fromJSON`.
	toJSON() { return Object.assign(super.toJSON(), Self.get(this)); }

	/// Restores a RemoteStyle from it's JSON representation.
	static fromJSON(json) { return Style_constructor.call(Style.fromJSON.apply(this, arguments), json); }

	/// Retrieves a `Style` by its `.id`, only if it is a `RemoteStyle`.
	static get(id) { return styles.get(id); }
	/// Iterator over all `RemoteStyle` instances as [ id, style, ].
	static [Symbol.iterator]() { return styles[Symbol.iterator](); }
}

//// start implementation

// create, update, destroy handlers
const Self = new WeakMap;
function Style_constructor(json) {
	Self.set(this, { updated: json && json.updated || 0, });
	styles.set(this.id, this);
	this.onChanged(onChanged);
	return this;
}
async function onChanged(style, id) { try {
	void style.id;
} catch (_) { { // destroyed
	(await Storage.remove('remote.cache.'+ id));
	styles.delete(id); Self.delete(style);
} return; } { // updated
	Storage.set('remote.cache.'+ style.id, style.toJSON());
} }

const urlList = options.remote.children.urls.values; const styles = new Map/*<id, RemoteStyle>*/;

(async () => { // load existing
	const actions = [ ];
	(await Promise.all(urlList.current.map(async url => { try {
		const id = (await Style.url2id(url));
		const key = 'remote.cache.'+ id;
		const stored = Storage.get(key);
		if (stored) {
			actions.push(async () => { try {
				RemoteStyle.fromJSON(stored);
			} catch (error) {
				console.warn('failed to restore cached style', id, url, error, stored);
				const style = (await new RemoteStyle(url, ''));
				(await (await prepareUpdate(style))());
			} });
		} else {
			console.warn('cache missing for style', id, url);
			const style = (await new RemoteStyle(url, ''));
			actions.push((await prepareUpdate(style))); // TODO: test
		}
	} catch (error) { notify.error(`Failed to restore remote style`, url, error); } })));

	if (global.__startupSyncPoint__) { global.__startupSyncPoint__(); } // sync with ../local/
	else { (await new Promise((resolve, reject) => { global.__startupSyncPoint__ = resolve; require.async('../local/').catch(reject); })); }

	// add all restored styles at once, so that `ChromeStyle` and `WebStyle` don't need to update multiple times
	actions.forEach(async action => { try { (await action()); } catch (error) { notify.error(`Failed to restore remote style`, error); } });

	styles.forEach(_=>_.onChanged(onChanged));
})();

async function add(/*url*/) {
	const [ , url, query = '', ] = (/^(.*?)(?:$|\?(.*))/).exec(arguments[0]);
	if (urlList.current.includes(url)) { throw new Error(`URL ${ url } is already loaded as a style`); }

	const style = (await new RemoteStyle(url, ''));
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
	(await (await prepareUpdate(style, query))());
}
async function prepareUpdate(style, query) {
	query = query || style.options.query.value;
	const name = style.meta.name || 'to be added';

	let type, data; try {
		const reply = (await global.fetch(style.url + (query ? query.replace(/^\??/, '?') : '')));
		if (reply.status !== 200) { throw new Error(reply.statusText); }
		type = reply.headers.get('content-type'); data = (await reply.text());
	} catch (error) { throw new Error(`Failed to load style ${name}: ${error.message}`); }

	let code; if ((/^application\/json(?:;|$)/).test(type)) {
		try { code = json2css(data); }
		catch (_) { throw new TypeError(`Malformed JSON response for style ${name}`); }
	} else if ((/^text\/(?:css|plain)(?:;|$)/).test(type)) { // also accepts plain text as css
		code = data.replace(/\r\n?/g, '\n');
	} else {
		throw new TypeError(`Unexpected MIME-Type ${type} for style ${name}`);
	}
	return async () => {
		(await style.setSheet(code));
		Self.get(style).updated = Date.now();
		Storage.set('remote.cache.'+ style.id, style.toJSON()); // onChanged will only be called if `style.code` actually changed
	};
}


// TODO: the synchronous write-through cache of the options should render this obsolete
let running = Promise.resolve(); // like a mutex for mutation operations on the urlList
const insertUrl = url => queueUrlOp(urls => urls.push(url));
const removeUrl = url => queueUrlOp(urls => { const at = urls.indexOf(url); at >= 0 && urls.splice(at, 1); });
const queueUrlOp = op => new Promise((resolve, reject) => (running = running.then(async () => { try {
	const urls = urlList.current.slice(); op(urls);
	(await urlList.replace(urls));
	resolve();
} catch (error) { reject(error); } })));

// auto update
let updateTimer; options.remote.children.autoUpdate.when({ true() { updateTimer = setTimeout(async () => {
	const before = Date.now() - options.remote.children.autoUpdate.children.age.value * 3600e3;
	(await Promise.all((await Promise.all(
		[ ...styles.values(), ]
		.filter(style => !style.disabled && style.updated < before)
		.map(style => prepareUpdate(style).catch(notify.error))
	)).map(apply => apply && apply().catch(notify.error))));
	options.debug.value && console.info('remote styles updated');
}, (
	options.remote.children.autoUpdate.children.delay.value * 60e3 * (Math.random() + .5)
)); }, false: () => clearTimeout(updateTimer), });

return RemoteStyle;

}); })(this);
