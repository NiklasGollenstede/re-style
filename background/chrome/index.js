(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/loader/native': connect,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'node_modules/es6lib/functional': { debounce, },
	'fetch!./native.js': script,
	'common/options': options,
	'../lib/css': CSS,
	require,
}) => {
let active = options.chrome.value; options.chrome.onChange(([ value, ]) => (active = value) && writeStyles());

const styles = new Set; let native = null;

class ChromeStyle {
	constructor(path, css) {
		styles.add(this);
		this.path = path;
		// the sheets are loaded with origin 'user', which means their priority is below 'author' sheets unless they are !important, seee: https://developer.mozilla.org/en-US/docs/Web/CSS/Cascade#Cascading_order
		// that means they are pretty useless unless they are !important ==> add that to all rules
		this.css = mutate(css, {
			init: ast => (this.ast = ast),
			rule: node => {
				node.declarations.forEach(decl => decl.type === 'declaration'
					&& (decl.value = decl.value.replace(/\s*!important$|$/, ' !important'))
				);
				/*node.selectors = node.selectors.map(selector => {
					const [ , element, pseudo, ] = selector.match(/^\s*(.*?)((?:::.*)?)\s*$/);
					return element +':not(#x)'+ pseudo;
				});*/
			},
			source: path,
		});
		writeStyles();
		console.log('add ChromeStyle', this);
	}

	destroy() {
		if (this.css == null) { return; }
		styles.delete(this);
		this.css = null;
		writeStyles();
		console.log('remove ChromeStyle', this);
	}
}

const writeStyles = debounce(async () => {
	if (!active) { return; }
	native = native || (await connect({ script, sourceURL: require.toUrl('./native.js'), }));
	// TODO: this throws all @namespace declarations into a single file. Is that even supposed to work? Do later (default) declarations overwrite earlier ones?
	// TODO: do @import rules work? Should they?
	const css = Array.from(styles).sort((a, b) => a.path < b.path ? -1 : 1)
	.map(({ path, css, }) => `/* ${ path } */\n${ css }`)
	.join(`\n/*"*//*'*/;};};};};};}@media not all {}\n`);
	// this terminator sequence closes open strings, comments, blocks and declarations
	// the media query seems to "reset" the parser (and doesn't do anything itself)
	native.request('writeUserChromeCss', null, css).catch(reportError);
	destroy();
}, 5e3);

function mutate(css, { init, rule, finish, source, }) {
	let ast = CSS.parse(css, {
		source, silent: false, // ...
	}).stylesheet;
	const arg = init && init(ast);
	rule && (function walk(node) {
		node.type === 'rule' && rule(node, arg);
		node.rules && node.rules.forEach(walk);
	})(ast);
	finish && (ast = finish(ast));
	return CSS.stringify({ stylesheet: ast, }, {
		indent: '\t',
		compress: false, // ...
		sourcemap: false, inputSourcemaps: false,
	});
}

const destroy = debounce(() => {
	native && native.destroy();
	native = null;
}, 60e3);

return ChromeStyle;

}); })(this);
