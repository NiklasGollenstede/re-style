/* eslint-env node */ /* eslint-disable strict, no-console */ 'use strict'; /* global require, module, process, Buffer, */

const FS = require('fs'), { promisify, } = require('util'), { EOL, } = require('os');
const access = promisify(FS.access), mkdir = promisify(FS.mkdir), readFile = promisify(FS.readFile), writeFile = promisify(FS.writeFile);
const { profileDir, } = require('browser');

async function write(files, exp = '.*') {
	try { (await access(profileDir)); } catch (_) { throw new Error(`Cant access profile directory in "${ profileDir }"`); }
	try { (await mkdir(profileDir +'/chrome')); } catch (_) { }

	(await Promise.all([ 'chrome', 'content', ].map(async type => {
		const old = (await readSafe(type));
		const css = old.replace(new RegExp(exp +'|$'), () => files[type].replace(/\n/g, EOL));

		(await writeFile(profileDir +`/chrome/userC${type.slice(1)}.css`, css, 'utf-8'));
	})));
}

async function read() {
	const files = { chrome: '', content: '', };
	(await Promise.all(Object.keys(files).map(async type => {
		files[type] = (await readSafe(type));
	})));
	return files;
}

async function readSafe(type) {
	try { return (await readFile(profileDir +`/chrome/userC${type.slice(1)}.css`, 'utf-8')); }
	catch (error) { error && error.code !== 'ENOENT' && console.error(error); return ''; }
}

module.exports = { read, write, };
