(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/marked/marked.min': marked,
	'node_modules/regexpx/': RegExpX,
}) => {

marked.setOptions({
	pedantic: false, gfm: true, tables: true, breaks: false, // default
	smartLists: true, sanitize: false,
});
function renderBlock(string) {
	return marked(string).replace(/\\$/gm, '<br>').trim();
}
function renderInline(string) {
	return marked(string).replace(/<\/?(?:p|div|pre)>/gi, ' ').trim();
}

function tryParseJson(string) {
	try { return JSON.parse(string); } catch (_) { return string; }
}

// Forbids not CSS-escaped occurrences of `chars` in the string to match.
const disallowSpecial = chars => RegExpX('s')`^(?:
	  \/\* .*? \*\/             # comments
	| (?!\/\*) [^\\"'${chars}]  # normal characters, except comment begin
	| \\ .                      # backslash escaped anything
	| (?<q>["'])  (?:           # quoted string, i.e.: quote
		  (?!\k<q>) [^\\\n]         # anything except that quote or backslash
		| \\ .                      # backslash escaped anything
	)*? \k<q>                       # closing quote
)*$`;
// These RegExps decide whether a string can be pasted in a CSS sheet in different contexts
// without breaking more than the current statement or injecting additional statements.
// This meant help users not to mess up, not as a strict security mechanism.
// Must still make sure () and [] are balanced.
const rSelector = RegExpX`^(?=[^]*[^\s,]\s*$)${ disallowSpecial('{};') }`; // must not be empty or end with a comma
const rValue = disallowSpecial(':{};');
const rDeclarations = disallowSpecial('{}');
const rcUnit = RegExpX('n')`(
	  %                                   # percent
	| cap|ch|em|ex|ic|lh|rem|rlh          # font based
	| vh|vw|vi|vb|vmin|vmax               # viewport based
	| px|cm|mm|Q|in|pc|pt                 # absolute lengths
	| s|ms|hz|khz                         # time
	| dpcm|dpi|dppx                       # resolution
	| deg                                 # others (TODO: are there more?)
)`, rUnit = RegExpX`^${rcUnit}$`;
const rDimension = RegExpX('n')`^(
	  [+-]? (?: \d+ (\.\d*)? | \.\d+ ) ${rcUnit}   # sign plus digits or decimal point with digits before and/or after, followed by a unit
	| auto | inherit | initial | unset             # or a keyword
)$`;


function normalize(sheet, url) { {
	function onerror(message) {
		sheet.errors.push(message);
		console.error(message, 'in style loaded from', url);
	}
	function testType(type, key, value) {
		if (type === 'array' && Array.isArray(value)) { return true; }
		if (typeof value !== type || value === null) { onerror(
			`Metadata key ${key} must be a ${type}, but is ${ value ===  null ? null : 'a '+ typeof value }`,
		); return false; } return true;
	}
	function testUrl(key, value) {
		let url; try { url = new URL(value); } catch { }
		if (url && (/^https?:$/).test(url.protocol)) { return url.href; }
		onerror(`Metadata URL ${key} is not a valid HTTP(S) URL: ${value}`); return null;
	}

	const old = sheet.meta, meta = sheet.meta = { }; for (let [ key, value, ] of Object.entries(old)) { try { switch (key) {
		case 'title': { testType('string', key, value) && (meta.name = value); } break;
		case 'licence': { testType('string', key, value) && (meta.license = value); } break;
		case 'name': case 'namespace': case 'version': case 'license': case 'preprocessor': { testType('string', key, value) && (meta[key] = value); } break;
		case 'author': { if (testType('string', key, value)) {
			const [ , name, email, url, ] = (/^\s*([^]*?)\s*(?:<([^]*?)>)?\s*(?:\(([^]*?)\))?\s*$/).exec(value);
			meta.author = { name, email, url: url ? testUrl('author.url', url) : undefined, };
		} } break;
		case 'homepageURL': case 'supportURL': { testType('string', key, value) && testUrl(key, value) && (meta[key] = value); } break; // TODO: enforce valid URLs
		case 'description': { testType('string', key, value) && (meta.description = renderBlock(value)); } break;

		case 'vars': value = value.map((tokens, index) => {
			const keys = [ 'type', 'name', 'title', ], option = { };
			while (tokens.length && keys.length) {
				if ((/^\s*$/).test(tokens[0])) { tokens.shift(); }
				else { option[keys.shift()] = tryParseJson(tokens.shift()); }
			} if (keys.lengths) { onerror(`To few tokens in var declaration `+ index); return null; }
			let rest = tryParseJson(tokens.join('').trim());
			switch (option.type) {
				case 'text': case 'color': option.default = rest +''; return option;
				case 'checkbox': { option.type = 'bool'; option.on = '1'; option.off = '0'; option.default = rest === '1' ? '1' : '0'; } break;
				case 'dropdown': case 'image': { option.type = 'select';
					if (!testType('string', 'var.'+ option.name +'.options', rest)) { return null; }
					const t = rest.replace(/^\{|\}$/g, '').split(/(?:[\w-]+)(?:[ \t]+)"(.*?)"(?:[ \t]+)(?:"(.*?)"|<<<EOT([^]+?)EOT;)/g).slice(1, -1);
					const o = option.options = [ ]; for (let i = 0; i < t.length; i += 4) {
						o.push({ value: t[i+1] !== undefined ? t[i+1] : t[i+2], label: t[i], });
					} option.default = o.length ? o[0].value : undefined;
				} break;
				case 'select': {
					if (Array.isArray(rest)) { rest = rest.reduce((o, k) => ((o[k] = undefined), o), { }); }
					if (!testType('object', 'var.'+ option.name +'.options', rest)) { return null; }
					const o = option.options = Object.entries(rest).map(([ key, value, ]) => ({
						value: value === undefined ? (/^[^:]*/).exec(key)[0] : value, label: key.replace(/^[^:]*:?/, ''),
					})); option.default = o.length ? o[0].value : undefined;
				} break;
			} return option;
		}).filter(_=>_); key = 'options'; /* falls through */

		case 'include': case 'options': {
			if (!testType('object', key, value)) { break; }
			if (!Array.isArray(value)) { value = Object.entries(value).map(([ name, option, ]) => ((option.name = option.name || name), option)); }
			const options = meta[key] = meta[key] || [ ], isInclude = key === 'include';
			value.forEach((entry, index) => { const option = { }; {
				if (!testType('object', key +'.'+ index, entry)) { return; }
				if (!testType('string', key +'.'+ index +'.name', entry.name)) { return; }
				const name = option.name = entry.name;

				if (!testType('string', key +'.'+ name +'.title', entry.title)) { return; }
				option.title = entry.title;

				if (!entry.type) { entry.type = isInclude ? 'domain' : 'string'; }
				if (!testType('string', key +'.'+ name +'.type', entry.type)) { return; }

				if ('description' in entry) { if (testType('string', key +'.description', entry.description)) {
					option.description = renderBlock(entry.description);
				} }

				if (isInclude) {
					option.maxLength = Infinity;

					switch (entry.type) {
						case 'domain': {
							option.input = { type: 'string', default: 'example.com', };
							option.restrict = { match: { exp: { source: (/^\S*$/).source, }, message: `Domains must not contain whitespaces`, }, unique: '.', };
						} break; // no other types yet
						default: { onerror(`Unexpected include type ${entry.type}`); return; }
					}

					if (typeof entry.default === 'string') { entry.default = [ entry.default, ]; }
					if (!('default' in entry)) { entry.default = [ ]; }
					if (!testType('array', key +'.'+ name +'.default', entry.default)) { return; }
					if (!entry.default.every((value, i) =>
						testType('string', key +'.'+ name +'.default.'+ i, value)
					)) { return; } option.default = [ ];

				} else {

					option.input = { type: entry.type, }; [ 'prefix', 'suffix', ].forEach(fix => {
						if (fix in entry) { if (testType('string', key +'.'+ fix, entry[fix])) { option.input[fix] = renderInline(entry[fix]); } }
					});

					option.default = entry.default; // necessary for single tag syntax, but will be overwritten by open + close tag syntax

					switch (entry.type) {

						case 'text': { option.input.type = 'string'; } break;

						case 'color': /* nothing to do */ break; // TODO: translate CSS colors to hex? (alpha support?)

						case 'bool': case 'boolean': {
							option.input.type = 'boolInt'; let had = false;
							if (('off' in entry) && testType('string', key +'.'+ name +'.off', entry.off)) { option.input.off = entry.off; had = true; }
							if (('on'  in entry) && testType('string', key +'.'+ name +'.on',  entry.on))  { option.input.on  = entry.on;  had = true; }
							if (!had) { onerror(`Boolean option ${name} must specify either 'on' or 'off' as a string`); return; }
						} break;

						case 'integer': case 'number': {
							option.restrict = { type: 'number', match: entry.type === 'integer' && {
								exp: { source: (/^-?\d+$/).source, }, message: 'This value must be an integer', },
							};
							('min' in entry) && (option.restrict.from = +entry.min); ('max' in entry) && (option.restrict.to = +entry.max);
							if (option.input.suffix && rUnit.test(option.input.suffix)) { option.unit = option.input.suffix; }
						} break;

						case 'select': {
							if (!testType('array', key +'.'+ name +'.options', entry.options)) { return; }
							if (!entry.options.every((v, i) => testType('object', key +'.'+ name +'.options['+ i +']', v))) { return; }
							option.input.options = entry.options.map(o => ({
								value: o.value +'', label: o.label +'', disabled: !!o.disabled,
							}));
						} break;

						// custom CSS snippets:

						case 'css-dimension': {
							option.input.type = 'string'; // TODO: use shorter field
							option.restrict = { type: 'string', match: {
								exp:  { source: rDimension.source, },
								message: 'This value must be an CSS dimension as <number><unit>,\n'
								+ 'where unit is e.g. px, %, em, deg, ms, dpi.\nOr a keyword like auto, inherit or unset.',
							}, };
						} break;

						case 'css-selector': case 'css-selector-multi': {
							option.input.type = entry.type === 'css-selector' ? 'string' : 'code';
							option.restrict = { match: {
								exp:  { source: rSelector.source, },
								message: `The value may not be empty, end with a ',', contain unescaped ';', '{' or '}' or end within strings or comments`,
							}, custom: 'balancedBrackets', };
						} break;

						case 'css-value': {
							option.input.type = 'string';
							option.restrict = { match: {
								exp:  { source: rValue.source, },
								message: `The value may not contain unescaped ':', ';', '{' or '}' or end within strings or comments`,
							}, custom: 'balancedBrackets', };
						} break;

						case 'css-declarations': {
							option.input.type = 'code';
							option.restrict = { match: {
								exp:  { source: rDeclarations.source, },
								message: `The value may not contain unescaped '{' or '}' or end within strings or comments`,
							}, custom: 'balancedBrackets', };
						} break;

						default: { onerror(`Unexpected option type ${entry.type}`); return; }
					}
				}

			} options.push(option); });
		} break;
		default: (meta.$others || (meta.$others = { }))[key] = value;
	} } catch (error) { onerror(error); } }

	if (meta.options) {
		const defaults = sheet.getOptions();
		meta.options.forEach(option => { if (option.name in defaults) {
			const value = defaults[option.name];
			option.default = option.unit && value.endsWith(option.unit)
			? value.slice(0, -option.unit.length) : value;
			option.restrict && option.restrict.type === 'number' && (option.default -= 0);
			option.input.type === 'boolInt' && (option.input['off' in option.input ? 'on' : 'off'] = value);
		} });
		meta.options = meta.options.filter(_=>_.default !== undefined);
	}

} return sheet; }

return { normalize, };

}); })(this);
