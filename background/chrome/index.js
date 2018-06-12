(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, rootUrl, },
	'node_modules/web-ext-utils/loader/views': { openView, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'node_modules/web-ext-utils/utils/event': { setEvent, },
	'node_modules/native-ext/': Native,
	'node_modules/regexpx/': RegExpX,
	'common/options': options,
	'../util': { debounceIdle, },
	require,
}) => {

/**
 * Represents (the parts of) a style sheet that need to be written to
 * `userChrome.css` and `userContent.css`.
 */
class ChromeStyle {

	constructor(path, chrome, content) {
		styles.add(this);
		this.path = path;
		// the sheets are loaded with origin 'user', which means their priority is below 'author' sheets unless they are !important, seee: https://developer.mozilla.org/en-US/docs/Web/CSS/Cascade#Cascading_order
		// that means they are pretty useless unless they are !important ==> add that to all rules
		this.chrome  = (chrome  || '').toString({ minify: false, important: true, namespace: false, }).trim().replace(/\r\n?/g, '\n');
		this.content = (content || '').toString({ minify: false, important: true, namespace: false, }).trim().replace(/\r\n?/g, '\n');
		this.sheets = { chrome, content, };
		applyStyles();
	}

	static get changed() { return changed; }

	destroy() {
		if (!styles.has(this)) { return; }
		styles.delete(this);
		this.code = null;
		applyStyles();
	}

	toJSON() { return { path: this.path, chrome: this.chrome, content: this.content, }; }

	static fromJSON({ path, chrome, content, }) {
		// applyStyles(); // this is only used to load styles after a restart. This style should not have changed since it was last written.
		return new ChromeStyle(path, chrome, content);
	}

	static extractFiles(data) {
		const files = { }; extract(data).split(infix).slice(0, -1).forEach(css => {
			let path; css = css.trim().replace(/^\/\* (.*) \*\/\n/, (_, s) => ((path = s), ''));
			if (!path) { console.error('Failed to extract file name from code chunk', css); }
			else { files[path] = css; }
		}); return files;
	}

} const styles = new Set; let changed = false;

/**
 * Static Event that fires whenever the chrome/ style files were actually written.
 * Provides a dingle argument `changed`, that indicates whether a style file is now different than it was at extension startup.
 */
const fireWritten = setEvent(ChromeStyle, 'onWritten', { lazy: false, async: true, });

//// start implementation

// This is unique for each (firefox) extension installation and makes sure that prefix, infix and suffix are unpredictable for the style authors
// and thus won't occur in the file on accident (or intentionally) where they don't belong.
const uuid = rootUrl.slice('moz-extension://'.length, -1);
const prefix = `\n/* Do not edit this section of this file (outside the Browser Toolbox). It is managed by the ${manifest.name} extension. */ /*START:${uuid}*/\n`;
// This terminator sequence closes open strings, comments, blocks and declarations.
// The media query seems to "reset" the parser (and doesn't do anything itself).
// At the same time it serves as split point when the changes to the files are applied to the local edit files.
const infix  = `\n/*"*//*'*/;};};};};};}@media not all {} /* reset sequence, do not edit this line */ /*NEXT:${uuid}*/\n`;
const suffix = `\n/*END:${uuid}*/\n`;
// extracts reStyles section from the files. This allows other content to coexist with reStyles managed code
const rExtract = RegExpX`
	(?:^|\n) .* \/\*START:${uuid}\*\/ .*\n ([^]*) \n.*\/\*END:${uuid}\*\/ (?:\n|$)
`, rExtractSource = rExtract.source.replace(/\\n/g, String.raw`(?:\r\n?|\n)`);
function extract(file) { return (rExtract.exec(file) || [ '', '', ])[1]; }


// `applyStyles` actually writes the styles, but not to frequently and only if `options.chrome` enabled
let active = options.chrome.value; options.chrome.onChange(([ value, ]) => { active = value; applyStyles(!value); });
const applyStyles = debounceIdle(async (clear) => {
	if (!(active || clear)) { return; } // this shouldn't be possible
	if (clear && !current) { return; } // witched off but didn't work before

	Native.getApplicationName({ stale: true, }).then(name => !name
		&& notify.error('Set up NativeExt',
			`Applying chrome styles requires NativeExt, but it is not installed or not set up correctly.`,
		).then(_=>_ && openView('setup'))
	);

	Native.do(writeStyles); // deduplicates calls (until started)
}, 1e3);

let current = null; async function writeStyles(process) { try {
	let clear; if (!active) { if (current) { clear = true; } { return; } }

	const sorted = clear ? null : Array.from(styles).sort((a, b) => a.path < b.path ? -1 : 1);

	// TODO: this throws all @namespace declarations into a single file. Is that even supposed to work? Do later (default) declarations overwrite earlier ones?
	// TODO: do @import rules work? Should they?

	const files = { chrome: '', content: '', }, data = { chrome: '', content: '', };
	clear || Object.keys(files).forEach(type => (files[type] =
		prefix + (data[type] = sorted.filter(_=>_[type]).map(
			style => `/* ${style.path} */\n${style[type]}${infix}`
		).join('\n')) + suffix
	));

	const native = (await process.require(require.resolve('./native')));
	if (!current) { current = (await native.read()); {
		Object.keys(current).forEach(key => {
			current[key] = extract(current[key].replace(/\r\n?/g, '\n'));
		});
	} }
	(await native.write(files, rExtractSource));

	changed = Object.entries((await current)).some(([ key, current, ]) => data[key] !== current);
	fireWritten([ changed, ]);

} catch (error) { notify.error(`Failed to write chrome styles`, error); } }


return ChromeStyle;

}); })(this);
