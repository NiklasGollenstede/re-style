(function(global) { 'use strict'; define(require => { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

async function mapUrl(url, tab) { switch (true) {
	case (/^https?:\/\/userstyles\.org\/styles\/\d+/).test(url): {
		if (!tab) { return 'https://userstyles.org/styles/'+ (/\d+/).exec(url)[0] +'.css'; }
		let query; try { query = (await
			(await require.async('node_modules/web-ext-utils/loader/'))
			.runInFrame(tab.id, 0, readUserstylesOrgOptions)
		); } catch (error) { console.error(error); }
		if (!query) { return 'https://userstyles.org/styles/'+ (/\d+/).exec(url)[0] +'.css'; }
		return 'https://userstyles.org/styles/chrome/'+ (/\d+/).exec(url)[0] +'.css?'+ query;
	}
	case (/^https:\/\/github.com\/[\w-]+\/[\w-]+\/blob\/master\/.*\.css/).test(url): {
		return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/master/', '/master/');
	}
	case !(/^https?:\/\//).test(url): {
		return '';
	}
	default: return url;
} }

return mapUrl;

async function readUserstylesOrgOptions() { return (await Promise.all(Array.from(
	document.querySelectorAll('#advancedsettings_area input, #advancedsettings_area select'), /* global document, */
	async field => {
		if (!field.name) { return ''; }
		let value = field.value;
		if (field.type === 'radio') {
			if (!field.checked) { return ''; }
			if (value === 'user-url') {
				value = document.querySelector('#option-user-url-'+ field.id.match(/\d+/)).value;
			} else if (value === 'user-upload') {
				const input = document.querySelector('#option-user-upload-'+ field.id.match(/\d+/));
				const file = input.files[0]; if (!file) { return ''; }
				const { readBlob, } = (await require.async('node_modules/es6lib/dom'));
				value = (await readBlob(file, 'dataUrl'));
			}
		}
		return field.name +'='+ encodeURIComponent(value);
	},
))).filter(_=>_).join('&'); }

}); })(this);
