/* eslint-env node */ /* eslint-disable strict, no-console */ 'use strict'; /* global require, module, */

const { URL, } = require('url');

// (url: string) => ({ data: string, type: string, })
module.exports = url => new Promise((resolve, reject) => {
	url = new URL(url);
	let http; switch (url.protocol) {
		case 'http:': case 'https:': http = require(url.protocol.slice(0, -1)); break;
		default: throw new Error(`Unsupported protocol ${ url.protocol }`);
	}
	http.get(url, (response) => { try {
		const type = response.headers['content-type'];
		if (response.statusCode !== 200) {
			response.resume(); // consume response data to free up memory
			throw new Error(`Status Code: ${ response.statusCode }`);
		}
		if (!(/^(?:text\/css|application\/json)$/).test(type)) {
			throw new TypeError(`Unexpected MIME-Type: ${ type }`);
		}
		response.setEncoding('utf8');
		let data = ''; response.on('data', chunk => (data += chunk));
		response.on('end', () => resolve({ data, type, }));
	} catch (error) { reject(error); } }).on('error', reject);
});
