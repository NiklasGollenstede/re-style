(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Storage: { local: Storage, }, },
	'node_modules/web-ext-utils/utils/': { reportError, },
	'common/options': options,
	'../style': Style,
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
	(await urlList.splice(0, 0, url));

	const style = (await createStyle(url));

	(await refresh(style));
}

async function load(url) {
	const style = (await createStyle(url));

	const key = 'remote.css.'+ style.id;
	const css = (await Storage.get(key))[key];
	(await style.setSheet(css));
}

async function refresh(style) {
	const hash = style.hash;

	const css = (await (await global.fetch(style.url)).text());

	(await style.setSheet(css));
	style.hash !== hash && (await Storage.set({ ['remote.css.'+ style.id]: css, }));
}

async function remove(style) {
	const { id, url, } = style;

	(await style.options.resetAll());
	style.destroy(); styles.delete(id);

	(await Storage.remove('remote.css.'+ id));
	(await urlList.splice(urlList.current.indexOf(url), 1));
}

function resetAndReport(action) { return async function(_, __, { values, }) {
	if (!values.isSet) { return; } values.reset();
	try { (await action.apply(null, arguments)); } catch (error) { reportError(error); }
}; }

return {
	addFromUrl,
	get styles() {
		return Array.from(styles.values())
		.sort((a, b) => a.url < b.url ? -1 : 1)
		.map(_=>_.options.children);
	},
};

}); })(this);
