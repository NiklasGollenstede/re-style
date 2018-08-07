(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/loader/views': { openView, },
	'node_modules/web-ext-utils/options/editor/': Editor,
	'node_modules/web-ext-utils/utils/notify': notify,
	'node_modules/es6lib/dom': { createElement, },
	'background/local/': LocalStyle,
	'background/remote/': RemoteStyle,
	'background/style': Style,
	'background/util': { sanatize, },
	'fetch!./styles.css:css': css,
	'fetch!node_modules/web-ext-utils/options/editor/index.css:css': editorIndexCss,
}) => async window => { const { document, } = window;
const $ = createElement.bind(window); // create elements with correct owner so event listeners are detached on unload

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

document.head.appendChild($('style', [ editorIndexCss, ]));
document.head.appendChild(document.querySelector('style')); // editor/dark.css
document.head.appendChild($('style', [ css, ]));

for (const [ name, { Type, title, before, empty, after, }, ] of Object.entries(Sections)) {
	let list; document.body.appendChild($('div', {
		className: 'section', id: name,
	}, [
		$('h1', [ title, ]),
		$('p', { className: 'before', innerHTML: before || '', }),
		list = $('div', { className: 'list', }),
		$('p', { className: 'if-empty', innerHTML: empty || '', }),
		$('p', { className: 'after', innerHTML: after || '', }),
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
		// replace the .include and .options branches if they changed
		[ 'include', 'options', ].forEach(name => {
			const host = element.querySelector(`.pref-name-${name} .pref-children`)
			|| element.querySelector(`.pref-name-${name} .toggle-target`).appendChild($('fieldset', { className: 'pref-children', }));
			const options = style.options[name].children;
			if (host.firstChild && options.length && host.firstChild.pref === options[0]) { return; }
			Array.from(host.childNodes).forEach(_=>_.remove()); // must slice or iteration breaks
			options.length && new Editor({ options, host, });
			element.querySelector(`.pref-name-${name}`).classList[options.length ? 'remove' : 'add']('empty');
		});
		renderInfo(style.meta, element);
	}
}, { owner: window, });

function createRow(style) {
	const element = new Editor({
		options: style.options, onCommand: onCommand.bind(null, style),
		host: $('div', { id: style.id, className: style.disabled ? 'disabled' : '', dataset: { url: style.url, }, }),
	}); element._style = style;
	style instanceof LocalStyle && (element.querySelector('.pref-name-name').disabled = 'local');
	!style.options.include.children.length && element.querySelector('.pref-name-include').classList.add('empty');
	!style.options.options.children.length && element.querySelector('.pref-name-options').classList.add('empty');
	renderInfo(style.meta, element);
	return element;
}

function renderInfo(meta, element) {
	const enable = element.querySelector('.pref-name-info'); enable.style.display = '';
	const host = enable.querySelector('span[href="info"]'); host.textContent = '';
	if (!meta.version && !meta.author && !meta.description/* && !...*/) { enable.style.display = 'none'; return; }
	host.appendChild($('fieldset', { classList: 'style-info pref-children', }, [
		meta.description && $('span', { classList: 'description', innerHTML: (
			sanatize('<b>Description</b>: '+ meta.description)
		), }),
		meta.author && $('p', { classList: 'author', }, [
			$('b', [ 'Author', ]), ': ', meta.author.name,
			...(meta.author.email ? [ ' ', $('a', { href: 'mailto:'+ meta.author.email, }, [ '✉', ]), ] : [ ]),
			...(meta.author.url ? [ ' ', $('a', { href: meta.author.url, target: '_blank', }, [ '🏠', ]), ] : [ ]), // 🏠 ⌂
		]),
		meta.license && $('p', { classList: 'license', }, [
			$('b', [ 'License', ]), ': ', meta.license,
		]),
		meta.version && $('p', { classList: 'version', }, [
			$('b', [ 'Version', ]), ': ', meta.version,
		]),
		meta.homepageURL && $('a', { classList: 'homepageURL', href: meta.homepageURL, target: '_blank', }, 'Style Homepage'),
		meta.homepageURL && ' ',
		meta.supportURL  && $('a', { classList: 'supportURL', href: meta.supportURL,  target: '_blank', }, 'Support Page'),
	]));
}

async function onCommand(style, _, action) { try { switch (action) {
	case 'edit':     (await style.show()); break;
	case 'enable':   style.disabled = false; break;
	case 'disable':  style.disabled = true; break;
	case 'update':   (await style.update()); break;
	case 'remove':   window.confirm(`Remove Style ${style.options.name.value}?`) && (await style.remove()); break;
	case 'apply': {
		(await style.setSheet(style.options.edit.children.code.value));
		style.options.edit.children.code.reset();
	} break;
	case 'unedit':   style.options.edit.children.code.reset(); break;
	case 'copy': {
		const name = style.options.name.value.toLowerCase().replace(/[ .]/g, '-').replace(/[^\w-]/g, '') +'.css';
		const path = (await LocalStyle.createStyle(name, style.code));
		style.disabled = true;
		notify.success(`Created local Style at`, path);
		LocalStyle.openStyle(name).catch(e => console.error(e));
	} break;
	case 'info': (await openView({ name: 'style-info', hash: style.url, }, null, { useExisting: false, })); break;
} } catch (error) { notify.error(error); } }

}); })(this);
