async port => { 'use strict'; /* global require, */ // eslint-disable-line no-unused-expressions

console.log('init local');

const FS = require('fs'); const Path = require('path').posix;
function get(api, ...args) { return new Promise((resolve, reject) => api(...args, (error, value) => error ? reject(error) : resolve(value))); }

const cb2watcher = new WeakMap;

async function readStyles(dir, onChange) {
	dir = dir.replace(/\\/g, '/'); const data = { }, mtime = { };
	(await (async function read(dir) {
		for (const name of (await get(FS.readdir, dir))) {
			// console.log('check', dir, name);
			if (name.startsWith('.')) { continue; }
			const path = Path.join(dir, name);
			const stat = (await get(FS.stat, path));
			if (stat.isDirectory()) {
				(await read(path));
			} else if (stat.isFile() && name.endsWith('.css')) {
				data[path] = (await get(FS.readFile, path, 'utf8'));
				onChange && (mtime[path] = stat.mtimeMs);
			}
		}
	})(dir));
	if (!onChange) { return data; }

	console.log('watching', dir);
	const watcher = FS.watch(dir, { persistent: false, recursive: true, }, async (type, name) => {
		name = name.replace(/\\/g, '/');
		if (!name || (/^\.|\/\./).test(name) || !name.endsWith('.css')) { return; }
		const path = Path.join(dir, name);
		let stat; try { stat = (await get(FS.stat, path)); } catch (_) { }
		if (!stat) { return void onChange(path, null); } // delete
		const file = (await get(FS.readFile, path, 'utf8'));
		if (file === data[path]) { return void console.log('no change', name); } // ???
		onChange(path, (data[path] = file));
	});

	cb2watcher.set(onChange, watcher);
	return data;
}


port.addHandlers({
	readStyles,
	release(onChange) {
		console.log('release');
		const watcher = cb2watcher.get(onChange); cb2watcher.delete(onChange);
		watcher && watcher.close();
	},
});

port.ended.then(() => console.log('port closed'));

} // eslint-disable-line
