(function(global) { 'use strict'; define(() => { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

/// throttles the invocations of `callback` such that at least `minDelay` ms of idle CPU time pass between calls
function debounceIdle(callback, minDelay) {
	let time = 0, args = null;
	function loop(idle) {
		const left = idle.timeRemaining(); time -= left;
		if (time <= 0) { const tmp = args; args = null; callback.apply(null, tmp); }
		else { setTimeout(() => requestIdleCallback(loop), left + 1); } /* global setTimeout, requestIdleCallback, */
	}
	return function(..._args) {
		!args && requestIdleCallback(loop);
		time = minDelay; args = _args;
	};
}

/// returns true iff sub is (a sub domain of) domain
function isSubDomain(domain, sub) {
	return sub.endsWith(domain) && (domain.length === sub.length || sub[sub.length - domain.length - 1] === '.');
}

function sanatize(html) {
	const parts = (html ? html +'' : '').split(rTag);
	return parts.map((s, i) => i % 2 ? s : s.replace(rEsc, c => oEsc[c])).join('');
}
const rTag = /(&(?:[A-Za-z]+|#\d+|#x[0-9A-Ea-e]+);|<\/?(?:a|abbr|b|br|code|details|em|i|p|pre|kbd|li|ol|ul|small|spam|span|strong|summary|sup|sub|tt|var)(?: download(?:="[^"]*")?)?(?: href="(?!(?:javascript|data):)[^\s"]*?")?(?: title="[^"]*")?>)/;
const oEsc = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '/': '&#47;', };
const rEsc = new RegExp('['+ Object.keys(oEsc).join('') +']', 'g');

async function sha1(string) {
	typeof string !== 'string' && (string = JSON.stringify(string)); // for the styles loaded from https://userstyles.org/styles/chrome/\d+.json
	const hash = (await global.crypto.subtle.digest('SHA-1', new global.TextEncoder('utf-8').encode(string)));
	return Array.from(new Uint8Array(hash)).map((b => b.toString(16).padStart(2, '0'))).join('');
}

function deepFreeze(json) { if (typeof json === 'object' && json !== null) {
	Object.freeze(json); Object.values(json).forEach(deepFreeze);
} return json; }

return { debounceIdle, isSubDomain, sanatize, sha1, deepFreeze, };

}); })(this);
