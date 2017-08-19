(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/utils/': { reportError, reportSuccess, },
	'node_modules/es6lib/dom': { saveAs, writeToClipboard, },
}) => async window => {

const { document, Blob, } = window;

document.body.innerHTML = `
	<style> :root { font-family: Segoe UI, Tahoma, sans-serif; } </style>
	<h1>Setup (currently Windows x64 only)</h1>
	To load local styles and apply styles to the browser UI of Firefox, you have to install an additional application and allow reStyle to connect to it.<br>
	To do so, please follow these steps:
	<ol>
		<li>Download and execute <a href="https://github.com/NiklasGollenstede/native-ext/releases/download/v0.0.1/native-ext-v0.0.1-x64.exe">this version</a>
		of <a href="https://github.com/NiklasGollenstede/native-ext" target="_blank">NativeExt</a>. Ater the installation, you should get a success message.</li>
		<li><button id="copy-vendor">Copy</button> the path <code>%APPDATA%\\de.niklasg.native_ext\\vendors</code>.</li>
		<li><button id="save-config">Save</button> this config file in the location copied above.</li>
		<li><button id="copy-refresh">Copy</button> the path <code>%APPDATA%\\de.niklasg.native_ext\\refresh.bat</code>.</li>
		<li>Execute the script in that loaction, for example by pressing <code>Windows</code> + <code>R</code>, pasting the path there and pressing enter. You should see another a success message.</li>
		<li>Done! you can now enable <b>UI Styles</b> and the <b>Development Mode</b> in the options.</li>
	</ol>
`;

document.querySelector('#copy-vendor').onclick = () => writeToClipboard(
	'%APPDATA%\\de.niklasg.native_ext\\vendors',
).then(
	() => reportSuccess('Copied'), () => reportError('Please copy manually'),
);

document.querySelector('#save-config').onclick = () => saveAs.call(window,
	new Blob([ '{"firefox-ext-ids":["@re-style"]}', ], { type: 'application/json', }), 're-style.json',
);

document.querySelector('#copy-refresh').onclick = () => writeToClipboard(
	'%APPDATA%\\de.niklasg.native_ext\\refresh.bat',
).then(
	() => reportSuccess('Copied'), () => reportError('Please copy manually'),
);

}); })(this);
