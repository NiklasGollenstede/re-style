(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/options/editor/': Editor,
	'node_modules/web-ext-utils/utils/': { reportError, reportSuccess, },
	'node_modules/es6lib/dom': { createElement, },
	'background/remote/': Remote,
	'background/remote/map-url': mapUrl,
	'common/options': options,
	'fetch!node_modules/web-ext-utils/options/editor/index.css': css,
}) => ({ document, prompt, }) => {

document.title = 'Options - '+ manifest.name;
document.head.appendChild(createElement('style', [ css, ]));

new Editor({
	options, prefix: '', onCommand,
	host: Object.assign(document.body.appendChild(global.document.createElement('form')), { id: 'options', }),
});

async function onCommand({ name, /*parent,*/ }, /*buttonId*/) { try { switch (name) {
	case 'export': {
		throw new Error(`Not implemented`);
		// (await writeToClipboard({ 'application/json': json, 'text/plain': json, }));
		// reportSuccess('Copied', 'The URl list has been put into your clipboard');
	} // break;
	case 'import': {
		const string = prompt('Please paste your JSON data below', '');
		if (!string) { return; }
		const urls = string.trim().split(/\s+/g);
		const failed = [ ];

		(await Promise.all((await Promise.all(urls.map(_=>mapUrl(_)))).map(url => Remote.add(url).catch(error => {
			failed.push(url); console.error('Import error', error);
		}))));

		const added = urls.length - failed.length;
		added > 0 && reportSuccess('Import done', `Imported ${ added } styles`);
		failed.length && (failed.length < 4
			? reportError(`Failed to import:`, ...failed)
			: reportError(`Failed to import:`, failed[0], failed[1], `and ${ failed.length - 2 } more styles`)
		);
	} break;
	case 'updateNow': {
		const { updated, failed, } = (await Remote.updateAll());
		updated.length > 0 && reportSuccess('Update done', `Updated ${ updated.length } styles`);
		failed.length && (failed.length < 4
			? reportError(`Failed to update:`, ...failed.map(_=>_.url))
			: reportError(`Failed to update:`, failed[0].url, failed[1].url, `and ${ failed.length - 2 } more styles`)
		);
	} break;
	default: {
		throw new Error('Unhandled command "'+ name +'"');
	}
} } catch (error) { reportError(error); } }

}); })(this);
