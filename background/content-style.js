(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { WebNavigation, Tabs, },
	'node_modules/web-ext-utils/browser/version': { blink, gecko, },
}) => {

class ContentStyle {
	constructor({ include, code, }) {
		new _ContentStyle(this, include, code, null);
	}

	matches(url) {
		const self = Self.get(this);
		return self.includes.some(exp => exp.test(url));
	}

	destroy() {
		Self.get(this).destroy();
	}

	toJSON() {
		const self = Self.get(this);
		return { type: 'ContentStyle', code: self.code, include: self.include.map(_=>_.source), };
	}

	static fromJSON({ code, include, }) {
		const _this = Object.create(ContentStyle.prototype);
		new _ContentStyle(_this, include.map(_=>RegExp(_)), null, code);
		return _this;
	}
}

class _ContentStyle {
	constructor(self, include, code, processed) {
		Self.set(this.public = self, this);
		this.include = Object.freeze(include);
		this.code = processed || '@-moz-document '+ include.map(exp => `regexp(${ JSON.stringify(exp.source) })`) + '{'+ code +`} /* ${ Math.random() } */`;

		getFrames().then(_=>_.forEach(({ tabId, frameId, url, }) => Tabs.insertCSS(tabId, { code: this.code, frameId, runAt: 'document_start', }).catch(error => {
			void (url, error); // console.error('WTF', tabId, frameId, url, _, error);
		})));

		Object.freeze(self);
	}

	destroy() {
		Self.delete(this.public);
		getFrames().then(_=>_.forEach(({ tabId, frameId, }) => Tabs.removeCSS(tabId, { code: this.code, frameId, })));
	}
}

const Self = new Map;

const getFrames = (runing => () => runing || (runing = (async () => {
	const result = [ ];
	(await Promise.all((await Tabs.query({ })).map(async ({ id: tabId, }) => {
		const frames = (await WebNavigation.getAllFrames({ tabId, }));
		if (!frames.length || !isScripable(frames[0].url)) { return; }
		frames.forEach(({ frameId, url, parentFrameId, }) => isScripable(url) && result.push({ tabId, frameId, parentFrameId, url, }));
	})).catch(() => null));
	// console.log('getFrames', result);
	return result;
})().then(res => ((runing = null), res))))();

WebNavigation.onCommitted.addListener(({ tabId, frameId, url, }) => {
	isScripable(url) && Self.forEach(({ code, }) => Tabs.insertCSS(tabId, { frameId, code, runAt: 'document_start', }));
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
