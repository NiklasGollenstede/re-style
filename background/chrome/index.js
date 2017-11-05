(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, rootUrl, },
	'node_modules/web-ext-utils/utils/': { reportError, },
	'node_modules/web-ext-utils/utils/event': { setEvent, },
	'node_modules/native-ext/': Native,
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/regexpx/': RegExpX,
	'common/options': options,
	'../util': { debounceIdle, },
	require,
}) => {


class ChromeStyle {

	constructor(path, chrome, content) {
		styles.add(this);
		this.path = path;
		// the sheets are loaded with origin 'user', which means their priority is below 'author' sheets unless they are !important, seee: https://developer.mozilla.org/en-US/docs/Web/CSS/Cascade#Cascading_order
		// that means they are pretty useless unless they are !important ==> add that to all rules
		this.chrome  = (chrome  || '').toString({ minify: false, important: true, namespace: false, }).trim().replace(/\r\n?/g, '\n');
		this.content = (content || '').toString({ minify: false, important: true, namespace: false, }).trim().replace(/\r\n?/g, '\n');
		writeStyles();
	}

	static get changed() { return changed; }

	destroy() {
		if (!styles.has(this)) { return; }
		styles.delete(this);
		this.code = null;
		writeStyles();
	}

	toJSON() { return this; }

	static fromJSON({ path, chrome, content, }) {
		// writeStyles(); // this is only used to load styles after a restart. This style should not have changed since it was last written.
		return new ChromeStyle(path, chrome, content);
	}

	static extractFiles(file) {
		const files = { }; extract(file).split(infix).slice(0, -1).forEach(css => {
			let path; css = css.trim().replace(/^\/\* (.*) \*\/\n/, (_, s) => ((path = s), ''));
			if (!path) { console.error('Failed to extract file name from code chunk', css); return; }
			files[path] = css;
		}); return files;
	}

} const styles = new Set; let changed = false;
const fireWritten = setEvent(ChromeStyle, 'onWritten', { lazy: false, async: true, });

const uuid = rootUrl.slice('moz-extension://'.length, -1);
// This is unique for each (firefox) extension installation and makes sure that prefix, infix and suffix are unpredictable for the style authors
// and thus won't occur in the file on accident (or intentionally) where they don't belong.
const prefix = `\n/* Do not edit this section of this file (outside the Browser Toolbox). It is managed by the ${manifest.name} extension. */ /*START:${uuid}*/\n`;
const infix  = `\n/*"*//*'*/;};};};};};}@media not all {} /* reset sequence, do not edit this line */ /*NEXT:${uuid}*/`;
// This terminator sequence closes open strings, comments, blocks and declarations.
// The media query seems to "reset" the parser (and doesn't do anything itself).
// At the same time it serves as split point when the changes to the files are applied to the local edit files.
const suffix = `\n/*END:${uuid}*/\n`;
const rExtract = RegExpX('n')`
	(^|\n) .* \/\*START:${uuid}\*\/ [^]* \/\*END:${uuid}\*\/ (\n|$)
`, rExtractSource = rExtract.source.replace(/\\n/g, String.raw`(?:\r\n?|\n)`);
function extract(file) {
	return (rExtract.exec(file) || [ '', ])[0].replace(/^\n?.*\n/, '').replace(/\n.*\n?$/, '');
}


let native = null; const load = async () => native || (
	native = (await Native.require(require.resolve('./native')))
), unload = debounce(() => {
	Native.unref(native); native = null;
}, 60e3);


let current; options.chrome.whenChange(([ value, ]) => { value && !current && getCurrent(); });
function getCurrent() { current = (async () => {
	(await load()); const files = (await native.read());
	Object.keys(files).forEach(key => {
		files[key] = extract(files[key].replace(/\r\n?/g, '\n'));
	});
	unload(); return files;
})(); }


let active = options.chrome.value; options.chrome.onChange(([ value, ]) => { active = value; writeStyles(!value); });
const writeStyles = debounceIdle(async (clear) => { try {

	if (!active && !clear) { return; } (await load());
	const sorted = clear ? null : Array.from(styles).sort((a, b) => a.path < b.path ? -1 : 1);

	// TODO: this throws all @namespace declarations into a single file. Is that even supposed to work? Do later (default) declarations overwrite earlier ones?
	// TODO: do @import rules work? Should they?

	const files = { chrome: '', content: '', }, data = { chrome: '', content: '', };
	clear || Object.keys(files).forEach(type => (files[type] =
		prefix + (data[type] = sorted.filter(_=>_[type]).map(
			style => `/* ${style.path} */\n${style[type]}${infix}`
		).join('\n')) + suffix
	));

	(await native.write(files, rExtractSource));

	changed = Object.entries((await current)).some(([ key, current, ]) => data[key] !== current);

	fireWritten([ changed, ]);
} catch (error) {
	reportError(`Failed to write chrome styles`, error);
} finally { unload(); } }, 1e3);


return ChromeStyle;

}); })(this);
