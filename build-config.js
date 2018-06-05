/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals module, */ // license: MPL-2.0
module.exports = function({ options, /*packageJson,*/ manifestJson, files, }) {

	// manifestJson.applications.chrome = { id: 'embimhfddeikmonnjmkdlcgigakajajd', };

	manifestJson.permissions.push(
		'nativeMessaging',
		'notifications',
		// 'sessions', // remove closed popups // TODO: add this as a minor update at some point
		'tabs',
		'webNavigation',
		'<all_urls>',
	);

	!options.viewRoot && (options.viewRoot = options.chrome ? 'reStyle.html' : 'reStyle');

	manifestJson.options_ui.open_in_tab = true;

	manifestJson.browser_action.default_icon = manifestJson.icons;

	delete manifestJson.background.persistent;

	files.node_modules = [
		'es6lib/dom.js',
		'es6lib/functional.js',
		'multiport/index.js',
		'native-ext/index.js',
		'native-ext/init.node.js',
		'native-ext/manager.js',
		'native-ext/process.js',
		'pbq/require.js',
		'regexpx/index.js',
		'web-ext-utils/browser/index.js',
		'web-ext-utils/browser/storage.js',
		'web-ext-utils/browser/version.js',
		'web-ext-utils/loader/_background.html',
		'web-ext-utils/loader/_background.js',
		'web-ext-utils/loader/_view.html',
		'web-ext-utils/loader/_view.js',
		'web-ext-utils/loader/content.js',
		'web-ext-utils/loader/home.js',
		'web-ext-utils/loader/index.js',
		'web-ext-utils/loader/views.js',
		'web-ext-utils/options/editor/about.css',
		'web-ext-utils/options/editor/about.js',
		'web-ext-utils/options/editor/dark.css',
		'web-ext-utils/options/editor/index.css',
		'web-ext-utils/options/editor/index.js',
		'web-ext-utils/options/index.js',
		'web-ext-utils/tabview/index.css',
		'web-ext-utils/tabview/index.js',
		'web-ext-utils/update/index.js',
		'web-ext-utils/utils/icons/',
		'web-ext-utils/utils/event.js',
		'web-ext-utils/utils/files.js',
		'web-ext-utils/utils/index.js',
		'web-ext-utils/utils/semver.js',
	];

};
