(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/loader/home': Home,
	'node_modules/web-ext-utils/browser/': { extension: { getURL, }, },
	'node_modules/es6lib/dom': { createElement, },
	'fetch!node_modules/web-ext-utils/options/editor/dark.css:css': css,
}) => {

return new Home({
	tabs: [ {
		id: 'styles',
		title: 'Styles',
		icon: createElement('div', { style: {
			backgroundSize: '80%', height: '100%',
			backgroundImage: `url(${ getURL('icon.svg') })`,
		}, }),
	}, {
		id: 'setup',
		title: 'Setup',
		icon: createElement('div', { style: {
			position: 'relative', fontSize: '130%', top: '-6px',
		}, }, [ '❔', ]),
	}, {
		id: 'options',
		title: 'Options',
		icon: createElement('div', { style: {
			position: 'relative', fontSize: '180%', top: '-5px',
		}, }, [ '⚙', ]),
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
	index: 'styles',
	style: [ 'vertical', 'firefox', 'dark', ],
	head: [
		createElement('base', { target: '_top', }),
		createElement('style', [ css, ]),
	],
});

}); })(this);
