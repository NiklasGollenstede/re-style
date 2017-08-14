(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/options/editor/': Editor,
	'node_modules/es6lib/dom': { createElement, },
	'background/local/': Local,
	'background/remote/': Remote,
}) => ({ document, }) => {

function showSection({ title, entries, }) {
	let list; document.body.appendChild(createElement('div', [
		createElement('h1', [ title, ]),
		list = createElement('div'),
	]));

	entries.forEach(options => new Editor({
		options,
		host: list.appendChild(createElement('form', { id: options.id.value, })),
	}));
}

showSection({ title: 'Remote', entries: Remote.styles, });
showSection({ title: 'Local',  entries: Local.styles, });

}); })(this);
