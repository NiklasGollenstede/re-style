(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { browserAction, Tabs, rootUrl, },
	'node_modules/web-ext-utils/browser/storage': { local: Storage, },
	'node_modules/web-ext-utils/browser/version': { fennec, },
	'node_modules/web-ext-utils/loader/views': { getUrl, openView, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'node_modules/es6lib/functional': { debounce, },
	'common/options': options,
	'views/': _, // put views in tabview
	'./chrome/': ChromeStyle,
	'./util': { isSubDomain, },
	Style,
}) => {

/**
 * This file autonomously manages the browser action badge text and color.
 * It also displays the browser restart prompt.
 */

//// start implementation

let notifyChange = true; options.chrome.children.notifyChange.whenChange(([ value, ]) => (notifyChange = value));
const wantedRestart = Storage.get('wantedRestart'); Storage.set('wantedRestart', false);

// browser_action (can not be set in manifest due to fennec incompatibility)
browserAction.setPopup({ popup: getUrl({ name: 'panel', }).slice(rootUrl.length - 1).replace('#', '?w=350&h=250#'), });
fennec && browserAction.onClicked.addListener(() => openView('panel'));

/**
 * Badge text:
 * Displays the number of active styles in the tabs main frame
 * '+' number matched custom include rules.
 * Updating this for every tab on every change seems inefficient, so this happens when:
 *    * the extension starts, for all visible tabs
 *    * any style changes or is added/removed, for all visible tabs
 *    * a tab becomes visible, for that tab
 *    * a visible tabs url changes, for that tab
 */
setBage(); Style.onChanged(debounce(() => setBage(), 50));
Tabs.onActivated.addListener(({ tabId, }) => setBage(tabId));
Tabs.onUpdated.addListener((tabId, change, { active, }) => active && ('url' in change) && setBage(tabId, change.url));
async function setBage(tabId, url) {
	if (arguments.length === 0) { // update all visible
		(await Promise.all((await Tabs.query({ active: true, })).map(({ id, url, }) => setBage(id, url)))); return;
	}
	url = new global.URL(url || (await Tabs.get(tabId)).url);
	let matching = 0, extra = 0; for (const [ , style, ] of Style) {
		if (style.disabled) { continue; }
		style.matches(url.href) && ++matching;
		style.options.include.children.forEach(_=>_.values.current.forEach(domain => isSubDomain(domain, url.hostname) && extra++));
	}
	(await browserAction.setBadgeText({ tabId, text: (matching || '') + (extra ? '+'+ extra : '') || (ChromeStyle.changed ? '!' : ''), }));
}


/**
 * Badge color:
 * Makes the badge orange if the browser should be restarted to apply chrome style changes.
 */
const colors = { normal: [ 0x00, 0x7f, 0x00, 0x60, ], restart: [ 0xa5, 0x50, 0x00, 0xff, ], };
browserAction.setBadgeBackgroundColor({ color: colors.normal, });
let wasChanged = false; ChromeStyle.onWritten(changed => {
	browserAction.setBadgeBackgroundColor({ color: changed ? colors.restart : colors.normal, });
	notifyChange && (changed || wasChanged) && (changed ? notify.warn : notify.info)( // info or warn would be more appropriate than error ...
		`The UI styles were written`, changed
		? `and have changed. The browser must be restarted to apply the changes!`
		: `and changed back. No need to restart the browser anymore!`
	);
	wasChanged = changed; setBage();
	Storage.set('wantedRestart', changed);
});

// i.e. clicked the  `Restart` button on `about:restartrequired` on behalf of reStyle
wantedRestart && (await Tabs.query({ active: true, currentWindow: true, }))[0].url === 'about:restartrequired' // (can't filter by { url: 'about:restartrequired', })
&& Tabs.update({ loadReplace: true, url: getUrl({ name: 'restarted', }), });

return { update: setBage, };

}); })(this);
