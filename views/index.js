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
		icon: getURL('icon.svg'),
	}, {
		id: 'setup',
		title: 'Setup',
		icon: new global.Text('❓'),
	}, {
		id: 'options',
		title: 'Options',
		icon: new global.Text('⚙'),
	}, {
		id: 'about',
		title: 'About',
		icon: new global.Text('🛈'),
	}, {
		id: '404',
		title: 'Error',
		icon: new global.Text('⚡'),
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
