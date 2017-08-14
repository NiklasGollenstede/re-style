/*eslint strict: ['error', 'global'], no-implicit-globals: 'off'*/ 'use strict'; /* globals module, */ // license: MPL-2.0
module.exports = function({ options, /*packageJson,*/ manifestJson, files, }) {

	manifestJson.permissions.push(
		'nativeMessaging',
		'notifications',
		'tabs',
		'webNavigation',
		'<all_urls>',
	);

	manifestJson.options_ui.open_in_tab = true;

	files.node_modules = {
		es6lib: [
			'dom.js',
			'functional.js',
		],
		regexpx: [
			'index.js',
		],
		'web-ext-utils': {
			'.': [
				'browser/index.js',
				'browser/version.js',
				'loader/',
				'tabview/',
				'utils/',
				'lib/multiport/index.js',
				'lib/pbq/require.js',
			],
			options: {
				'.': [ 'index.js', ],
				editor: [
					'about.js',
					'about.css',
					'dark.css',
					'index.js',
					'index.css',
					'inline.js',
				],
			},
			update: [
				'index.js',
			],
		},
	};

	if (options.run && !(options.run.prefs === 0 || options.run.prefs === null)) {
		const run = typeof options.run === 'object' ? options.run
		: (options.run = { bin: typeof options.run === 'string' ? options.run : undefined, });
		const prefs = {
			// ...
		};
		run.prefs ? Object.assign(run.prefs, prefs) : (run.prefs = prefs);
	}
};
