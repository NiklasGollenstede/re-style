(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { saveAs, },
	'node_modules/native-ext/install': { script, download, },
}) => async window => { const { document, } = window;

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
		<li><a id="download-bin" download><b>Download</b></a> and
			execute <a href="https://github.com/NiklasGollenstede/native-ext" target="_blank">NativeExt</a>.
			After the installation, you should get a success message.</li>
		<li><a href id="save-script"><b>Save</b></a><span class="unix-only">, extract</span>
			and run <a id="show-script" href target="_blank">this script</a>.
			After dismissing some security warnings, you should see another a success message.</li>
		<li>Done! you can now enable <a href="#options#.chrome">UI Styles</a>
			and the <a href="#options#.local">Development Mode</a> in the options.</li>
	</ol>
`; // TODO: on mac, open with 'Archive Utility', ctrl+click `add ${manifest.name}.command`, 'Open' -> 'Open'

document.querySelector('#download-bin').href = download.direct;
const show = document.querySelector('#show-script'), save = document.querySelector('#save-script');
save.onclick = e => { if (!e.button) { saveAs.call(window, script.url, script.name); e.preventDefault(); } };
show.href = window.URL.createObjectURL(new window.Blob([ '<code><pre>', script.text, '</pre></code>', ], { type: 'text/html', }));
show.title = script.text;
!(/windows/i).test(window.navigator.oscpu) && document.body.classList.add('unix');

}); })(this);
