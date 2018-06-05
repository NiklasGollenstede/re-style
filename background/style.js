(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/browser/storage': { sync: storage, },
	'node_modules/web-ext-utils/options/': Options,
	'node_modules/web-ext-utils/utils/event': { setEvent, setEventGetter, },
	'node_modules/regexpx/': RegExpX,
	'common/options': options,
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
	 * Sets the code content of the style sheet. The code will be parsed (see `Sheet`)
	 * and its `Section`s are applied as a `Web`- and/or `ChromeStyle`.
	 * @param  {string}  code  CSS source code. Should contain `@document` sections.
	 *                         Setting the Sheet to `''` will effectively disable the `Style`.
	 * @return {boolean}       Whether the Sheet was actually changed, which also fires `onCahnged`.
	 */
	async setSheet(code) { return Self.get(this).setSheet(code || ''); }

	/**
	 * Forcefully re-applies the current Sheet,
	 * e.g. to replace old cached `.chrome` and `.web` properties.
	 */
	reload() { const self = Self.get(this); !self.disabled && self.update(); }

	/// The `url` constructor parameter.
	get url() { return Self.get(this).url; }
	/// A fixed-length ID hashed from `.url`.
	get id() { return Self.get(this).id; }
	/// String-representation of the current `.sheet`, before any processing.
	get code() { return Self.get(this).code; }
	/// `Sheet` as a result of `.setSheet()`.
	get sheet() { console.warn('deprecated'); return Self.get(this)._sheet; }
	/// `ChromeStyle` if `.sheet` has sections that require one.
	get chrome() { return Self.get(this).chrome; }
	/// `WebStyle` if `.sheet` has sections that require one.
	get web() { return Self.get(this).web; }
	/// Parsed metadata as frozen JSON object
	get meta() { return Self.get(this).meta; }

	/// Gets/sets the disabled state. Disabled Styles don't have .`chrome` and `.web`
	/// and thus won't affect the browser UI or websites.
	get disabled() { return Self.get(this).disabled; }
	set disabled(value) { value ? Self.get(this).disable() : Self.get(this).enable(); }

	/// Style specific options (TODO: document)
	get options() { return Self.get(this).options.children; }

	/// Returns `true` iff any of the `.sheet`s sections would match `url`. Ignores global code.
	matches(url) { return Self.get(this).include.some(_=>_.test(url)); }

	/// Returns a JSON object that can be stored and later passed to `this.constructor.fromJSON`.
	toJSON() { return Self.get(this).toJSON(); }

	/// Efficiently restores a Style from its JSON representation. Should be called on a deriving classes constructor.
	static fromJSON() { return _Style.fromJSON.apply(this, arguments); }

	/// Retrieves a `Style` instance by its `.id`.
	static get(id) { return styles.get(id); }
	/// Iterator over all `Style` instances as [ id, style, ].
	static [Symbol.iterator]() { return styles[Symbol.iterator](); }

	/// Hashes a url to a `.id`.
	static async url2id(string) { return sha1(string); }

	/// Permanently removes the style but keeps its user-set options unless final is `true`.
	/// Accessing any methods or getters on `destroy`ed styles will throw.
	destroy(final) { Self.get(this).destroy(final); }
} const Self = new WeakMap, styles = new Map;

/**
 * Static Event fired with (id) whenever a Style is
 * added, enabled, disabled, destroyed or its `.sheet` changed.
 */
const fireChanged = setEvent(Style, 'onChanged', { lazy: false, async: true, });
/**
 * Instance Event that fires with (this, id) whenever the Style is
 * added, enabled, disabled, destroyed or its `.sheet` changed.
 */
setEventGetter(Style, 'changed', Self, { async: true, });

//// start implementation

const sXulNs = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const rXulNs = RegExpX`^(?: # should also remove single backslashes before testing against this
	  url\( \s* (?<q1> ["']? ) ${sXulNs} \k<q1> \s* \)
	|       \s* (?<q2> ["']  ) ${sXulNs} \k<q2> \s*
)$`;

