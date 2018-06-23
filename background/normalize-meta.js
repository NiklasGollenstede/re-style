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


return function normalize(sheet, url) { {
	function onerror(message) { console.error(message, 'in style loaded from', url); }
	function testType(type, key, value) {
		if (type === 'array' && Array.isArray(value)) { return true; }
		if (typeof value !== type || value === null) { onerror(
			`Metadata key ${key} must be a ${type}, but is ${ value ===  null ? null : 'a '+ typeof value }`,
		); return false; } return true;
	}

	const old = sheet.meta, meta = sheet.meta = { }; for (let [ key, value, ] of Object.entries(old)) { try { switch (key) {
		case 'title': { testType('string', key, value) && (meta.name = value); } break;
		case 'licence': { testType('string', key, value) && (meta.license = value); } break;
		case 'name': case 'author': case 'license': { testType('string', key, value) && (meta[key] = value); } break;
		case 'description': { testType('string', key, value) && (meta.description = renderBlock(value)); } break;

		case 'include': case 'options': {
			if (!testType('object', key, value)) { break; }
			if (Array.isArray(value)) { const object = { }; value.forEach(
				(entry, i) => testType('object', key +'.'+ i, entry)
				&& testType('string', key +'.'+ i +'.name', entry.name) && (object[entry.name] = entry)
			); value = object; }
			const options = meta[key] = [ ], isInclude = key === 'include';
			Object.entries(value).forEach(([ name, entry, ]) => { const option = { name, }; {

				if (!testType('object', key +'.'+ name, entry)) { return; }
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
							option.restrict = { match: { exp: (/^\S*$/), message: `Domains must not contain whitespaces`, }, unique: '.', };
						} break; // no other types yet
						default: { onerror(new Error(`Unexpected include type ${entry.type}`)); return; }
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

					switch (entry.type) {

						case 'color': /* nothing to do */ break;

						case 'bool': case 'boolean': {
							option.input.type = 'boolInt';
							if (('off' in entry)) { if (!testType('string', key +'.'+ name +'.off', entry.off)) { return; } option.input.off = entry.off; }
							else if (('on' in entry)) { if (!testType('string', key +'.'+ name +'.on', entry.on)) { return; } option.input.on = entry.on; }
							else { onerror(`Boolean option ${name} must specify either 'on' or 'off'`); return; }
						} break;

						case 'integer': case 'number': {
							option.restrict = { type: 'number', match: entry.type === 'integer' && { exp: (/^-?\d+$/), message: 'This value must be an integer', }, };
							('min' in entry) && (option.restrict.from = +entry.min); ('max' in entry) && (option.restrict.to = +entry.max);
							if (option.input.suffix && rUnit.test(option.input.suffix)) { option.unit = option.input.suffix; }
						} break;

						// custom CSS snippets:

						case 'css-dimension': {
							option.input.type = 'string'; // TODO: use shorter field
							option.restrict = { type: 'string', match: {
								exp: rDimension, message: 'This value must be an CSS dimension as <number><unit>,\n'
								+ 'where unit is e.g. px, %, em, deg, ms, dpi.\nOr a keyword like auto, inherit or unset.',
							}, };
						} break;

						case 'css-selector': case 'css-selector-multi': {
							option.type = entry.type === 'css-selector' ? 'string' : 'code';
							option.restrict = { match: {
								exp: rSelector, message: `The value may not be empty, end with a ',', contain unescaped ';', '{' or '}' or end within strings or comments`,
							}, custom: balancedBrackets, };
						} break;

						case 'css-value': {
							option.input.type = 'string';
							option.restrict = { match: {
								exp: rValue, message: `The value may not contain unescaped ':', ';', '{' or '}' or end within strings or comments`,
							}, custom: balancedBrackets, };
						} break;

						case 'css-declarations': {
							option.input.type = 'code';
							option.restrict = { match: {
								exp: rDeclarations, message: `The value may not contain unescaped '{' or '}' or end within strings or comments`,
							}, custom: balancedBrackets, };
						} break;

						default: { onerror(`Unexpected option type ${entry.type}`); return; }
					}
				}

			} options.push(option); });
		} break;
		// ignore additional properties
	} } catch (error) { onerror(error); } }

	if (meta.options) {
		const defaults = sheet.getOptions();
		meta.options.forEach(option => { if (option.name in defaults) {
			const value = defaults[option.name];
			option.default = option.unit && value.endsWith(option.unit)
			? value.slice(0, -option.unit.length) : value;
			option.restrict && option.restrict.type === 'number' && (option.default -= 0);
			option.input.type === 'boolInt' && (option.input['on' in option.input ? 'off' : 'on'] = value);
		} else { option.name = null; } });
		meta.options = meta.options.filter(_=>_.name);
	}

	function balancedBrackets(string) {
		void string; return; // TODO: import tokenize and skipBlock
	//	const tokens = tokenize(string);
	//	for (let index = 0; index < tokens.length; ++index) { switch (tokens[index]) {
	//		case '(': case '{': case '[': index = skipBlock(tokens, index); break;
	//		case ')': case '}': case ']': throw new Error(`Unexpected closing bracket ${ tokens[index] }`);
	//	} }
	}
} return sheet; };

}); })(this);
