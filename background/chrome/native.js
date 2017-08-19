async port => { 'use strict'; /* global require, process, Buffer, */ /* eslint-disable no-console */ // eslint-disable-line no-unused-expressions

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

	const buffer = Buffer.allocUnsafe(Buffer.byteLength(css));
	buffer.write(css, 0, 'utf-8');

	try { (await get(FS.stat, profileDir)); } catch (_) { throw new Error(`Cant access profile directory in "${ profileDir }"`); }
	try { (await get(FS.mkdir, profileDir +'/chrome')); } catch (_) { }

	let changed = 0;
	try { changed |= Buffer.compare(buffer, (await get(FS.readFile, profileDir +'/chrome/userChrome.css', buffer))); } catch (_) { changed = 1; }
	try { changed |= Buffer.compare(buffer, (await get(FS.readFile, profileDir +'/chrome/userContent.css', buffer))); } catch (_) { changed = 1; }
	if (!changed) { console.log('userC*.css not changed'); return false; }

	(await get(FS.writeFile, profileDir +'/chrome/userChrome.css', buffer));
	(await get(FS.writeFile, profileDir +'/chrome/userContent.css', buffer));
	console.log('wrote userC*.css'); return true;
});

port.ended.then(() => console.log('chrome closed'));

} // eslint-disable-line
