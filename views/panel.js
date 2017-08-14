(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Tabs, },
	'node_modules/web-ext-utils/utils/': { reportError, reportSuccess, },
	'background/remote/': Remote,
}) => async ({ document, }, { activeTab, }) => {

document.body.innerHTML = `
	<style> :root { background: #424F5A; filter: invert(1) hue-rotate(180deg); font-family: Segoe UI, Tahoma, sans-serif; } </style>
	<b>Install style</b><br>
	<input id="url" type="text" placeholder="URL to .css file" style="min-width:300px;"></input><br>
	<button id="add">Add style</button>
`;
const input  = document.querySelector('#url');
const button = document.querySelector('#add');

let url = (activeTab !== Tabs.TAB_ID_NONE ? (await Tabs.get(activeTab)) : (await Tabs.query({ currentWindow: true, active: true, }))[0]).url;

switch (true) {
	case (/^https?:\/\/userstyles\.org\/styles\/\d+/).test(url): {
		url = 'https://userstyles.org/styles/'+ (/\d+/).exec(url)[0] +'.css';
	} break;
	case (/^https:\/\/github.com\/[\w-]+\/[\w-]+\/blob\/master\/.*\.css/).test(url): {
		url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/master/', '/master/');
	} break;
}

input.value = url;

button.addEventListener('click', event => {
	if (event.button) { return; }
	const url = input.value; button.disabled = true;
	Remote.addFromUrl(url).then(
		() => { reportSuccess(`Style added`, `from "${ url }"`); input.value = ''; button.disabled = false; },
		error => { reportError(`Failed to add style from "${ url }"`, error); button.disabled = false; },
	);
});

}); })(this);
