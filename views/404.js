(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/string': { escapeHtml, },
	'node_modules/web-ext-utils/browser/': { manifest, },
}) => ({ document: { body, }, history: { state, }, }, { name, }) => {

const code = (/^[45]\d\d$/).test(name) && name;
!code && console.error(`Got unknown view "${ name }"`);

let message; switch (code) {
	case '403': message = (state && state.from ? `"${ state.from }"` : 'The page') +` can not be accessed`; break;
	case '404': message = `${ manifest.name } could not find that page`; break;
	default:    message = `The page "${ name }" does not exist`; break;
}

body.innerHTML = `
	<h1>${ +code || 404 }</h1>
	<h3>${ escapeHtml(message) }</h3>
`;

}); })(this);
