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

return { debounceIdle, isSubDomain, };

}); })(this);
