/* eslint-env node */ /* eslint-disable strict, no-console */ 'use strict'; /* global require, module, */

const FS = require('fs'); const Path = require('path'), { EOL, } = require('os');
function get(api, ...args) { return new Promise((resolve, reject) => api(...args, (error, value) => error ? reject(error) : resolve(value))); }

const cb2watcher = new WeakMap;

async function readAndWatch(include, dir, onChange) {
	dir = dir.replace(/\\/g, '/').replace(/^~(?=[\\\/])/, () => require('os').homedir());
	const data = { }, mtime = { };
	(await (async function read(dir) {
		for (const name of (await get(FS.readdir, dir))) {
			// console.log('check', dir, name);
			if (name.startsWith('.')) { continue; }
			const path = Path.posix.join(dir, name);
			const stat = (await get(FS.stat, path));
			if (stat.isDirectory()) {
				(await read(path));
			} else if (stat.isFile() && include.test(path)) {
				data[path] = (await get(FS.readFile, path, 'utf8'));
				onChange && (mtime[path] = stat.mtimeMs);
			}
		}
	})(dir));
	if (!onChange) { return data; }

	console.log('watching', dir);
	release(onChange);
	const watcher = FS.watch(dir, { persistent: false, recursive: true, }, async (type, name) => {
		name = name.replace(/\\/g, '/');
		const path = Path.posix.join(dir, name);
		if (!name || (/^\.|\/\./).test(name) || !include.test(path)) { return; }
		let stat; try { stat = (await get(FS.stat, path)); } catch (_) { }
		if (!stat) { return void onChange(path, null); } // delete
		const file = (await get(FS.readFile, path, 'utf8'));
		if (file === data[path]) { return /*void console.log('no change', name)*/; } // ???
		onChange(path, (data[path] = file));
	});

	cb2watcher.set(onChange, watcher);
	return data;
}

function release(onChange) {
	const watcher = cb2watcher.get(onChange); cb2watcher.delete(onChange);
	watcher && console.log('release');
	watcher && watcher.close();
}

module.exports = {
	readStyles: readAndWatch.bind(null, (/\.css$/)),
	async watchChrome(onChange) {
		const chromeDir = Path.join(require('browser').profileDir, 'chrome');
		try { (await get(FS.mkdir, chromeDir)); } catch (_) { }
		(await readAndWatch((/[\/\\]user(?:Chrome|Content)[.]css$/), chromeDir, onChange));
	},
	release,
	async writeStyle(path, css) {
		if (!(/\.css$/).test(path)) { throw new Error(`Can only write .css files`); }
		(await get(FS.writeFile, path, css.replace(/\n/g, EOL), 'utf-8'));
	},
};
