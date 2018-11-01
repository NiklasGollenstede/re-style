(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
}) => async window => { const { document, } = window;

document.body.innerHTML = `
	<style>
		:root { font-family: Segoe UI, Tahoma, sans-serif; }
		body { margin: 20px; }
		p { margin: .4em -.5em .2em; padding: .1em .5em 0.3em; }
	</style>
	<h1>Firefox restarted</h1>
	<p>Thanks for restarting your browser. Your new UI Styles should now be in effect.</p>
`;

}); })(this);
