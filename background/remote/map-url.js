(function(global) { 'use strict'; define(() => { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

function mapUrl(url) {
	switch (true) {
		case (/^https?:\/\/userstyles\.org\/styles\/\d+/).test(url): {
			url = 'https://userstyles.org/styles/'+ (/\d+/).exec(url)[0] +'.css';
		} break;
		case (/^https:\/\/github.com\/[\w-]+\/[\w-]+\/blob\/master\/.*\.css/).test(url): {
			url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/master/', '/master/');
		} break;
	}
	return url;
}

return mapUrl;

}); })(this);
