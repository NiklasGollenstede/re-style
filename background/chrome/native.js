/* eslint-env node */ /* eslint-disable strict, no-console */ 'use strict'; /* global require, module, process, Buffer, */

module.exports = {

	/**
	 * Reads the entire content of `userChrome.css` and `userContent.css`. from <profileDir>/chrome/.
	 * Doesn't throw and returns empty strings if reading fails
	 * @return {object}   Object of { chrome, content, } with both UTF-8 strings with native line endings.
	 */
	read,

	/**
	 * Reads the content of `userChrome.css` and `userContent.css`. from <profileDir>/chrome/.
	 * @param {object}  files  Object of { chrome, content, } with both UTF-8 strings with only '\n' line endings.
	 * @param {string}  exp    Optional regular expression to replace only a part if the file content
	 *                         or append the new content to the end of the file.
	 */
	write,
};

//// start implementation

const FS = require('fs'), { promisify, } = require('util'), { EOL, } = require('os'), VM = require('vm');
const access = promisify(FS.access), mkdir = promisify(FS.mkdir), readFile = promisify(FS.readFile), writeFile = promisify(FS.writeFile);
const { profileDir, } = require('browser');

async function write(files, exp = '.*', enable = false) {
	try { (await access(profileDir)); } catch (_) { throw new Error(`Cant access profile directory in "${profileDir}"`); }
	try { (await mkdir(profileDir +'/chrome')); } catch (_) { }

	(await Promise.all([
		replaceInFile(cssFilePath('chrome'), exp, files.chrome),
		replaceInFile(cssFilePath('content'), exp, files.content),
		enable && setUserConfig([
			{ name: 'toolkit.legacyUserProfileCustomizations.stylesheets', value: true, comment: 'enforced by reStyle, required to apply browser styles', },
		]).catch(console.error),
	]));
}

async function read() {
	const files = { chrome: '', content: '', };
	(await Promise.all(Object.keys(files).map(async type => {
		files[type] = (await readIfExists(cssFilePath(type)));
	})));
	return files;
}

function cssFilePath(type) { return profileDir +`/chrome/userC${ type.slice(1) }.css`; }

async function readIfExists(path) {
	try { return (await readFile(path, 'utf-8')); }
	catch (error) { error && error.code !== 'ENOENT' && console.error(error); return ''; }
}

async function replaceInFile(path, exp, content) {
	content = (await readIfExists(path))
	.replace(new RegExp(exp +'|$'), () => content.replace(/\n/g, EOL));
	(await writeFile(path, content, 'utf-8'));
}

/**
 * Writes `about:config` values to the current profiles `user.js` file.
 * If one or more entry with the same name exists, the first one will be replaced
 * and the remaining ones removed. If none existed, the new entry will be appended.
 * This function currently doesn't handle multi-line entries or comments properly.
 * @param {[object]}  prefs  Array of objects representing the entries to write:
 * @property      {string}                 name     Name of the config value.
 * @property      {string|number|boolean}  value    New value to write.
 * @property      {string}                 comment  Single-line comment to append to the new line.
 * @throws {TypeError}  If the `user.js` file is not valid JavaScript before or after replacing the values.
 */
async function setUserConfig(prefs) {
	const path = profileDir +'/user.js';
	let script = tryCompile((await readIfExists(path)));

	for (const { name, value, comment, } of prefs) {
		let replaced = false;
		script = tryCompile(script.replace(new RegExp(
			`\\n\\s*?user_pref\\((["'])${ name.replace(/([.])/g, '[$1]') }\\1.*|$`, 'g'
		), match => {
			if (replaced) { return match ? '\n' : ''; } replaced = true;
			return `\nuser_pref(${ JSON.stringify(name) }, ${ JSON.stringify(value) });`+ (comment ? ' // '+ comment : '');
		}));
	}

	function tryCompile(script) { new VM.Script(script, { filename: 'user.js', }); return script; }

	(await writeFile(path, script, 'utf-8'));
}
