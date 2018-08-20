(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/loader/home': Home,
	'node_modules/web-ext-utils/browser/': { Extension, },
	'node_modules/es6lib/dom': { createElement, },
	'common/options': options,
	'fetch!node_modules/web-ext-utils/options/editor/dark.css:css': dark,
	'fetch!node_modules/web-ext-utils/options/editor/light.css:css': light,
}) => {

const themes = { dark, light, }; let theme = options.internal.children.uiTheme.value;
const classList = [ 'vertical', 'firefox', theme, ], styleElement = createElement('style', { id: 'theme-style', }, [ themes[theme], ]);
options.internal.children.uiTheme.onChange(([ value, ]) => { theme = value; {
	const old = classList.pop(); classList.push(theme); styleElement.textContent = themes[theme];
	Extension.getViews().forEach(({ document, }) => {
		document.querySelectorAll('.tabview.'+ old).forEach(tabs => { tabs.classList.remove(old); tabs.classList.add(theme); });
		document.querySelectorAll('#theme-style').forEach(_=>(_.textContent = themes[theme]));
	});
} });

return new Home({
	tabs: [ {
		id: 'styles',
		title: 'Styles',
		icon: createElement('div', { style: {
			backgroundSize: '80%', height: '100%',
			backgroundImage: `url(${ Extension.getURL('icon.svg') })`,
		}, }),
	}, {
		id: 'options',
		title: 'Options',
		icon: createElement('div', { style: {
			position: 'relative', fontSize: '180%', top: '-5px',
		}, }, [ '⚙', ]),
	}, {
		id: 'setup',
		title: 'Setup',
		icon: createElement('div', { style: {
			position: 'relative', fontSize: '130%', top: '-6px',
		}, }, [ '❔', ]),
	}, {
		id: 'about',
		title: 'About',
		icon: createElement('div', { style: {
			position: 'relative', fontSize: '150%', top: '-5px',
		}, }, [ '🛈', ]),
	}, {
		id: '404',
		title: 'Error',
		icon: createElement('div', { style: {
			position: 'relative', fontSize: '100%', top: '-3px',
		}, }, [ '⚡', ]),
		hidden: true, default: true, unload: true,
	}, ],
	index: 'styles', // default tab
	style: classList,
	head: [ createElement('base', { target: '_top', }), styleElement, ],
});

}); })(this);
