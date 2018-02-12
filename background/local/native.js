/* eslint-env node */ /* eslint-disable strict, no-console */ 'use strict'; /* global require, module, */

module.exports = {

	/**
	 * Recursively reads all non-hidden `.css` files in a given folder.
	 * All data is returned as UTF-8 strings with native line endings.
	 * All returned paths are absolute and have `/` as separators.
	 * @param  {string}     path      Path of the folder to read, can start with `~/` and have either `/` or `\` as separators.
	 * @param  {function?}  onChange  Optional unique function(path, data?) as change listener.
	 *                                Only called if the contents of a file actually changed.
	 *                                Iff the file was deleted, `data` will be null.
	 * @return {object}               Object { [path]: data, } with all existing files.
	 */
	readStyles: readAndWatch.bind(null, (/\.css$/)),

	/**
	 * Listens for changes of the `userChrome`/`Content.css` files.
	 * @param  {function}  onChange  @see `readStyles`
	 */
	async watchChrome(onChange) {
		const chromeDir = Path.join(require('browser').profileDir, 'chrome');
		try { (await get(FS.mkdir, chromeDir)); } catch (_) { }
		(await readAndWatch((/[\/\\]user(?:Chrome|Content)[.]css$/), chromeDir, onChange));
	},

	/// Releases an `onChange` listener.
	release,

	/**
	 * Writes the content of an existing, non-hidden `.css` file.
	 * @param  {string}  path  Absolute file path.
	 * @param  {string}  css   UTF-8 string with only '\n' line endings to write.
	 */
	async writeStyle(path, css) {
		let stat; try { stat = (await get(FS.stat, path)); } catch (_) { }
		if (!stat || !(/\.css$/).test(path) || (/[\\\/]\./).test(path)) {
			throw new Error(`Can only write existing non-hidden .css files`);
		}
		(await get(FS.writeFile, path, css.replace(/\n/g, EOL), 'utf-8'));
	},
};

//// start implementation

const FS = require('fs'); const Path = require('path'), { EOL, } = require('os');
function get(api, ...args) { return new Promise((resolve, reject) => api(...args, (error, value) => error ? reject(error) : resolve(value))); }

const cb2watcher = new WeakMap;

async function readAndWatch(include, dir, onChange) {
	dir = dir.replace(/\\/g, '/').replace(/^~\//, () => require('os').homedir() +'/');
	const data = { }, mtime = { };
	try { (await get(FS.access, dir)); } catch (error) { return null; }
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
		if (!stat) { return void onChange(path, null); } // deleted
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
