(function(global) { 'use strict'; define(require => { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.


const sources = [ {
	title: 'UserStyles.org',
	match: (/^https?:\/\/userstyles\.org\/styles\/\d+/),
	async getStyle(url, _, tab) {
		const id =  (/\d+/).exec(url)[0];
		if (!tab) { return `https://userstyles.org/styles/${id}.css`; }
		let query; try { query = (await
			(await require.async('node_modules/web-ext-utils/loader/')) // most likely won't need this, so load it lazily
			.runInFrame(tab.id, 0, readUserstylesOrgOptions)
		); } catch (error) { console.error(error); }
		return `https://userstyles.org/styles/${id}.css` + (query ? '?'+ query : '');
	},
}, {
	title: 'OpenUserCSS',
	match: (/^https:\/\/openusercss\.org\/theme\/([\da-z]{24})\/?$/),
	getStyle(url, [ , id, ]) { return `https://api.openusercss.org/theme/${id}.user.css`; },
}, {
	title: 'GitHub',
	match: (/^https:\/\/github\.com\/([\w-]+\/[\w-]+)\/blob\/(.*\.css.*)$/),
	getStyle(url, [ , repo, path, ]) { return `https://raw.githubusercontent.com/${repo}/${path}`; },
}, {
	title: 'GitLab',
	match: (/^https:\/\/gitlab\.com\/([\w-]+\/[\w-]+\/[\w-]+)\/blob\/(.*\.css.*)$/),
	getStyle(url, [ , repo, path, ]) { return `https://gitlab.com/${repo}/raw/${path}`; }, // TODO: test this
}, ];


/**
 * Maps the url of a tab to a url suited for style installation.
 * Currently supports 'userstyles.org', 'github.com' and generic https?:// urls.
 * @param  {string}  url  Installation pages url.
 * @param  {Tab?}    tab  Optional tabs.Tab to give additional context information.
 * @return {string}       Url that can, more likely, be used for style installation.
 */
return async function mapUrl(url, tab) {
	const source = sources.find(_=>_.match.test(url));
	if (source) { const match = source.match.exec(url); return source.getStyle(url, match, tab); }
	if (!(/^https?:\/\//).test(url)) { return ''; }
	return url;
};


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