const chromeUrlPrefixes = [
	'chrome://', // only this (?)
];

const contentDomains = options.internal.children.restrictedDomains.value.split(',');
const contentUrlPrefixes = [
	'about:',
	'blob:', 'data:', // pretty sure data: doesn't work in a WebStyle, and even if blob:https?:// does, others shouldn't
	'view-source:',
	'resource://',
	'moz-extension://',
	...contentDomains.map(_=>`https://${_}/`),
], rContentDomains = RegExpX`^ ${contentDomains} $`;

const RegExpXu = RegExpX({ unicode: true, noCapture: true, });
const toRegExp = {
	urls(raws) { return RegExpXu`^ ${raws} $`; },
	urlPrefixes(raws) { return RegExpXu`^ ${raws} .*$`; },
	domains(raws) { return RegExpXu`^ https?:// ( [^/]+\. )? ${raws} ( $ | /.*$ )`; },
	regexps(raws) { const exps = raws.map(_=>RegExp(_)); return RegExpXu`^ ${exps} $`; },
};

const parent = new WeakMap;

class _Style {
	constructor(self, url, code) { return (async () => { try {
		Self.set(this.public = self, this);
		self._ = this; // only for debugging

		// persisted properties
		this.url = this.id = this.code = this.name = ''; this.meta = null;
		this.options = null; this.include = [ ];
		this.disabled = false; this.chrome = this.web = null;

		// cached stuff that does not need to be restored from JSON
		this._sheet = this._chrome = this._content = this._web = null;
		this.fireChanged = null; // set by setEventGetter

		const name = this.name = url.split(/[/\\]/g).pop().replace(/(^|-)(.)/g, (_, s, c) => (s ? ' ' : '') + c.toUpperCase()).replace(/[.](?:css|json)$/, '');
		this.meta = Object.freeze({ name, }); this.url = url;
		const id = this.id = (await Style.url2id(url));
		if (styles.has(id)) { throw new Error(`Duplicate Style id`); } styles.set(id, self);

		this.initOptions(); code && (await this.setSheet(code)); return self;
	} catch (error) {
		try { this.destroy(); } catch (_) { } throw error;
	} })(); }

	toJSON() { return {
		url: this.url, id: this.id, code: this.code, name: this.name, meta: this.meta,
		/* options, */ include: this.include.map(_=>_.source), disabled: this.disabled,
		chrome: this.chrome && this.chrome.toJSON(), web: this.web && this.web.toJSON(),
	}; }

	static fromJSON({ url, id, code, name, meta, include, disabled, chrome, web, }) { return (function(self) { try {
		Self.set(this.public = self, this);
		self._ = this; // only for debugging
		if (styles.has(id)) { throw new Error(`Duplicate Style id`); } styles.set(id, self);

		this.url = url; this.id = id; this.code = code; this.name = name; this.meta = deepFreeze(meta);
		this.options = null; this.include = include.map(_=>RegExp(_)); this.disabled = disabled;
		this.chrome = chrome ? ChromeStyle.fromJSON(chrome) : null;
		this.web = web ? WebStyle.fromJSON(web) : null;

		this._sheet = this._chrome = this._content = this._web = null;

		this.initOptions(); this.rebuildOptions(); fireChanged([ this.id, ]); return self;
	} catch (error) {
		try { this.destroy(); } catch (_) { } throw error;
	} }).call(Object.create(_Style.prototype), Object.create(this.prototype)); }

	async setSheet(code) {
		if (!code) { { // effectively disables the style
			if (!this.code) { return false; }
			this.code = ''; this.include.splice(0, Infinity);
			if (this.disabled) { return true; }
			this.disabled = false; this.disable(true); this.disabled = false;
			this._fireChanged();
		} return true; }

		if (code === this.code) { return false; }
		this.code = code; this._sheet = null;

		this.update(); return true;
	}

