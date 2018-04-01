(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/options/editor/': Editor,
	'node_modules/web-ext-utils/utils/': { reportError, reportSuccess, },
	'node_modules/es6lib/dom': { createElement, },
	'background/local/': LocalStyle,
	'background/remote/': RemoteStyle,
	'background/style': Style,
	'common/options': options,
	'fetch!./styles.css:css': css,
	'fetch!node_modules/web-ext-utils/options/editor/index.css:css': editorCss,
}) => async window => { const { document, } = window;

const Sections = {
	remote: {
		Type: RemoteStyle,
		title: 'Remote',
		empty: `To add styles from the Internet (e.g. from <a href="https://www.userstyles.org" target="_blank">userstyles.org</a> or GitHub),
		navgate to the styles site, click the ${manifest.name} icon in the Browser UI and click <code>Add Style</code>.<br>
		You can also just paste an URL of a style in the textbox above that button or use the <code>Import</code> button on the options page.`,
	},
	local: {
		Type: LocalStyle,
		title: 'Local',
		empty: `To start adding local styles, follow the <a href="#setup">setup</a> and enable <a href="#options#.local">Development Mode</a>.`,
		after: `To disable local styles permanently, add their names to the <a href="#options#.local.exclude">exclude list</a>.`,
	},
};

document.head.appendChild(createElement('style', [ editorCss, ]));
document.head.appendChild(createElement('style', [ css, ]));

for (const [ name, { Type, title, before, empty, after, }, ] of Object.entries(Sections)) {
	let list; document.body.appendChild(createElement('div', {
		className: 'section', id: name,
	}, [
		createElement('h1', [ title, ]),
		createElement('p', { className: 'before', innerHTML: before || '', }),
		list = createElement('div', { className: 'list', }),
		createElement('p', { className: 'if-empty', innerHTML: empty || '', }),
		createElement('p', { className: 'after', innerHTML: after || '', }),
	]));

	const entries = Array.from(Type, _=>_[1]).sort((a, b) => a.url < b.url ? -1 : 1);

	entries.forEach(style => list.appendChild(createRow(style)));
}

Style.onChanged(id => {
	const style = Style.get(id), element = document.getElementById(id);
	if (!style) { return void (element && element.remove()); }
	// console.log('onChanged', id, style, element);
	if (!element) {
		const list = document.querySelector('#'+ (style instanceof RemoteStyle ? 'remote' : 'local') +'>div');
		list.insertBefore(createRow(style), Array.from(list.children).find(row => row.dataset.url > style.url));
	} else {
		element.classList[style.disabled ? 'add' : 'remove']('disabled');
		// replace the .include and .options branches
		[ 'include', 'options', ].forEach(name => {
			const host = element.querySelector(`.pref-name-${name} .pref-children`)
			|| element.querySelector(`.pref-name-${name} .toggle-target`).appendChild(createElement('fieldset', { className: 'pref-children', }));
			Array.from(host.childNodes).forEach(_=>_.remove());
			if (style.options[name].children.length) {
				new Editor({ options: style.options[name].children, host, });
				element.querySelector(`.pref-name-${name}`).classList.remove('empty');
			} else {
				element.querySelector(`.pref-name-${name}`).classList.add('empty');
			}
		});
	}
}, { owner: window, });

function createRow(style) {
	const element = new Editor({
		options: style.options, onCommand: onCommand.bind(null, style),
		host: createElement('div', { id: style.id, className: style.disabled ? 'disabled' : '', dataset: { url: style.url, }, }),
	}); element._style = style;
	!style.options.include.children.length && element.querySelector('.pref-name-include').classList.add('empty');
	!style.options.options.children.length && element.querySelector('.pref-name-options').classList.add('empty');
	return element;
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
	case 'copy': {
		const name = style.options.name.value.toLowerCase().replace(/[ .]/g, '-').replace(/[^\w-]/g, '') +'.css';
		const path = (await LocalStyle.createStyle(name, style.code));
		style.disabled = true;
		reportSuccess(`Created local Style at`, path);
		LocalStyle.openStyle(name).catch(e => console.error(e));
	} break;
} } catch (error) { reportError(error); } }

}); })(this);
