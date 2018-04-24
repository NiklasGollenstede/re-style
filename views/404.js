(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { manifest, },
}) => ({ document: { body, }, history: { state, }, }, { name, }) => {

const code = (/^[45]\d\d$/).test(name) && name;
!code && console.error(`Got unknown view "${name}"`);

let message; switch (code) {
	case '403': message = (state && state.from ? `"${state.from}"` : 'The page') +` can not be accessed`; break;
	case '404': message = `${manifest.name} could not find that page`; break;
	default:    message = `The page "${name}" does not exist`; break;
}

body.innerHTML = `<style>:root{font-family:Segoe UI,Tahoma,sans-serif;}</style><h1 id=code></h1><h3 id=message></h3>`;
body.querySelector('#code').textContent = code || 404;
body.querySelector('#message').textContent = message;

}); })(this);