	/// applies the `._sheet?` to the UI and browser
	update() {
		if (this.disabled) { this.parseIncludes(); this._fireChanged(); return; }
		const sheet = this._sheet = this._sheet || Sheet.fromCode(this.code);
		this.updateName(); this.meta = deepFreeze(sheet.meta);
		this.parseIncludes(); this.parseSections();
		const { dynamicIncludes, dynamicOptions, } = this.rebuildOptions();
		dynamicIncludes.length && this.applyIncludes();
		dynamicOptions.length && this.applyOptions();
		this.applyStyle();
	}

	/// gets `.name` from `._sheet.meta` or a `._sheet.sections` include rule
	updateName() {
		const { _sheet: { meta, sections, }, } = this;
		if (!meta.name) { meta.name = (/^\d*$/).test(this.name) && sections.length >= 1 ? (
			(sections[1].domains || sections[1].urlPrefixes || sections[1].urls)[0] || this.name
		) : this.name; }

		if (meta.name !== this.name) {
			this.name = meta.name;
			if (!this.options.children.name.values.isSet) { // update UI
				this.options.children.name.value = ''; this.options.children.name.reset();
			}
		}
	}

	/// refreshes `.includes` from `._sheet?`
	parseIncludes() {
		const { sections, } = this._sheet = this._sheet || Sheet.fromCode(this.code);
		const include = [ ]; sections.forEach(section =>
			[ 'urls', 'urlPrefixes', 'domains', 'regexps', ].forEach(type => { try {
				section[type].length && include.push(toRegExp[type](section[type].map(_=>_.value)));
			} catch(error) { console.error(`Failed to parse ${type} pattern(s) in ${this.url}`, error); } })
		);
		this.include.splice(0, Infinity, ...include);
	}

