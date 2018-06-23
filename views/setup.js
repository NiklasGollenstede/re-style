(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/version': { current: browser, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'node_modules/native-ext/': Native,
}) => async window => { const { document, } = window;

document.body.innerHTML = `
	<style>
		:root { font-family: Segoe UI, Tahoma, sans-serif; }
		body { margin: 20px; }
		code { padding: 2px 3px; border-radius: 3px; }
		button {
			color: white; background-color: black;
			border: 1px solid white; border-radius: 3px;
			outline: none; padding: 2px 7px;
			height: 25px; font-size: 15px;
		}
		#todo:not(.active), #done:not(.active) { display: none; }
		p { margin: .4em -.5em .2em; padding: .1em .5em 0.3em; } #error { background: #7a3300; }
	</style>
	<h1>NativeExt Setup</h1>
	<div id=todo class=active>
		<p>To load local styles and apply styles to the browser UI of Firefox, reStyle needs access to the NativeExt extension.</p>
		<p>Please <a href id=extension target=_blank>install</a> the NativeExt extension and follow its setup instructions,
			then click this <button id=request>Request Permission</button> button.</p>
		<p id=error style="display: none">Error: <span id=message></span></p>
	</div><div id=done>
		<p>It seems you are all set!</p>
		<p>You can now use <a href="#options#.chrome">UI Styles</a>
			and enable the <a href="#options#.local">Development Mode</a> in the options.</p>
		<p><small><a href id=instructions>Show instructions</a></small></p>
	</div>
`;

const todo = document.querySelector('#todo'), done = document.querySelector('#done');
function show(section) { document.querySelectorAll('.active').forEach(_=>_.classList.remove('active')); section.classList.add('active'); }
if ((await Native.getApplicationName({ stale: null, }))) { show(done); }
document.querySelector('#instructions').onclick = e => { if(!e.button) { show(todo); e.preventDefault(); } };

document.querySelector('#extension').href = Native.extensionInstallPage(browser);

document.querySelector('#request').onclick = async e => { if(!e.button) { try {
	notify.info('Requesting permission', `To proceed, please click "Allow" in the popup window.`);
	const reply = (await Native.requestPermission({
		message: `reStyle needs access to the NativeExt to load local styles and apply styles to the browser UI of Firefox.`,
	})); if (reply.failed) { throw new Error(reply.message); }
	show(done);
	notify.success('Access granted');
	document.querySelector('#error').style.display = 'none';
	document.querySelector('#message').textContent = '';
} catch (error) {
	notify.error(error);
	document.querySelector('#error').style.display = 'block';
	document.querySelector('#message').textContent = error.message;
} } };

}); })(this);
