(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'common/options': options,
}) => {

!options.local.values.isSet && (options.local.value = true); // default used to be true

}); })(this);
