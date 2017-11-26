(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { browserAction, Tabs, Windows, rootUrl, },
	'node_modules/web-ext-utils/browser/version': { fennec, },
	'node_modules/web-ext-utils/loader/': Content, // TODO: remove line
	'node_modules/web-ext-utils/loader/views': { getUrl, openView, },
	'node_modules/web-ext-utils/update/': updated,
	'node_modules/web-ext-utils/utils/': { reportError, reportSuccess, },
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/native-ext/': Native,
	'common/options': options,
	'views/': _, // put views in tabview
	'./chrome/': ChromeStyle,
	'./local/': LocalStyle,
	'./remote/': RemoteStyle,
	'./web/': ContentStyle,
	'./util': { isSubDomain, },
	Parser,
	Style,
	module,
	require,
}) => {
let debug; options.debug.whenChange(([ value, ]) => { debug = value; Content.debug = debug >= 2; });
debug && console.info('Ran updates', updated);


// browser_action (can not be set in manifest due to fennec incompatibility)
browserAction.setIcon({ path: '/icon.svg', });
browserAction.setPopup({ popup: getUrl({ name: 'panel', }).slice(rootUrl.length - 1).replace('#', '?w=350&h=250#'), });
fennec && browserAction.onClicked.addListener(() => openView('panel'));


// badge text
Tabs.onActivated.addListener(({ tabId, }) => setBage(tabId));
Tabs.onUpdated.addListener((tabId, change, { active, }) => active && ('url' in change) && setBage(tabId, change.url));
Style.onChanged(debounce(() => setBage(), 50));
for (const { id: windowId, } of (await Windows.getAll())) {
	Tabs.query({ windowId, active: true, }).then(([ { id, url, }, ]) => setBage(id, url));
}
async function setBage(tabId, url) {
	tabId == null && (tabId = (await Tabs.query({ currentWindow: true, active: true, }))[0].id);
	url = new global.URL(url || (await Tabs.get(tabId)).url);
	let matching = 0, extra = 0; for (const [ , style, ] of Style) {
		if (style.disabled) { continue; }
		style.matches(url.href) && ++matching;
		style.options.include.children.forEach(_=>_.values.current.forEach(domain => isSubDomain(domain, url.hostname) && extra++));
	}
	(await browserAction.setBadgeText({ tabId, text: (matching || '') + (extra ? '+'+ extra : '') || (ChromeStyle.changed ? '!' : ''), }));
}


// badge color
const colors = { normal: [ 0x00, 0x7f, 0x00, 0x60, ], restart: [ 0xa5, 0x50, 0x00, 0xff, ], };
browserAction.setBadgeBackgroundColor({ color: colors.normal, });
let wasChanged = false; ChromeStyle.onWritten(changed => {
	browserAction.setBadgeBackgroundColor({ color: changed ? colors.restart : colors.normal, });
	(changed || wasChanged) && reportSuccess(
		`The UI styles were written`, changed
		? `and have changed. The browser must be restarted to apply the changes!`
		: `and changed back. No need to restart the browser anymore!`
	);
	wasChanged = changed; setBage();
});


// handle uncaught exceptions/rejections in the native modules to prevent the process from exiting
Native.onUncaughtException(error => { reportError('Unhandled error in native code', error); /*Native.nuke();*/ });
Native.onUnhandledRejection(error => { reportError('Unhandled rejection in native code', error); /*Native.nuke();*/ });


// debug stuff
Object.assign(global, module.exports = {
	Browser: require('node_modules/web-ext-utils/browser/'),
	options,
	Parser,
	Native,
	ContentStyle,
	ChromeStyle,
	LocalStyle,
	RemoteStyle,
});

}); })(this);
