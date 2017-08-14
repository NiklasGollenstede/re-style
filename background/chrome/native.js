async port => { 'use strict'; /* global require, process, */ // eslint-disable-line no-unused-expressions

console.log('init chrome');

const FS = require('fs'); const Path = require('path');
function get(api, ...args) { return new Promise((resolve, reject) => api(...args, (error, value) => error ? reject(error) : resolve(value))); }

port.addHandler(async function writeUserChromeCss(profileDir, css) {
	if (!profileDir && process.env.MOZ_CRASHREPORTER_EVENTS_DIRECTORY) {
		profileDir = Path.resolve(process.env.MOZ_CRASHREPORTER_EVENTS_DIRECTORY, '../..');
	}
	if (!profileDir) {
		throw new Error(`The profile location is not specified and can't be detected. Please set it manually.`);
	}

	try { (await get(FS.stat, profileDir)); } catch (_) { throw new Error(`Cant access profile directory in "${ profileDir }"`); }
	try { (await get(FS.mkdir, profileDir +'/chrome')); } catch (_) { }
	(await get(FS.writeFile, profileDir +'/chrome/userChrome.css', css, 'utf8'));
	(await get(FS.writeFile, profileDir +'/chrome/userContent.css', css, 'utf8'));
	console.log('wrote userC*.css');
});

port.ended.then(() => console.log('chrome closed'));

} // eslint-disable-line
