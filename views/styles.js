(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/options/editor/': Editor,
	'node_modules/web-ext-utils/utils/': { reportError, reportSuccess, },
	'node_modules/es6lib/dom': { createElement, },
	'background/local/': Local,
	'background/remote/': Remote,
	'fetch!./styles.css': css,
}) => async ({ document, }) => {

const Types = { Remote, Local, };

document.head.appendChild(createElement('style', [ css, ]));

(await Promise.all(Object.keys(Types).map(async type => {
	let list; document.body.appendChild(createElement('div', {
		className: 'section '+ type.toLowerCase(),
	}, [
		createElement('h1', [ type, ]),
		list = createElement('div'),
	]));

	const entries = (await Types[type].get());

	entries.forEach(({ options, }) => new Editor({
		options, onCommand,
		host: list.appendChild(createElement('div', { id: options.id.value, })),
	}));

	async function onCommand({ /*name,*/ parent, }, buttonId) { try {
		const id = parent.children.id.default;

		(await Types[type][buttonId](id));

		reportSuccess(buttonId[0].toUpperCase() + buttonId.slice(1) +'d style', parent.children.name.value);
	} catch (error) { reportError(error); } }

})));

}); })(this);
