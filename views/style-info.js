(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'background/style': Style,
}) => async (window, location) => { const { document, } = window;

document.head.insertAdjacentHTML('beforeend', `<style>
	:root { background: #242a31; filter: invert(1) hue-rotate(180deg); font-family: Segoe UI, Tahoma, sans-serif; }
	code { -moz-tab-size: 4; }
	pre>code:empty::after { content: '<none>'; }
</style>`);

showInfo(); location.onHashChange(() => window.location.reload());

function showInfo() {
	const url = location.hash;
	document.title = url +' – '+ manifest.short_name;

	let style; for (const { 1: it, } of Style) {
		if (it.url === url) { style = window.style = it; break; }
	} if (!style) {
		document.body.innerHTML = `<h1>No Style with URL <i id=url></i> installed</h1>`;
		document.getElementById('url').textContent = url; return;
	}
	style.onChanged(showInfo, { owner: window, });

	document.body.innerHTML = `
		<h2><a id=title title=open target=_blank></a><small> (<span id=id></span>)</small></h2>
		<p>The Style object can be inspected as <code>window.style</code>.<br>Fully processed style as currently applied:</p>
		<h3>Parsing errors <button id=reload>Re-parse</button></h3> <pre><code id=errors></pre></code>
		<h3>Metadata</h3> <pre><code id=meta></pre></code>
		<h3>Webpage</h3> <pre><code id=web></pre></code>
		<h3>userContent.css</h3> <pre><code id=content></pre></code>
		<h3>userChrome.css</h3> <pre><code id=chrome></pre></code>
	`;

	document.getElementById('reload').onclick = _=>!_.button && style.reload();
	document.getElementById('title').href = style.url;
	style.show && (document.getElementById('title').onclick = _=>!_.button && style.show().catch(notify.error) && _.preventDefault());

	Object.entries({
		title: style.url, id: style.id,
		errors: style.errors ? style.errors.join('\n') : 'Not cached, please re-parse!',
		meta: JSON.stringify(style.meta, (key, value) => key === 'restrict' ? undefined : value, '\t').slice(2, -2).replace(/^\t/gm, ''),
		web: style.web ? style.web.code : '',
		content: style.chrome && style.chrome.content ? style.chrome.content : '',
		chrome: style.chrome && style.chrome.chrome ? style.chrome.chrome : '',
	}).forEach(([ id, text, ]) => {
		document.getElementById(id).textContent = text;
	});
}

}); })(this);
