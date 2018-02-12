(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': Browser,
	'node_modules/web-ext-utils/update/': updated,
	'node_modules/web-ext-utils/utils/': { reportError, },
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
 * This file mostly just requires other files in order to load them.
 * LocalStyle and RemoteStyle automatically load their styles from their sources
 * and apply them as ChromeStyles or ContentStyles.
 */


// handle uncaught exceptions/rejections in the native modules to prevent the process from exiting
Native.onUncaughtException(error => { reportError('Unhandled error in native code', error); /*Native.nuke();*/ });
Native.onUnhandledRejection(error => { reportError('Unhandled rejection in native code', error); /*Native.nuke();*/ });
// TODO: don't just log the errors, they could be critical


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
