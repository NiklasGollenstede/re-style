(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	require,
}) => {

global.setTimeout(() => { // must reload the cached .web styles
	Array.from(require('background/remote/'), ([ , style, ]) => style.reload());
}, 5*60*1000);

}); })(this);
