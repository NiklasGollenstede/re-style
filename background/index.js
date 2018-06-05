(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': Browser,
	'node_modules/web-ext-utils/update/': updated,
	'node_modules/native-ext/': Native,
	'common/options': options,
	'views/': _, // put views in TabView (but doesn't load them yet)
	'./chrome/': ChromeStyle,
	'./local/': LocalStyle,
	'./remote/': RemoteStyle,
	'./web/': ContentStyle,
	Parser, Badge,
	module,
}) => {

/**
 * This file just requires other files in order to load them.
 * LocalStyle and RemoteStyle automatically load their styles from their sources
 * and apply them as ChromeStyles or ContentStyles.
 */
void (updated, Badge, LocalStyle, RemoteStyle); // must load these

// debug stuff
Object.assign(global, module.exports = {
	Browser,
	options,
	Parser,
	Native,
	ContentStyle,
	ChromeStyle,
	LocalStyle,
	RemoteStyle,
	Badge,
	updated,
});

}); })(this);
