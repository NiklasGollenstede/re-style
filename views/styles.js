(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/options/editor/': Editor,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'node_modules/es6lib/dom': { createElement, },
	'background/local/': Local,
	'background/remote/': Remote,
	'background/style': Style,
	'fetch!./styles.css': css,
}) => async window => {
const { document, } = window;
const Types = { Remote, Local, };

document.head.appendChild(createElement('style', [ css, ]));

for (const [ name, Type, ] of Object.entries(Types)) {
	let list; document.body.appendChild(createElement('div', {
		className: 'section', id: name.toLowerCase(),
	}, [
		createElement('h1', [ name, ]),
		list = createElement('div'),
	]));

	const entries = Array.from(Type, _=>_[1]).sort((a, b) => a.url < b.url ? -1 : 1);

	entries.forEach(style => list.appendChild(createRow(style)));
}

Style.onChanged(id => {
	const style = Style.get(id), element = document.getElementById(id);
	if (!style) { return void (element && element.remove()); }
	console.log('onChanged', id, style, element);
	if (!element) {
		const list = document.querySelector('#'+ (style instanceof Remote ? 'remote' : 'local') +'>div');
		list.appendChild(createRow(style)); // TODO: don't append but insert in the correct place
	} else {
		element.classList[style.disabled ? 'add' : 'remove']('disabled');
		// replace the .include branch
		const host = element.querySelector('.pref-name-include .pref-children')
		|| element.querySelector('.pref-name-include .toggle-target').appendChild(createElement('fieldset', { className: 'pref-children', }));
		Array.from(host.childNodes).forEach(_=>_.remove());
		new Editor({ options: style.options.include.children, host, });
	}
}, { owner: window, });

function createRow(style) {
	return new Editor({
		options: style.options, onCommand: onCommand.bind(null, style),
		host: createElement('div', { id: style.id, className: style.disabled ? 'disabled' : '', }),
	});
}

async function onCommand(style, _, action) { try { switch (action) {
	case 'enable':   style.disabled = false; break;
	case 'disable':  style.disabled = true; break;
	case 'update':   (await style.update()); break;
	case 'remove':   (await style.remove()); break;
	case 'apply': {
		(await style.setSheet(style.options.edit.children.code.value));
		style.options.edit.children.code.reset();
	} break;
	case 'unedit':   style.options.edit.children.code.reset(); break;
} } catch (error) { reportError(error); } }

}); })(this);
