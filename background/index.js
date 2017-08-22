(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { browserAction, manifest, rootUrl, },
	'node_modules/web-ext-utils/browser/version': { fennec, },
	'node_modules/web-ext-utils/loader/': Content, // TODO: remove line
	'node_modules/web-ext-utils/loader/views': { getUrl, openView, },
	'node_modules/web-ext-utils/update/': updated,
	'common/options': options,
	'views/': _, // put views in tabview
	'./chrome/': ChromeStyle,
	'./local/': Local,
	'./remote/': Remote,
	'./web/': ContentStyle,
	Parser,
	module,
	require,
}) => {
let debug; options.debug.whenChange(([ value, ]) => { debug = value; Content.debug = debug >= 2; });
debug && console.info('Ran updates', updated);


// browser_action (can not be set in manifest due to fennec incompatibility)
browserAction.setIcon({ path: manifest.icons, });
browserAction.setPopup({ popup: getUrl({ name: 'panel', }).slice(rootUrl.length - 1), });
fennec && browserAction.onClicked.addListener(() => openView('panel'));


// debug stuff
Object.assign(global, module.exports = {
	Browser: require('node_modules/web-ext-utils/browser/'),
	options,
	Parser,
	background: global,
	ContentStyle,
	ChromeStyle,
	Local,
	Remote,
});

}); })(this);
