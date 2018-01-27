(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { WebNavigation, Tabs, },
	'node_modules/web-ext-utils/browser/version': { blink, gecko, },
	'common/options': options,
}) => {
let debug; options.debug.whenChange(([ value, ]) => { debug = value; });

class ContentStyle {
	constructor(url, code) {
		this.url = url;
		this.code = code.toString({ minify: false, important: true, namespace: true, })
		+ `\n/* ${ Math.random().toString(32).slice(2) } */`; // avoid conflicts
		styles.add(this); styles.size === 1 && WebNavigation.onCommitted.addListener(onNavigation);
		toAdd.add(this.code); refresh();
	}

	destroy() {
		if (!styles.has(this)) { return; }
		styles.delete(this); styles.size === 0 && WebNavigation.onCommitted.removeListener(onNavigation);
		toRemove.add(this.code); refresh();
		this.code = this.url = null;
	}

	toJSON() { return this; }

	static fromJSON({ url, code, }) {
		return new ContentStyle(url, code);
	}
}

const toAdd = new Set, toRemove = new Set, styles = new Set;

async function refresh() {
	const frames = (await (pending = getFrames()));
	if (!(toAdd.size || toRemove.size)) { return; }

	frames.forEach(({ tabId, frameId, url, }) => {
		void url;
		toAdd.forEach(code => Tabs.insertCSS(tabId, { code, frameId, runAt: 'document_start', cssOrigin: 'user', }).catch(error => {
			debug >= 2 && console.error('Bad frame', tabId, frameId, url, error);
		}));
		toRemove.forEach(code => Tabs.removeCSS(tabId, { code, frameId, cssOrigin: 'user', }).catch(error => {
			debug >= 2 && console.error('Bad frame', tabId, frameId, url, error);
		}));
	});
	toAdd.clear(); toRemove.clear();
}

let pending = null; async function getFrames() {
	if (pending) { return pending; } const frames = [ ];
	(await Promise.all((await Tabs.query({ })).map(async ({ id: tabId, }) => { try {
		const inTab = (await WebNavigation.getAllFrames({ tabId, }));
		if (!inTab.length || !isScripable(inTab[0].url)) { return; }
		inTab.forEach(({ frameId, url, parentFrameId, }) =>
			isScripable(url) && frames.push({ tabId, frameId, parentFrameId, url, })
		);
	} catch (error) { console.error(error); } })));
	global.setTimeout(() => { pending = null; });
	return frames;
}

// TODO: only listen while styles.size > 0
function onNavigation({ tabId, frameId, url, }) {
	isScripable(url) && styles.forEach(({ code, }) =>
		Tabs.insertCSS(tabId, { frameId, code, runAt: 'document_start', cssOrigin: 'user', })
	);
}

function isScripable(url) {
	return !( // not accessible if:
		   (gecko && url.startsWith('https://addons.mozilla.org'))
		|| (blink && url === 'data:text/html,chromewebdata') // TODO: the `.url` of tabs/frames actually never holds this. This is what is internally set for the neterror (?) page in chrome
		|| !(/^(?:https?|file|ftp|app):\/\//).test(url)
	);
}

return ContentStyle;

}); })(this);