	/// refreshes `._chrome`, `._content` and `._web` from `._sheet?`
	parseSections() {
		const { sections, namespace, } = this._sheet = this._sheet || Sheet.fromCode(this.code);
		const userChrome = this._chrome = [ ]; const userContent = this._content = [ ]; const webContent = this._web = [ ];
		sections.forEach(section => {
			const { urls, urlPrefixes, domains, regexps, } = section;

			if (urls.length + urlPrefixes.length + domains.length + regexps.length === 0) {
				if (section.isEmpty()) { return; } // TODO: this removes "global" comments
				if (rXulNs.test(namespace.replace(/\\(?!\\)/g, ''))) { userChrome.push(section); userContent.push(section); }
				else { webContent.push(section); } return;
			}

			const chrome_ = section.cloneWithoutIncludes(), content = section.cloneWithoutIncludes(), web = section.cloneWithoutIncludes();
			const targets = { chrome: chrome_, content, web, };

			domains.forEach(({ value, as, }) => targets[as || (
				rContentDomains.test(value) ? 'content' : 'web'
			)].domains.push({ value, as, }));

			urls.forEach(({ value, as, }) => targets[as || (
				  chromeUrlPrefixes .some(prefix => value.startsWith(prefix)) ? 'chrome'
				: contentUrlPrefixes.some(prefix => value.startsWith(prefix)) ? 'content' : 'web'
			)].urls.push({ value, as, }));

			urlPrefixes.forEach(({ value, as, }) => targets[as || (
				  chromeUrlPrefixes .some(prefix => value.startsWith(prefix) || prefix.startsWith(value)) ? 'chrome'
				: contentUrlPrefixes.some(prefix => value.startsWith(prefix) || prefix.startsWith(value)) ? 'content' : 'web'
			)].urlPrefixes.push({ value, as, }));

			// this is not going to be accurate (and therefore not exclusive)
			regexps.forEach(({ value, as, }) => {
				if ((/^\w+$/).test(value)) { return; } // dynamic include or has no effect
				if (as) { targets[as].regexps.push({ value, as, }); }
				(/chrome\\?:\\?\/\\?\//).test(value) && chrome_.regexps.push({ value, as, });
				(/(?:resource|moz-extension)\)?\\?:\\?\/\\?\/|(?:about|blob|data|view-source)\)?\\?:/)
				.test(value) && content.regexps.push({ value, as, });
				web.regexps.push({ value, as, }); // could pretty much always (also) match a web page
			});

			chrome_.urls.length + chrome_.urlPrefixes.length + chrome_.domains.length + chrome_.regexps.length > 0 && userChrome.push(chrome_);
			content.urls.length + content.urlPrefixes.length + content.domains.length + content.regexps.length > 0 && userContent.push(content);
			web.urls.length     + web.urlPrefixes.length     + web.domains.length     + web.regexps.length     > 0 && webContent.push(web);
		});
	}

	/// (re-)builds `.options.children[includes|options].children` settings branches from `this.meta`
	rebuildOptions() {
		const { meta, } = this;
		const styleOptions = (branch, model, onChange) => {
			const dynamic = this.options.children[branch].children;
			const rules = meta[branch]; if (dynamic.rules === rules) { return dynamic; } dynamic.rules = rules;
			dynamic.splice(0, Infinity, ...(rules || [ ]).map(rule => {
				const root = new Options({ model: [ {
					name: rule.name, title: rule.title,
					description: rule.description,
					default: rule.default,
					...model(rule, rules),
				}, ], prefix: 'style.'+ this.id +'.'+ branch, storage, });
				const option = root.children[0]; parent.set(option, root);
				option.onChange(() => {
					this.disabled = false;
					!this._sheet && this.parseSections(); // restored from JSON
					this[onChange](); this.applyStyle();
				});
				return root.children[0];
			}))
			.forEach(old => parent.get(old).destroy());
			return dynamic;
		};

		const dynamicIncludes = styleOptions('include', () => ({
			maxLength: Infinity,
			restrict: { match: { exp: (/^\S*$/), message: `Domains must not contain whitespaces`, }, unique: '.', },
			input: { type: 'string', default: 'example.com', },
		}), 'applyIncludes');
		const dynamicOptions = styleOptions('options',
			({ name: _1, title: _2, description: _3, unit = '', restrict, ...input }) => ({ unit, restrict, input, }),
			'applyOptions'
		);
		return { dynamicIncludes, dynamicOptions, };
	}

	/// applies the `.options.children.include.children` settings branch to `._sheet.sections` and `._web`
	applyIncludes() {
		const { _sheet: { sections, }, _web: webContent, _content: userContent, } = this;
		const dynamicIncludes = this.options.children.include.children;
		sections.forEach(section => Object.entries({
			web: webContent, content: userContent,
		}).forEach(([ type, targets, ]) => {
			const target = targets.find(_=>_.tokens === section.tokens) || section.cloneWithoutIncludes();
			const hadDynamic = target.dynamic.splice(0, Infinity).length;
			section.regexps.forEach(({ value: source, as, }) => {
				if (as && as !== type) { return; }
				const custom = dynamicIncludes.find(_=>_.name === source); if (!custom) { return; }
				const domains = custom.values.current.filter(domain =>
					as || rContentDomains.test(domain) === (type === 'content')
				); if (!domains.length) { return; }
				target.dynamic.push({ value: toRegExp.domains(domains).source, as, });
				!targets.includes(target) && targets.push(target);
			});
			hadDynamic // if it is not the section
			&& !target.dynamic.length // and all includes were removed
			&& !(target.urls.length + target.urlPrefixes.length + target.domains.length + target.regexps.length)
			&& targets.splice(targets.indexOf(target), 1);
		}));
	}

	/// applies the `.options.children.options.children` settings branch to `._sheet.sections`
	applyOptions() {
		const { _sheet: { sections, }, } = this;
		const dynamicOptions = this.options.children.options.children;
		const prefs = { }; dynamicOptions.forEach(
			({ name, value, model: { unit, }, }) => (prefs[name] = value + unit)
		);
		sections.forEach(_=>_.setOptions(prefs));
	}

	/// applies `._sheet`, `._chrome`, `._content` and `._web` to the UI and browser
	applyStyle() {
		const { _sheet: sheet, _chrome: userChrome, _content: userContent, _web: webContent, } = this;
		const chrome = !userChrome.length && !userContent.length ? null
		: new ChromeStyle(this.url,
			userChrome.length  ? sheet.cloneWithSections(userChrome)  : null,
			userContent.length ? sheet.cloneWithSections(userContent) : null,
		); this.chrome && this.chrome.destroy(); this.chrome = chrome;

		const web = !webContent.length ? null
		: new WebStyle(this.url, sheet.cloneWithSections(webContent));
		this.web && this.web.destroy(); this.web = web;

		this._fireChanged();
	}

	enable() {
		if (this.disabled === false) { return; } this.disabled = false;
		this.update();
	}
	disable(supress) {
		if (this.disabled === true) { return; } this.disabled = true;
		this.chrome && this.chrome.destroy(); this.chrome = null;
		this.web && this.web.destroy(); this.web = null;
		if (!supress) { this._fireChanged(); }
	}

	destroy(final) {
		if (!this.id) { return; }
		try { this.disable(true); } catch (error) { console.error(error); }
		final && this.options && this.options.resetAll();
		this.options && this.options.destroy(); this.options = null;
		Self.delete(this.public);
		this.fireChanged && this.fireChanged([ this.public, this.id, ], { last: true, }); fireChanged([ this.id, ]);
		styles.delete(this.id); this.url = this.id = '';
	}

	_fireChanged() {
		this.fireChanged && this.fireChanged([ this.public, this.id, ]); fireChanged([ this.id, ]);
	}

	initOptions() {
		const name = [ 0, ]; Object.defineProperty(name, '0', { get: () => this.name, enumerable: true, });
		const code = [ 0, ]; Object.defineProperty(code, '0', { get: () => this.code, enumerable: true, });
		const model = {
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
				{ type: 'control', id: 'update',   label: 'Update', },
				{ type: 'control', id: 'edit',     label: 'Edit', },
				{ type: 'control', id: 'info',     label: 'Info', },
				{ type: 'control', id: 'enable',   label: 'Enable', },
				{ type: 'control', id: 'disable',  label: 'Disable', },
				{ type: 'control', id: 'remove',   label: 'Remove', },
				{ type: 'hidden', suffix: `<span title="Only disables until the next restart, see below.">🛈</span>`, },
			], },
			edit: {
				title: 'Edit',
				description: `Please note that changes made here are not permanent and will be overwritten on the next update of this style.
				To customize a style permanently, `,
				expanded: false, default: true,
				input: [ { type: 'control', id: 'copy', label: 'create a local copy', suffix: ` of it.`, }, ],
				children: {
					code: { default: code, input: { type: 'code', lang: 'css', }, },
					apply: { default: true, input: [
						{ type: 'control', id: 'apply', label: 'Apply', },
						{ type: 'control', id: 'unedit', label: 'Reset', },
					], },
				},
			},
			include: {
				title: 'Add to',
				description: `This style or parts of it can be applied to user-defined pages.<br>
				You can edit these includes for this style here or add the current pages doain from the pop-up panel.<br>
				<i>All text you see in the box below is supplied by the style author, not by the ${manifest.short_name} extension.</i>`,
				expanded: false, default: true,
				children: 'dynamic',
			},
			options: {
				title: 'Settings',
				description: `This style has some custom style settings.<br>
				<i>All text you see in the box below is supplied by the style author, not by the ${manifest.short_name} extension.</i>`,
				expanded: false, default: true,
				children: 'dynamic',
			},
		};
		this.options = new Options({ model, prefix: 'style.'+ this.id, storage, });
	}
}

async function sha1(string) {
	typeof string !== 'string' && (string = JSON.stringify(string)); // for the styles loaded from https://userstyles.org/styles/chrome/\d+.json
	const hash = (await global.crypto.subtle.digest('SHA-1', new global.TextEncoder('utf-8').encode(string)));
	return Array.from(new Uint8Array(hash)).map((b => b.toString(16).padStart(2, '0'))).join('');
}

function deepFreeze(json) { if (typeof json === 'object' && json !== null) {
		Object.freeze(json); Object.values(json).forEach(deepFreeze);
} return json; }

return Style;

}); })(this);
