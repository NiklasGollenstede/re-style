(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Tabs, },
	'node_modules/web-ext-utils/utils/': { reportError, reportSuccess, },
	'background/remote/': Remote,
	'background/remote/map-url': mapUrl,
}) => async ({ document, }, { activeTab, }) => {

document.body.innerHTML = `
	<style>
		:root { background: #424F5A; filter: invert(1) hue-rotate(180deg); font-family: Segoe UI, Tahoma, sans-serif; }
		textarea { resize: vertical; max-height: 8.2em; min-height: 3.5em; overflow-y: scroll; word-break: break-all; }
	</style>
	<b>Install style</b><br>
	<textarea id="url" type="text" placeholder="URL to .css file" style="width:300px;resize:vertical;"></textarea><br>
	<button id="add">Add style</button>
`;
const input  = document.querySelector('#url');
const button = document.querySelector('#add');

const tab = activeTab !== Tabs.TAB_ID_NONE ? (await Tabs.get(activeTab)) : (await Tabs.query({ currentWindow: true, active: true, }))[0];
input.value = (await mapUrl(tab.url, tab));

button.addEventListener('click', event => {
	if (event.button) { return; }
	const url = input.value.trim(); button.disabled = true;
	Remote.add(url).then(
		() => { reportSuccess(`Style added`, `from "${ url }"`); input.value = ''; button.disabled = false; },
		error => { reportError(`Failed to add style from "${ url }"`, error); button.disabled = false; },
	);
});

}); })(this);
