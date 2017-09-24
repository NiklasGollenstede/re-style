/* eslint-env node */ /* eslint-disable strict, no-console */ 'use strict'; /* global require, module, process, Buffer, */

const FS = require('fs'); const Path = require('path');
function get(api, ...args) { return new Promise((resolve, reject) => api(...args, (error, value) => error ? reject(error) : resolve(value))); }

module.exports = async function writeUserChromeCss(profileDir, files) {
	if (!profileDir && process.env.MOZ_CRASHREPORTER_EVENTS_DIRECTORY) {
		profileDir = Path.resolve(process.env.MOZ_CRASHREPORTER_EVENTS_DIRECTORY, '../..');
	}
	if (!profileDir) {
		throw new Error(`The profile location is not specified and can't be detected. Please set it manually.`);
	}

	try { (await get(FS.access, profileDir)); } catch (_) { if (!files) { return false; } else { throw new Error(`Cant access profile directory in "${ profileDir }"`); } }

	const changed = (await Promise.all([ 'Chrome', 'Content', ].map(async suffix => {
		if (!files) {
			try { (await get(FS.unlink, profileDir +`/chrome/user${suffix}.css`)); }
			catch (_) { return false; } return true;
		}

		const css = files[suffix.toLowerCase()];
		const buffer = Buffer.allocUnsafe(Buffer.byteLength(css));
		buffer.write(css, 0, 'utf-8');

		try { (await get(FS.mkdir, profileDir +'/chrome')); } catch (_) { }

		let changed = true; try { changed = 0 !== Buffer.compare(buffer, (await get(FS.readFile, profileDir +`/chrome/user${suffix}.css`, buffer))); } catch (_) { }

		changed && (await get(FS.writeFile, profileDir +`/chrome/user${suffix}.css`, buffer));

		return changed;
	}))).some(_=>_);

	console.log(changed ? 'wrote userC*.css' : 'userC*.css not changed');
	return changed;
};
