(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { saveAs, },
}) => async window => {

const { document, Blob, URL, } = window;

const windows = (/windows/i).test(global.navigator.oscpu), macos = !windows && (/mac\s*os\s*x/i).test(global.navigator.oscpu);
const type = windows ? 'application/x-bat' : 'application/x-shellscript';
const unixPath = macos ? '~/Library/Application\\ Support/de.niklasg.native_ext' : '~/.de.niklasg.native_ext';
const script = windows ? String.raw`
echo {"firefox-ext-ids":["@re-style"]} > %APPDATA%\de.niklasg.native_ext\vendors\re-style.json
%APPDATA%\de.niklasg.native_ext\refresh.bat
` : `
echo {"firefox-ext-ids":["@re-style"]} > ${ unixPath }/vendors/re-style.json
${ unixPath }/refresh.sh
`;

document.body.innerHTML = `
	<style>
		:root { font-family: Segoe UI, Tahoma, sans-serif; }
		code { padding: 2px 3px; border-radius: 3px; }
		body:not(.unix) .unix-only { display: none; }
	</style>
	<h1>Setup <small>(optional)</small></h1>
	To load local styles and apply styles to the browser UI of Firefox, you have to install an additional application and allow reStyle to connect to it.<br>
	To do so, please follow these steps:
	<ol>
		<li>Download and execute <a href="https://github.com/NiklasGollenstede/native-ext" target="_blank">NativeExt</a>.
			After the installation, you should get a success message.</li>
		<li><button id="save-script">Save</button> and run <a id="show-script" href target="_blank">this script</a>.
			After dismissing some security warnings<span class="unix-only"> and marking the script executable (e.g. with <code>chmod +r add-re-style.sh</code>)</span>,
			you should see another a success message.</li>
		<li>Done! you can now enable <b>UI Styles</b> and the <b>Development Mode</b> in the options.</li>
	</ol>
`;

document.querySelector('#save-script').onclick = () => saveAs.call(window, new Blob([ script, ], { type, }), 'add-re-style.'+ (windows ? 'bat' : 'sh'));
document.querySelector('#show-script').href = URL.createObjectURL(new Blob([ script.replace(/[\r\n]+/g, '<br>'), ], { type: 'text/html', }));
!windows && document.body.classList.add('unix');

}); })(this);
