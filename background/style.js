(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/options/': Options,
	'node_modules/regexpx/': RegExpX,
	'./chrome/': ChromeStyle,
	'./web/': WebStyle,
	'./parser': Sheet,
}) => {

const rXulNs = RegExpX`^(?: # should also remove single backslashes before testing against this
	  url\("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"\)
	| url\('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'\)
	| url\( http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul \)
	|      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
	|      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
)$`;

const chromeUrlPrefixes = [
	'chrome://', // only this (?)
];

const contentUrlPrefixes = [
	'about:',
	'blob:', 'data:', // pretty sure data: doesn't work in a WebStyle, and even if blob:https?:// does, others shouldn't
	'view-source:',
	'resource://',
	'moz-extension://',
	'https://addons.mozilla.org/',
];

const toRegExp = {
	urls(raws) { return RegExpX`^${ raws }$`; },
	urlPrefixes(raws) { return RegExpX`^${ raws }.*$`; },
	domains(raws) { return RegExpX`^https?://(?:[^/]*.)?${ raws }(?:$|/.*$)`; },
	regexps(raws) { return RegExpX`^${ raws.map(_=>RegExp(_)) }$`; },
};

const Self = new WeakMap;

class Style {
	constructor(url, code) {
		return new _Style(this, url, code);
	}

	async setSheet(code) { return Self.get(this).setSheet(code); }

	get url() { return Self.get(this).url; }
	get id() { return Self.get(this).id; }
	// get code() { return Self.get(this).code; }
	// get hash() { return Self.get(this).hash; }
	// get name() { return Self.get(this).name; }
	// get include() { return Self.get(this).include; }
	// get chrome() { return Self.get(this).chrome; }
	// get web() { return Self.get(this).web; }

	get disabled() { return Self.get(this).disabled; }
	set disabled(value) {
		const self = Self.get(this);
		self.disabled ? self.enable() : self.disable();
	}

	/* async */ get options() {
		const self = Self.get(this);
		if (self.options) { return self.options; }
		return (self._options = new Options({ model: self.getOptionsModel(), prefix: self.id, }));
	}

	toJSON() {
		const self = Self.get(this);
		return { type: 'Style',
			url: self.url, id: self.id, code: self.code, hash: self.hash, name: self.name,
			include: self.include.map(_=>_.source), disabled: self.disabled,
			chrome: self.chrome, web: self.web,
			_sheet: self._sheet,
		};
	}

	static fromJSON({ url, id, code, hash, name, include, disabled, chrome, web, }) {
		const _this = Object.create(Style.prototype);
		const self = Object.create(_Style.prototype);
		Self.set(self.public = _this, self);
		self.url = url; self.id = id; self.code = code; self.hash = hash; self.name = name;
		self.include = include.map(_=>RegExp(_)); self.disabled = disabled;
		self.chrome = chrome ? ChromeStyle.fromJSON(chrome) : null;
		self.web = web ? WebStyle.fromJSON(web) : null;
		return _this;
	}

	static async url2id(string) { return sha1(string); }

	destroy() { Self.get(this).destroy(); }
}

class _Style {
	constructor(self, url, code) { return (async () => {
		Self.set(this.public = self, this);
		this.url = this.id = this.code = this.hash = this.name = '';
		this.options = null; this.include = [ ];
		this.chrome = this.web = null;
		this.disabled = false;

		this.name = url.split(/[\/\\]/g).pop();
		this.url = url; this.id = (await Style.url2id(url));

		code && (await this.setSheet(code));
		return self;
	})(); }

	getOptionsModel() {
		const name = [ 0, ];
		Object.defineProperty(name, '0', { get: () => this.name, enumerable: true, });
		return {
			id: {
				description: this.url,
				default: this.id,
				restrict: { readOnly: true, },
			},
			name: {
				default: name,
				restrict: { type: 'string', },
				input: { type: 'string', default: name, },
			},
			controls: { default: true, input: [
				{ type: 'control', id: 'enable',   label: 'Enable', },
				{ type: 'control', id: 'disable',  label: 'Disable', },
				{ type: 'control', id: 'update',   label: 'Update', },
				{ type: 'control', id: 'remove',   label: 'Remove', },
			], },
		};
	}

	async setSheet(code) {
		if (!this.id) { return null; }
		if (!code) {
			this.styles.splice(0, Infinity).forEach(_=>_.destroy());
			const changed = !!this.code;
			this.code = this.hash = '';
			return changed;
		}
		const hash = (await sha1(code));
		if (hash === this.hash) { return false; }
		this.code = code; this.hash = hash;
		!this.disabled && this.enable();
		return true;
	}

	// this function is called (only) when a style is being installed or re-enabled
	enable() {
		this.disabled = false;

		const sheet = this._sheet = typeof this.code === 'string' ? Sheet.fromCode(this.code) : Sheet.fromUserstylesOrg(this.code);
		const { sections, namespace, meta, } = sheet;

		const isXul = rXulNs.test(namespace.replace(/\\(?!\\)/g, ''));
		const userChrome = [ ], userContent = [ ], webContent = [ ], include = [ ];
		sections.forEach(section => {
			const { urls, urlPrefixes, domains, regexps, } = section;
			[ 'urls', 'urlPrefixes', 'domains', 'regexps', ].forEach(type => section[type].length && include.push(toRegExp[type](section[type])));

			if (urls.length + urlPrefixes.length + domains.length + regexps.length === 0) {
				if (section.isEmpty()) { return; } // TODO: this removes "global" comments
				if (isXul) { userChrome.push(section); userContent.push(section); }
				else { webContent.push(section); } return;
			}

			const chrome = section.cloneWithoutIncludes(), content = section.cloneWithoutIncludes(), web = section.cloneWithoutIncludes();

			domains.forEach(domain => domain === 'addons.mozilla.org' ? content.domains.push(domain) : web.domains.push(domain));

			urls.forEach(url => {
				let isWeb = true;
				if (chromeUrlPrefixes .some(prefix => url.startsWith(prefix))) { chrome .urls.push(url); isWeb = false; }
				if (contentUrlPrefixes.some(prefix => url.startsWith(prefix))) { content.urls.push(url); isWeb = false; }
				isWeb && web.urls.push(url);
			});

			urlPrefixes.forEach(url => {
				let isWeb = true;
				if (chromeUrlPrefixes .some(prefix => url.startsWith(prefix) || prefix.startsWith(url))) { chrome .urlPrefixes.push(url); isWeb = false; }
				if (contentUrlPrefixes.some(prefix => url.startsWith(prefix) || prefix.startsWith(url))) { content.urlPrefixes.push(url); isWeb = false; }
				isWeb && web.urls.push(url);
			});

			// this is not going to be accurate (and therefore not exclusive)
			regexps.forEach(source => {
				(/chrome\\?:\\\/\\\//).test(source) && chrome.regexps.push(source);
				(/(?:resource|moz-extension)\\?:\\\/\\\/|(?:about|blob|data|view-source)\\?:|addons.*mozilla(?:\[\.\]|\\?\\.)org/)
				.test(source) && content.regexps.push(source);
				web.regexps.push(source); // could pretty much always (also) match a web page
			});

			chrome.urls.length  + chrome.urlPrefixes.length  + chrome.domains.length  + chrome.regexps.length  > 0 && userChrome.push(chrome);
			content.urls.length + content.urlPrefixes.length + content.domains.length + content.regexps.length > 0 && userContent.push(content);
			web.urls.length     + web.urlPrefixes.length     + web.domains.length     + web.regexps.length     > 0 && webContent.push(web);
		});

		if (userChrome.length || userContent.length) {
			const chrome = new ChromeStyle(this.url,
				userChrome.length  ? sheet.cloneWithSections(userChrome)  : null,
				userContent.length ? sheet.cloneWithSections(userContent) : null,
			);
			this.chrome && this.chrome.destroy(); this.chrome = chrome;
		}
		if (webContent.length) {
			const web = new WebStyle(this.url, sheet.cloneWithSections(webContent));
			this.web && this.web.destroy(); this.web = web;
		}

		this.include.splice(0, Infinity, ...include);

		if (meta.name && meta.name !== this.name) {
			this.name = meta.name;
			if (this.options && !this.options.children.name.values.isSet) {
				// TODO: this doesn't work
				this.options.children.name.value = ''; this.options.children.name.reset();
			}
		}
	}

	disable() {
		this.disabled = true;
		this.include.splice(0, Infinity);
		this.chrome && this.chrome.destroy(); this.chrome = null;
		this.web && this.web.destroy(); this.web = null;
	}

	destroy() {
		if (!this.id) { return; }
		this.disable();
		this.options && this.options.destroy(); this.options = null;
		this.url = this.id = this.hash = '';
	}
}

async function sha1(string) {
	typeof string !== 'string' && (string = JSON.stringify(string)); // for the styles loaded from https://userstyles.org/styles/chrome/\d+.json
	const hash = (await global.crypto.subtle.digest('SHA-1', new global.TextEncoder('utf-8').encode(string)));
	return Array.from(new Uint8Array(hash)).map((b => b.toString(16).padStart(2, '0'))).join('');
}

return Style;

}); })(this);
