(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/options/': Options,
	'node_modules/regexpx/': RegExpX,
	'./chrome/': ChromeStyle,
	ContentStyle,
	Parser,
}) => {

const childTypes = { ChromeStyle, ContentStyle, };

const rXulNs = RegExpX`^(?: # should also remove all backslashes before testing against this
	  url\("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"\)
	| url\('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'\)
	| url\( http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul \)
	|      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
	|      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
)$`;
const rChromeExp = RegExpX`^\^+ (?: \( (?: \?\: )? )? (?: # must start with at least one ^ optionally followed by ( or (?:
	  about: # any about page // TODO: exclude blank?
	| data: # probably also blob: ?
	| view-source:
	| (?:chrome|resource|moz-extension):\\\/\\\/
	| http s\?? :\\?\/\\?\/ (?: \(\?\:\[\^\\?\/\]\*\.\)\? )? addons\\\.mozilla\\\.org (?: \\?\/ | \(\?\:\$\|\\\/\.\*\$\) ) # domain(addons.mozilla.org) or url(-prefix)?(https://addons.mozilla.org/...)
)`;

const optionsModel = ({ url, id, name, }) => ({
	id: {
		description: url,
		default: id,
		restrict: { readOnly: true, },
	},
	name: {
		default: [ name.replace(/(?:^|-)(.)/g, (_, c) => ' '+ c.toUpperCase()).replace(/^\s*|\.css$/g, ''), ],
		restrict: { type: 'string', },
		input: { type: 'string', default: name, },
	},
	controls: { default: true, input: [
		{ type: 'control', id: 'enable',   label: 'Enable', },
		{ type: 'control', id: 'disable',  label: 'Disable', },
		{ type: 'control', id: 'update',   label: 'Update', },
		{ type: 'control', id: 'remove',   label: 'Remove', },
	], },
});

const Self = new WeakMap;

class Style {
	constructor(url, code) {
		return new _Style(this, url, code);
	}

	async setSheet(code) { return Self.get(this).setSheet(code); }

	get url() { return Self.get(this).url; }
	get id() { return Self.get(this).id; }

	get disabled() { return Self.get(this).disabled; }
	set disabled(value) {
		const self = Self.get(this);
		self.disabled ? self.enable() : self.disable();
	}

	/* async */ get options() {
		const self = Self.get(this);
		if (self.options) { return self.options; }
		return (self._options = new Options({ model: optionsModel({
			id: self.id, url: self.url,
			name: self.url.split(/[\/\\]/g).pop(),
		}), prefix: self.id, }));
	}

	toJSON() {
		const self = Self.get(this);
		return { type: 'Style',
			url: self.url, id: self.id, code: self.code, hash: self.hash,
			styles: self.styles.map(_=>_.toJSON()), disabled: self.disabled,
		};
	}

	static fromJSON({ url, id, code, hash, styles, disabled, }) {
		const _this = Object.create(Style.prototype);
		const self = Object.create(_Style.prototype);
		Self.set(self.public = _this, self);
		self.url = url; self.id = id; self.code = code; self.hash = hash; self.disabled = disabled;
		self.styles = styles.map(style => childTypes[style.type].fromJSON(style));
		return _this;
	}

	static async url2id(string) {
		const hash = (await global.crypto.subtle.digest('SHA-256', new global.TextEncoder('utf-8').encode(string)));
		return Array.from(new Uint8Array(hash)).map((b => b.toString(16).padStart(2, '0'))).join('');
	}

	destroy() { Self.get(this).destroy(); }
}

class _Style {
	constructor(self, url, code) { return (async () => {
		Self.set(this.public = self, this);
		this.url = this.id = this.code = this.hash = '';
		this.options = null; this.styles = [ ];
		this.disabled = false;

		this.url = url; this.id = (await Style.url2id(url));

		code && (await this.setSheet(code));
		return self;
	})(); }

	async setSheet(code) {
		if (!this.id) { return null; }
		if (!code) {
			this.styles.splice(0, Infinity).forEach(_=>_.destroy());
			const changed = !!this.code;
			this.code = this.hash = '';
			return changed;
		}
		const hash = (await Style.url2id(code));
		if (hash === this.hash) { return false; }
		this.code = code; this.hash = hash;
		!this.disabled && this.enable();
		return true;
	}

	enable() {
		this.disabled = false;
		const old = this.styles.splice(0, Infinity);

		const { globalCode, sections, namespace, } = Parser.parseStyle(this.code);
		let chrome; if (rXulNs.test(namespace.replace(/\\/g, ''))) { this.styles.push(chrome = new ChromeStyle(this.url, this.code)); }

		globalCode && sections.push({ code: globalCode, patterns: null, });
		sections.forEach(({ code, patterns, }) => {
			const include = patterns ? patterns.filter(exp => !rChromeExp.test(exp.source)) : [ /^[^]*$/, ];
			if (patterns && patterns.length > include.length) { chrome || this.styles.push(chrome = new ChromeStyle(this.url, this.code)); }
			include.length && this.styles.push(new ContentStyle({ code, include, }));
		});
		old.forEach(_=>_.destroy());
	}

	disable() {
		this.disabled = true;
		this.styles.splice(0, Infinity).forEach(_=>_.destroy());
	}

	destroy() {
		if (!this.id) { return; }
		this.options && this.options.destroy(); this.options = null;
		this.styles.splice(0, Infinity).forEach(_=>_.destroy());
		this.url = this.id = this.hash = '';
	}
}

return Style;

}); })(this);
