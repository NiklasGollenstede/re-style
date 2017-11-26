(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { saveAs, },
	'node_modules/native-ext/install': { script, },
}) => async window => {
const { document, } = window;
const windows = (/windows/i).test(global.navigator.oscpu);

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
		<li><button id="save-script">Save</button><span class="unix-only">, extract</span> and run <a id="show-script" href target="_blank">this script</a>.
			After dismissing some security warnings, you should see another a success message.</li>
		<li>Done! you can now enable <a href="#options#.chrome"><b>UI Styles</b></a> and the <a href="#options#.local"><b>Development Mode</b></a> in the options.</li>
	</ol>
`; // TODO: on mac, open with 'Archive Utility', ctrl+click `add ${manifest.name}.command`, 'Open' -> 'Open'

const show = document.querySelector('#show-script'), save = document.querySelector('#save-script');
save.onclick = async e => !e.button && saveAs.call(window, script.url, script.name);
show.href = window.URL.createObjectURL(new window.Blob([ '<code>', script.text.replace(/[\r\n]+/g, '<br>'), '</code>', ], { type: 'text/html', }));
show.title = script.text;
!windows && document.body.classList.add('unix');

}); })(this);
