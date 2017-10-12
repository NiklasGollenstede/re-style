(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { browserAction, Tabs, Windows, manifest, rootUrl, },
	'node_modules/web-ext-utils/browser/version': { fennec, },
	'node_modules/web-ext-utils/loader/': Content, // TODO: remove line
	'node_modules/web-ext-utils/loader/views': { getUrl, openView, },
	'node_modules/web-ext-utils/update/': updated,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/native-ext/': Native,
	'common/options': options,
	'views/': _, // put views in tabview
	'./chrome/': ChromeStyle,
	'./local/': LocalStyle,
	'./remote/': RemoteStyle,
	'./web/': ContentStyle,
	Parser,
	Style,
	module,
	require,
}) => {
let debug; options.debug.whenChange(([ value, ]) => { debug = value; Content.debug = debug >= 2; });
debug && console.info('Ran updates', updated);


// browser_action (can not be set in manifest due to fennec incompatibility)
browserAction.setIcon({ path: manifest.icons[1], });
browserAction.setPopup({ popup: getUrl({ name: 'panel', }).slice(rootUrl.length - 1).replace('#', '?w=350&h=250#'), });
fennec && browserAction.onClicked.addListener(() => openView('panel'));


// badge text
browserAction.setBadgeBackgroundColor({ color: [ 0x00, 0x7f, 0x00, 0x60, ], });
Tabs.onActivated.addListener(({ tabId, }) => setBage(tabId));
Tabs.onUpdated.addListener((tabId, change, { active, }) => active && ('url' in change) && setBage(tabId, change.url));
Style.onChanged(debounce(() => setBage(), 50));
for (const { id: windowId, } of (await Windows.getAll())) {
	Tabs.query({ windowId, active: true, }).then(([ { id, url, }, ]) => setBage(id, url));
}
async function setBage(tabId, url) {
	tabId == null && (tabId = (await Tabs.query({ currentWindow: true, active: true, }))[0].id);
	url = url || (await Tabs.get(tabId)).url;
	let matching = 0; for (const [ , style, ] of Style) { !style.disabled && style.matches(url) && ++matching; }
	(await browserAction.setBadgeText({ tabId, text: matching ? matching +'' : '', }));
}


Native.onUncaughtException(error => { reportError('Unhandled error in native code', error); /*Native.nuke();*/ });
Native.onUnhandledRejection(error => { reportError('Unhandled rejection in native code', error); /*Native.nuke();*/ });


// debug stuff
Object.assign(global, module.exports = {
	Browser: require('node_modules/web-ext-utils/browser/'),
	options,
	Parser,
	background: global,
	ContentStyle,
	ChromeStyle,
	LocalStyle,
	RemoteStyle,
});

}); })(this);
