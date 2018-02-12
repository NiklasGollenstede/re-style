(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/browser/storage': { sync: storage, },
	'node_modules/web-ext-utils/options/': Options,
	'node_modules/web-ext-utils/utils/event': { setEvent, setEventGetter, },
	'node_modules/regexpx/': RegExpX,
	'./chrome/': ChromeStyle,
	'./web/': WebStyle,
	'./parser': Sheet,
}) => {

/**
 * Base Style class, extended by `LocalStyle` and `RemoteStyle`.
 */
class Style {
	/**
	 * Asynchronous base constructor.
	 * @param  {string}   url   Unique url/path of the style.
	 * @param  {string?}  code  Optional code to `.setSheet()`.
	 * @return {Style}          Promise to the new Style instance.
	 */
	constructor(url, code) { return new _Style(this, url, code); }

	/**
	 * Sets the code content of the style sheet. The code will be parsed (see `Sheet`) and
	 * its `Section`s are applied as a `WebStyle` and/or `ChromeStyle`.
	 * @param {string|object?}  code  CSS source code. Should contain `@document` sections.
	 *                                Can also be set as a JSON object returned by userstyles.org.
	 *                                Setting the Sheet to `null` will remove it from the browser.
	 * @return {boolean}              Whether the Sheet actually re-applied, which also fires `onCahnged`.
	 */
	async setSheet(code) { return Self.get(this).setSheet(code); }

	/**
	 * Forcefully re-applies the current Sheet,
	 * e.g. to replace old cached .`chrome` and `.web` properties.
	 */
	reload() { const self = Self.get(this); !self.disabled && self.enable(); }

	/// The `url` constructor parameter.
	get url() { return Self.get(this).url; }
	/// A fixed-length ID hashed from `.url`.
	get id() { return Self.get(this).id; }
	/// String-representation of the current `.sheet`.
	get code() { return Self.get(this).code; }
	/// `Sheet` as a result of `.setSheet()`.
	get sheet() { return Self.get(this).sheet; }
	/// `ChromeStyle` if `.sheet` has sections that require one.
	get chrome() { return Self.get(this).chrome; }
	/// `WebStyle` if `.sheet` has sections that require one.
	get web() { return Self.get(this).web; }

	/// Gets/sets the disabled state. Disabled Styles don't have .`chrome` and `.web`
	/// and thus won't affect the browser UI or websites.
	get disabled() { return Self.get(this).disabled; }
	set disabled(value) {
		const self = Self.get(this);
		if (!!value === self.disabled) { return; }
		self.disabled ? self.enable() : self.disable();
	}

	/// Style specific options (TODO: document)
	get options() { return Self.get(this).options.children; }

	/// Returns `true` iff any of the `.sheet`s sections would match `url`.
	matches(url) { return Self.get(this).include.some(_=>_.test(url)); }

	/// Returns a JSON object stat can be stored and later passed to `this.constructor.fromJSON`.
	toJSON() { return Self.get(this).toJSON(); }

	/// Efficiently restores a Style from its JSON representation. Should be called on a deriving class.
	static fromJSON() { return _Style.fromJSON.apply(this, arguments); }

	/// Retrieves a `Style` instance by its `.id`.
	static get(id) { return styles.get(id); }
	/// Iterator over all `Style` instances as [ id, style, ].
	static [Symbol.iterator]() { return styles[Symbol.iterator](); }

	/// Hashes a url to a `.id`.
	static async url2id(string) { return sha1(string); }

	/// Permanently removes the style but keeps its user-set options.
	/// Accessing any methods or getters on `destroy`ed styles will throw.
	destroy() { Self.get(this).destroy(); }
} const Self = new WeakMap, styles = new Map;

/**
 * Static Event fired with (id) whenever a style is
 * added, enabled, disabled, destroyed or its `.sheet` changed.
 */
const fireChanged = setEvent(Style, 'onChanged', { lazy: false, async: true, });
/**
 * Instance Event that fires with (this) whenever the Style is
 * added, enabled, disabled, destroyed or its `.sheet` changed.
 */
setEventGetter(Style, 'changed', Self, { async: true, });

//// start implementation

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

const RegExpXu = RegExpX('u');
const toRegExp = {
	urls(raws) { return RegExpXu`^${ raws }$`; },
	urlPrefixes(raws) { return RegExpXu`^${ raws }.*$`; },
	domains(raws) { return RegExpXu`^https?://(?:[^/]+\.)?${ raws }(?:$|/.*$)`; },
	regexps(raws) { return RegExpXu`^${ raws.map(_=>RegExp(_)) }$`; },
};

const parent = new WeakMap;

class _Style {
	constructor(self, url, code) { return (async () => {
		Self.set(this.public = self, this);
		this.url = this.id = this.code = this.hash = this.name = '';
		this.options = null; this.include = [ ];
		this.sheet = this.chrome = this.web = null;
		this.disabled = false;

		this.name = url.split(/[\/\\]/g).pop().replace(/(^|-)(.)/g, (_, s, c) => (s ? ' ' : '') + c.toUpperCase()).replace(/[.](?:css|json)$/, '');
		this.url = url; this.id = (await Style.url2id(url)); styles.set(this.id, self);
		this.options = new Options({ model: this.getOptionsModel(), prefix: 'style.'+ this.id, storage, });

		code && (await this.setSheet(code));
		return self;
	})(); }

	getOptionsModel() {
		const name = [ 0, ]; Object.defineProperty(name, '0', { get: () => this.name, enumerable: true, });
		const code = [ 0, ]; Object.defineProperty(code, '0', { get: () => this.code, enumerable: true, });
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
			query: {
				default: '',
				restrict: { type: 'string', },
				hidden: true,
			},
			controls: { default: true, input: [
				{ type: 'control', id: 'enable',   label: 'Enable', },
				{ type: 'control', id: 'disable',  label: 'Disable', },
				{ type: 'control', id: 'update',   label: 'Update', },
				{ type: 'control', id: 'remove',   label: 'Remove', },
			], },
			edit: {
				title: 'Edit',
				description: `Please note that changes made here are not permanent and will be overwritten on the next update of this style.
				To customize a style permanently, create a local copy of it.`,
				expanded: false, default: true,
				children: {
					code: { default: code, input: { type: 'code', lang: 'css', }, },
					apply: { default: true, input: [ { type: 'control', id: 'apply', label: 'Apply', }, { type: 'control', id: 'unedit', label: 'Reset', }, ], },
				},
			},
			include: {
				title: 'Add to',
				description: `This style or parts of it can be applied to user-defined pages.<br>
				You can edit these includes for this style here or add the current pages doain from the pop-up panel.<br>
				All text you see in the box below is supplied by the style, not by ${manifest.name}.`,
				expanded: false, default: true,
				children: 'dynamic',
			},
		};
	}

	async setSheet(code) {
		if (!code) {
			if (!this.code) { return false; }
			this.chrome && this.chrome.destroy(); this.chrome = null;
			this.web && this.web.destroy(); this.web = null;
			this.code = this.hash = ''; this.include.splice(0, Infinity);
			this.fireChanged && this.fireChanged([ this.public, ]); fireChanged([ this.id, ]);
			return true;
		}
		if (typeof code === 'string') {
			this.code = code;
			const hash = (await sha1(this.code)); if (hash === this.hash) { return false; } this.hash = hash;
			this.sheet = Sheet.fromCode(code); // lazy
		} else {
			const sheet = Sheet.fromUserstylesOrg(code); // must do this first
			this.code = this.sheet.toString();
			const hash = (await sha1(this.code)); if (hash === this.hash) { return false; } this.hash = hash;
			this.sheet = sheet;
		}

		const include = [ ]; this.sheet.sections.forEach(section =>
			[ 'urls', 'urlPrefixes', 'domains', 'regexps', ].forEach(type => { try {
				section[type].length && include.push(toRegExp[type](section[type]));
			} catch(error) { console.error(`Failed to parse ${type} pattern(s) in ${this.url}`, error); } })
		);
		this.include.splice(0, Infinity, ...include);

		if (this.disabled) {
			this.fireChanged && this.fireChanged([ this.public, ]); fireChanged([ this.id, ]);
		} else {
			this.enable(); // also fires changed
		}
		return true;
	}

	// this function is called (only) when a style is being installed, updated or re-enabled
	enable() {
		this.disabled = false;

		const sheet = this.sheet = this.sheet || (typeof this.code === 'string' ? Sheet.fromCode(this.code) : Sheet.fromUserstylesOrg(this.code));
		const { sections, namespace, meta, } = sheet;

		// dynamic includes
		const dynamic = this.options.children.include.children;
		dynamic.splice(0, Infinity, ...(meta.include || [ ]).map(rule => {
			const root = new Options({ model: [ {
				name: rule.name, title: rule.title,
				description: rule.description,
				default: rule.default,
				maxLength: Infinity,
				restrict: { match: { exp: (/^\S*$/), message: `Domains must not contain whitespaces`, }, unique: '.', },
				input: { type: 'string', default: 'example.com', },
			}, ], prefix: 'style.'+ this.id +'.include', storage, });
			const option = root.children[0]; parent.set(option, root);
			option.onChange(() => !this.disabled && this.enable());
			return root.children[0];
		}))
		.forEach(old => parent.get(old).destroy());


		const isXul = rXulNs.test(namespace.replace(/\\(?!\\)/g, ''));
		const userChrome = [ ], userContent = [ ], webContent = [ ];
		sections.forEach(section => {
			const { urls, urlPrefixes, domains, regexps, } = section;

			if (urls.length + urlPrefixes.length + domains.length + regexps.length === 0) {
				if (section.isEmpty()) { return; } // TODO: this removes "global" comments
				if (isXul) { userChrome.push(section); userContent.push(section); }
				else { webContent.push(section); } return;
			}

			const chrome_ = section.cloneWithoutIncludes(), content = section.cloneWithoutIncludes(), web = section.cloneWithoutIncludes();

			domains.forEach(domain => domain === 'addons.mozilla.org' ? content.domains.push(domain) : web.domains.push(domain));

			urls.forEach(url => {
				let isWeb = true;
				if (chromeUrlPrefixes .some(prefix => url.startsWith(prefix))) { chrome_.urls.push(url); isWeb = false; }
				if (contentUrlPrefixes.some(prefix => url.startsWith(prefix))) { content.urls.push(url); isWeb = false; }
				isWeb && web.urls.push(url);
			});

			urlPrefixes.forEach(url => {
				let isWeb = true;
				if (chromeUrlPrefixes .some(prefix => url.startsWith(prefix) || prefix.startsWith(url))) { chrome_.urlPrefixes.push(url); isWeb = false; }
				if (contentUrlPrefixes.some(prefix => url.startsWith(prefix) || prefix.startsWith(url))) { content.urlPrefixes.push(url); isWeb = false; }
				isWeb && web.urlPrefixes.push(url);
			});

			// this is not going to be accurate (and therefore not exclusive)
			regexps.forEach(source => {
				const custom = dynamic.find(_=>_.name === source);
				if (custom) { return void web.domains.push(...custom.values.current); }
				(/chrome\\?:\\?\/\\?\//).test(source) && chrome_.regexps.push(source);
				(/(?:resource|moz-extension)\\?:\\?\/\\?\/|(?:about|blob|data|view-source)\\?:|addons.*mozilla(?:\[\.\]|\\?\\.)org/)
				.test(source) && content.regexps.push(source);
				web.regexps.push(source); // could pretty much always (also) match a web page
			});

			chrome_.urls.length + chrome_.urlPrefixes.length + chrome_.domains.length + chrome_.regexps.length > 0 && userChrome.push(chrome_);
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

		if (meta.name && meta.name !== this.name) {
			this.name = meta.name;
			if (this.options.children.name.values.isSet) { return; }
			this.options.children.name.value = ''; this.options.children.name.reset();
		}

		this.fireChanged && this.fireChanged([ this.public, ]); fireChanged([ this.id, ]);
	}

	disable(supress) {
		if (this.disabled === true) { return; } this.disabled = true;
		this.chrome && this.chrome.destroy(); this.chrome = null;
		this.web && this.web.destroy(); this.web = null;
		if (!supress) { this.fireChanged && this.fireChanged([ this.public, ]); fireChanged([ this.id, ]); }
	}

	destroy(final) {
		if (!this.id) { return; }
		this.disable(true);
		final && this.options && this.options.resetAll();
		this.options && this.options.destroy(); this.options = null;
		Self.delete(this.public);
		this.fireChanged && this.fireChanged([ this.public, ], { last: true, }); fireChanged([ this.id, ]);
		styles.delete(this.id); this.url = this.id = this.hash = '';
	}


	toJSON() {
		const json = {
			url: this.url, id: this.id, code: this.code, hash: this.hash, name: this.name,
			include: this.include.map(_=>_.source), disabled: this.disabled,
			chrome: this.chrome, web: this.web,
		}; Object.defineProperty(json, 'sheet', { value: this.sheet, });
		return json;
	}

	static fromJSON({
		url, id, code, hash, name, include, disabled, chrome, web,
	}) { const { prototype, } = this; return (function() {
		const self = Object.create(prototype);
		Self.set(this.public = self, this);
		this.url = url; this.id = id; styles.set(this.id, self);
		this.code = code; this.hash = hash; this.name = name;
		this.include = include.map(_=>RegExp(_)); this.disabled = disabled;
		this.chrome = chrome ? ChromeStyle.fromJSON(chrome) : null;
		this.web = web ? WebStyle.fromJSON(web) : null;
		this.options = new Options({ model: this.getOptionsModel(), prefix: 'style.'+ this.id, storage, });
		fireChanged([ this.id, ]);
		return self;
	}).call(Object.create(_Style.prototype)); }
}

async function sha1(string) {
	typeof string !== 'string' && (string = JSON.stringify(string)); // for the styles loaded from https://userstyles.org/styles/chrome/\d+.json
	const hash = (await global.crypto.subtle.digest('SHA-1', new global.TextEncoder('utf-8').encode(string)));
	return Array.from(new Uint8Array(hash)).map((b => b.toString(16).padStart(2, '0'))).join('');
}

return Style;

}); })(this);
