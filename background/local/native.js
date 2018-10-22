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
		(await readAndWatch((/[\\/]user(?:Chrome|Content)[.]css$/), chromeDir, onChange));
	},

	/// Releases an `onChange` listener.
	release,

	/**
	 * Writes the content of an existing, non-hidden `.css` file.
	 * @param  {string}  path  Absolute file path.
	 * @param  {string}  css   UTF-8 string with only '\n' line endings to write.
	 */
	async writeStyle(path, css) {
		path = normalize(path); if (
			!(/\/[^.][^/\\]+\.css$/).test(path)
			|| (await get(FS.access, path, FS.constants.W_OK).then(_=>0/*OK*/,_=>1/*not OK*/))
		) { throw new Error(`Can't write to "${path}"`); }
		(await get(FS.writeFile, path, css.replace(/\n/g, EOL), 'utf-8'));
	},

	/**
	 * Creates a new, non-hidden `.css` file.
	 * @param  {string}  path  Absolute file path.
	 * @param  {string}  css   UTF-8 string with only '\n' line endings to write.
	 */
	async createStyle(path, css) {
		path = normalize(path); if (
			!(/\/[^.][^/\\]+\.css$/).test(path)
			|| (await get(FS.access, path).then(_=>1/*exists*/, _=>_.code !== 'ENOENT'/*can't write*/))
		) { throw new Error(`Can't create file "${path}"`); }
		(await get(FS.writeFile, path, css.replace(/\n/g, EOL), { encoding: 'utf-8', flags: 'wx', }));
	},

	/**
	 * Opens an existing, non-hidden `.css` file with the systems default program.
	 * @param  {string}  path  Absolute file path.
	 */
	async openStyle(path) {
		path = normalize(path); if (
			!(/\/[^.][^/\\]+\.css$/).test(path)
			|| (await get(FS.access, path).then(_=>0/*OK*/,_=>1/*not OK*/))
		) { throw new Error(`Can only open existing non-hidden .css files`); }
		switch (process.platform) {
			case 'win32':  (await
				get(execFile, 'explorer.exe', [ path.replace(/\//g, '\\'), ]) // must use windows paths
				.catch(() => null) // throws 'command failed' even if it worked
			); break;
			case 'linux':  (await get(execFile, 'xdg-open', [ path, ])); break;
			case 'darwin': (await get(execFile, 'open', [ path, ])); break;
		}
	},
};

//// start implementation

const FS = require('fs'), _Path = require('path'), Path = _Path.posix, { EOL, homedir, } = require('os'), { execFile, } = require('child_process');
function get(api, ...args) { return new Promise((resolve, reject) => api(...args, (error, value) => error ? reject(error) : resolve(value))); }

const cb2watcher = new WeakMap;

async function readAndWatch(include, dir, onChange, create) {
	dir = normalize(dir); const data = { }, mtime = { };
	try { (await get(FS.access, dir)); } catch (error) {
		if (error.code !== 'ENOENT' || !create || !(await mkdirp(dir))) { return null; }
	}
	(await (async function read(dir) {
		for (const name of (await get(FS.readdir, dir))) {
			// console.log('check', dir, name);
			if (name.startsWith('.')) { continue; }
			const path = Path.join(dir, name);
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
		const path = Path.join(dir, name);
		if (!name || (/^\.|\/\./).test(name) || !include.test(path)) { return; }
		let stat; try { stat = (await get(FS.stat, path)); } catch (_) { }
		if (!stat) { onChange(path, null); return; } // deleted
		const file = (await get(FS.readFile, path, 'utf8'));
		if (file === data[path]) { return /*void console.log('no change', name)*/; } // ???
		onChange(path, (data[path] = file));
	});

	cb2watcher.set(onChange, watcher);
	return data;
}

async function mkdirp(path) {
	const parts = path.split('/'); path = parts[0]; // first one is empty or the drive letter
	for (let i = 1, l = parts.length; i < l; ++i) {
		path = path +'/'+ parts[i];
		try { (await get(FS.mkdir, path)); }
		catch (error) { if (error.code !== 'EEXIST') { return false; } }
	} return true;
}

function release(onChange) {
	const watcher = cb2watcher.get(onChange); cb2watcher.delete(onChange);
	watcher && console.log('release');
	watcher && watcher.close();
}

/// ensures that the path is normalized, (platform specific) absolute and uses '/' as separator
function normalize(path) {
	path = path.replace(/^~[/\\]/, () => homedir() +'/');
	if (!_Path.isAbsolute(path)) { throw new Error(`Path ${JSON.stringify(path)} is not absolute`); }
	return Path.normalize(path.replace(/\\/g, '/'));
}
