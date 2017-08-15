(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/options/': Options,
	'node_modules/regexpx/': RegExpX,
	'./chrome/': ChromeStyle,
	ContentStyle,
	Parser,
}) => {

const rXulNs = RegExpX`^(?: # should also remove all backslashes before testing against this
	  url\("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"\)
	| url\('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'\)
	| url\( http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul \)
	|      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
	|      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
)$`;
const rChromeExp = RegExpX`^\^+ (?: # must all start with at least one ^
	  about: # any about page // TODO: exclude blank?
	| data: # probably also blob: ?
	| (?:chrome|resource):\\\/\\\/
	| http s\?? :\\?\/\\?\/ (?: \(\?\:\[\^\\?\/\]\*\.\)\? )? addons\\\.mozilla\\\.org (?: \\?\/ | \(\?\:\$\|\\\/\.\*\$\) ) # domain(addons.mozilla.org) or url(-prefix)?(https://addons.mozilla.org/...)
)`;

const optionsModel = ({ url, id, name, removeHidden = false, }) => ({
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
	enabled: {
		default: true,
		restrict: { type: 'boolean', },
		input: { type: 'boolean', suffix: `enabled`, },
	},
	refresh: {
		description: ` `, // margin
		default: null,
		input: { type: 'random', label: 'Update', },
	},
	remove: {
		description: ` `, // margin
		default: null,
		input: { type: 'random', label: 'Remove', },
		get hidden() { return removeHidden; }, set hidden(v) { removeHidden = v; },
	},
});

class Style {
	constructor(url, css) { return (async () => {
		this.url = this.id = this.hash = '';
		this.options = null; this.styles = [ ];

		this.url = url; this.id = (await sha256(url));
		this.options = (await new Options({ model: optionsModel({
			id: this.id, url,
			name: url.split(/[\/\\]/g).pop(),
		}), prefix: this.id, }));
		css && (await this.setSheet(css));
		return this;
	})(); }

	async setSheet(css) {
		if (!this.id) { return; }
		if (!css) {
			this.styles.splice(0, Infinity).forEach(_=>_.destroy());
			return void (this.hash = '');
		}
		const hash = (await sha256(css));
		if (hash === this.hash) { return; } this.hash = hash;
		const old = this.styles.splice(0, Infinity);

		const { globalCode, sections, namespace, } = Parser.parseStyle(css);
		let chrome; if (rXulNs.test(namespace.replace(/\\/g, ''))) { this.styles.push(chrome = new ChromeStyle(this.url, css)); }

		globalCode && sections.push({ code: globalCode, patterns: null, });
		sections.forEach(({ code, patterns, }) => {
			const include = patterns ? patterns.filter(exp => !rChromeExp.test(exp.source)) : [ /^[^]*$/, ];
			if (patterns && patterns.length > include.length) { chrome || this.styles.push(chrome = new ChromeStyle(this.url, css)); }
			this.styles.push(new ContentStyle({ code, include, }));
		});
		old.forEach(_=>_.destroy());
	}

	destroy() {
		if (!this.id) { return; }
		this.options && this.options.destroy(); this.options = null;
		this.styles.splice(0, Infinity).forEach(_=>_.destroy());
		this.url = this.id = this.hash = '';
	}
}

return Style;

async function sha256(string) {
	const hash = (await global.crypto.subtle.digest('SHA-256', new global.TextEncoder('utf-8').encode(string)));
	return Array.from(new Uint8Array(hash)).map((b => b.toString(16).padStart(2, '0'))).join('');
}

}); })(this);
