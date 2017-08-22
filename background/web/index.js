(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { WebNavigation, Tabs, },
	'node_modules/web-ext-utils/browser/version': { blink, gecko, },
}) => {

class ContentStyle {
	constructor(url, code) {
		styles.add(this);
		this.url = url;
		this.code = code.toString({ minify: false, important: false, namespace: true, })
		+ `/* ${ Math.random().toString(32).slice(2) } */`; // avoid conflicts
		toAdd.add(this.code); refresh();
	}

	destroy() {
		if (!styles.has(this)) { return; }
		styles.delete(this);
		toRemove.add(this.code); refresh();
		this.code = null;
	}

	toJSON() { return this; }

	static fromJSON({ url, code, }) {
		return new ContentStyle(url, code);
	}
}

const toAdd = new Set, toRemove = new Set, styles = new Set;

async function refresh() {
	const frames = [ ];
	(await Promise.all((await Tabs.query({ })).map(async ({ id: tabId, }) => {
		const inTab = (await WebNavigation.getAllFrames({ tabId, }));
		if (!inTab.length || !isScripable(inTab[0].url)) { return; }
		inTab.forEach(({ frameId, url, parentFrameId, }) => isScripable(url) && frames.push({ tabId, frameId, parentFrameId, url, }));
	})).catch(() => null));
	// console.log('got frames', frames);

	frames.forEach(({ tabId, frameId, url, }) => {
		void url;
		toAdd.forEach(code => Tabs.insertCSS(tabId, { code, frameId, runAt: 'document_start', })/*.catch(error => {
			console.error('Bad frame', tabId, frameId, url, _, error);
		})*/);
		toRemove.forEach(code => Tabs.removeCSS(tabId, { code, frameId, }));
	});
	toAdd.clear(); toRemove.clear();
}

// TODO: only listen while styles.size > 0
WebNavigation.onCommitted.addListener(({ tabId, frameId, url, }) => {
	isScripable(url) && styles.forEach(({ code, }) => Tabs.insertCSS(tabId, { frameId, code, runAt: 'document_start', }));
});

function isScripable(url) {
	return !( // not accessible if:
		   (gecko && url.startsWith('https://addons.mozilla.org'))
		|| (blink && url === 'data:text/html,chromewebdata') // TODO: the `.url` of tabs/frames actually never holds this. This is what is internally set for the neterror (?) page in chrome
		|| !(/^(?:https?|file|ftp|app):\/\//).test(url)
	);
}

return ContentStyle;

}); })(this);
