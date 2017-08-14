(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/options/editor/': Editor,
	'common/options': options,
}) => ({ document, }) => {

document.title = 'Options - '+ manifest.name;

new Editor({
	options, prefix: '',
	host: Object.assign(document.body.appendChild(global.document.createElement('form')), { id: 'options', }),
});

}); })(this);
