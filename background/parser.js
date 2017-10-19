(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/regexpx/': RegExpX,
}) => {

function parseStyle(css, { onerror = error => console.warn('CSS parsing error', error), } = { }) {
	const tokens = tokenize(css);
	let lastPos = 0, lastIndex = 0; const pos = index => {
		while (lastIndex < index) { lastPos += tokens[lastIndex++].length; } return lastPos;
	};

	let namespace = '', meta = { };
	const sections = [ ], globalTokens = [ ];

	loop: for (let index = 0; index < tokens.length; ++index) { switch (tokens[index]) {
		case '@namespace': {
			const end = tokens.indexOf(';', index);
			if (end < 0) { onerror(Error(`Missing ; in namespace declaration`)); break loop; }
			const parts = tokens.slice(index + 1, end).filter(_=>!(/^\s*$|^\/\*/).test(_));
			switch (parts.length) {
				case 0: break; // or throw?
				case 1: namespace = parts[0]; break;
				default: globalTokens.push('@namespace', ...tokens.slice(index + 1, end), ';');
			}
			index = end +1;
		} break;
		case '@document': case '@-moz-document': {
			const start = tokens.indexOf('{', index);
			if (start < 0) { onerror(new Error(`Missing block after @document declaration`)); break loop; }
			const parts = tokens.slice(index +1, start).filter(_=>!(/^\s*$|^,$|^\/\*/).test(_));
			const urls = [ ], urlPrefixes = [ ], domains = [ ], regexps = [ ];
			parts.forEach(decl => {
				const match = rUrlRule.exec(decl);
				if (!match) { onerror(Error(`Can't parse @document rule \`\`\`${ decl }´´´`)); return; }
				const { type, string, raw = evalString(string), } = match;
				switch (type) {
					case 'url': urls.push(raw); break;
					case 'url-prefix': urlPrefixes.push(raw); break;
					case 'domain': domains.push(raw); break;
					case 'regexp': regexps.push(raw); break;
					default: onerror(new Error(`Unrecognized @document rule ${ type }`)); return;
				}
			});
			const end = skipBlock(tokens, start);
			sections.push(new Section(urls, urlPrefixes, domains, regexps, '', tokens.slice(start +1, end), [ pos(start +1), pos(end), ]));
			index = end +1;
		} break;
		case '{': case '(': {
			const closing = skipBlock(tokens, index);
			globalTokens.push(tokens[index]);
			globalTokens.push.apply(globalTokens, tokens.slice(index +1, closing));
			globalTokens.push(tokens[closing]);
			index = closing;
		} break;
		default: {
			globalTokens.push(tokens[index]);
		}
	} }

	globalTokens.length && sections.unshift(new Section([ ], [ ], [ ], [ ], '', globalTokens));


	if ((/^\/\*\*? ?==[Uu]ser-?[Ss]tyle==\s/).test(tokens[0])) {
		meta = parseMetaBlock(tokens[0]);
	} else {
		let name; globalTokens.some(token => (/^\/\*/).test(token) && (/^\ ?\*\ ?@name\ (.*)/m).test(token) && (name = (/^\ ?\*\ ?@name\ (.*)/m).exec(token)[1]));
		name && (meta.name = name);
	}

	return new Sheet(meta, sections, namespace);
}

class Sheet {
	static fromCode(code, options) { return parseStyle(code, options); }

	constructor(meta, sections, namespace) {
		this.meta = meta;
		this.sections = sections;
		this.namespace = namespace;
	}

	cloneWithSections(sections) { return new Sheet(this.meta, sections, this.namespace); }

	static fromUserstylesOrg({ sections, name, namespace = '', }) {
		sections = sections.map(({ urls, urlPrefixes, domains, regexps, code, }) => {
			// the urls, urlPrefixes, domains and regexps returned by userstyles.org are escaped so that they could directly be paced in double-quoted strings
			// but e.g. to compare them against actual URLs, their escapes need to be evaluated
			urls = urls.map(evalString); urlPrefixes = urlPrefixes.map(evalString);
			domains = domains.map(evalString); regexps = regexps.map(evalString);

			if (urls.length + urlPrefixes.length + domains.length + regexps.lenght === 0) {
				return new Section(urls, urlPrefixes, domains, regexps, code);
			} else {
				const tokens = tokenize(code);
				for (let index = 0; index < tokens.length; ++index) {
					if (tokens[index] !== '@namespace') { continue; }
					const end = tokens.indexOf(';', index);
					if (index < 0) { break; }
					const parts = tokens.slice(index + 1, end).filter(_=>!(/^\s*$|^\/\*/).test(_));
					if (parts.length === 1) { namespace = parts[0]; }
				}
				return new Section(urls, urlPrefixes, domains, regexps, '', tokens);
			}
		});
		return new Sheet({ name, }, sections, namespace);
	}

	toString({ namespace = true, minify = false, /*important = false,*/ } = { }) {
		return (
			namespace && this.namespace ? '@namespace '+ this.namespace +';' : ''
		) + this.sections.map(
			_=>_.toString(arguments[0])
		).join(minify ? '' : '\n\n');
	}

	toJSON() { return this; }

	static fromJSON({ meta, sections, namespace, }) {
		return new Sheet(meta, sections, namespace);
	}
}

class Section {
	constructor(urls, urlPrefixes, domains, regexps, code, tokens = null, location = null) {
		this.urls = urls; this.urlPrefixes = urlPrefixes; this.domains = domains; this.regexps = regexps;
		this.code = code; this.tokens = tokens; this.location = location;
	}

	cloneWithoutIncludes() { return new Section([ ], [ ], [ ], [ ], this.code, this.tokens); }

	isEmpty() {
		!this.tokens && (this.tokens = tokenize(this.code));
		return !this.tokens.some(_=>!(/^\s*$|^\/\*/).test(_));
	}

	toString({ minify = false, important = false, } = { }) {
		let { tokens, code, } = this;
		important && !tokens && (tokens = this.tokens = tokenize(code));
		minify && tokens && (tokens = minifyTokens(this.tokens.slice()).filter(_=>_));
		important && (tokens = addImportants(tokens));
		minify && !tokens && (code = code.replace(/\s+/g, ' '));
		tokens && (code = tokens.join(''));

		if (this.urls.length + this.urlPrefixes.length + this.domains.length + this.regexps.length === 0) { return code; }

		return '@-moz-document'+ (minify ? ' ' : '\n\t') + [
			...this.urls.map(raw => `url(${JSON.stringify(raw)})`),
			...this.urlPrefixes.map(raw => `url-prefix(${JSON.stringify(raw)})`),
			...this.domains.map(raw => `domain(${JSON.stringify(raw)})`),
			...this.regexps.map(raw => `regexp(${JSON.stringify(raw)})`),
		].join(minify ? ',' : ',\n\t')
		+ (minify ? '' : '\n') +'{'+ code +'}';
	}

	toJSON() { return this; }

	static fromJSON({ urls, urlPrefixes, domains, regexps, code, tokens, }) {
		return new Section(urls, urlPrefixes, domains, regexps, code, tokens);
	}
}

function tokenize(css) {
	const tokens = [ ];
	css.replace(rTokens, token => (tokens.push(token), ''));
	return tokens;
}
const rNonEscape = RegExpX('n')`(
	  [^\\]         # something that's not a backslash
	| \\ [^\\]      # a backslash followed by something that's not, so the backslash is consumed
	| ( \\\\ )*     # an even number of backslashes
)*?`;
const rUrlRule = RegExpX('n')`
	(?<type> url(-prefix)?|domain|regexp ) \s* \( \s* (
		  ' (?<string> ${ rNonEscape }) '
		| " (?<string> ${ rNonEscape }) "
		| (?<raw> .*? )
	) \s* \)
`;
const rTokens = RegExpX('gns')`
	  @namespace\b
	| @(-moz-)?document\b
	| ${ rUrlRule }
	| [{}();]
	| \/\* .*? ( \*\/ | $ ) # comments
	| ' ${ rNonEscape } ' | " ${ rNonEscape } " # strings
	| !important\b
	| \s+ # whitespaces
	| [\w-]+ # words
	| . # others
`;

function minifyTokens(input) {
	if (comment(input[0])) { input[0] = ''; }
	if (comment(input[input.length - 1])) { input[input.length - 1] = ''; }
	for (let i = 1, end = input.length - 1; i < end; ++i) {
		if (comment(input[i])) {
			input[i] = '';
			if (blank(input[i - 1]) && blank(input[i + 1])) {
				input[i + 1] = '';
			}
		}
	}
	if (blank(input[0])) { input[0] = ''; }
	if (blank(input[input.length - 1])) { input[input.length - 1] = ''; }
	for (let i = 1, end = input.length - 1; i < end; ++i) {
		if (blank(input[i])) {
			let j = i + 1, next; while ((!(next = input[j]) || blank(next)) && j < end) { ++j; }
			if (!input[i - 1] || (/[>:;,{}+]$/).test(input[i - 1]) || (/^[>!;,(){}+]/).test(next)) {
				input[i] = '';
			} else {
				input[i] = ' ';
			}
		}
	}
	return input;
	function blank(token) { return (/^\s/).test(token); }
	function comment(token) { return (/^\/\*/).test(token); }
}

function skipBlock(tokens, index) {
	const done = ({ '(': ')', '{': '}', '[': ']', })[tokens[index]];
	for (++index; index < tokens.length; ++index) { switch (tokens[index]) {
		case done: return index;
		case '(': case '{': case '[': index = skipBlock(tokens, index); break;
		case ')': case '}': case ']': throw new Error(`Unbalanced bracket, expected ${ done } got ${ tokens[index] } at token ${ index }`);
	} }
	throw new Error(`missing closing bracket, expected ${ done } got EOF`);
}

function addImportants(tokens) {
	const out = [ ];
	let hadColon = false;
	for (let index = 0; index < tokens.length; ++index) { switch (tokens[index]) {
		case ':': {
			const word = tokens[((/\s+/).test(tokens[index - 1]) ? index - 2 : index - 1)];
			hadColon = !!word;
			// hadColon = word && !word.startsWith('--'); // !important is not allowed after variable definitions
		} break;
		case '{': hadColon = false; break;
		case '(': {
			const end = skipBlock(tokens, index);
			out.push(...tokens.slice(index, index = end));
		} break;
		case '}': case ';': {
			hadColon && tokens[((/\s+/).test(tokens[index - 1]) ? index - 2 : index - 1)] !== '!important'
			&& out.push('/*rS*/!important'); hadColon = false;
		} break;
	} out.push(tokens[index]); }
	return out;
}

function evalString(string) {
	// TODO: this ignores all meaningful escapes except `/` (there shouldn't be any, since URLs don't support them either, but still)
	return string.replace(/\\+/g, _ => '\\'.repeat(Math.ceil(_.length / 2)));
}

function parseMetaBlock(block) {
	const entries = block.slice(0, -2).split(/^\ ?\*\ ?@(?=\w)/gm).slice(1);
	const meta = { };
	for (const entry of entries) {
		const name = (/^\w+/).exec(entry)[0];
		switch (name) {
			case 'name': case 'author': case 'license': case 'licence': {
				meta[name === 'licence' ? 'license' : name] = (/^\ ?.*/).exec(entry.slice(name.length))[0].trim();
			} break;
			case 'description': {
				meta.description = entry.slice(name.length).replace(/^\ ?\*?\ {0,5}/gm, '').trim();
			} break;
			case 'include': {
				const includes = meta.include = meta.include || [ ];
				const lines = entry.slice(name.length).split('\n').map(_=>_.replace(/^\s*(?:\*\s*)?|\s*$/g, '')).filter(_=>_);
				const rule = { name: '', type: 'domain', default: [ ], description: '', };
				for (const line of lines) {
					const key = (/^\w+/).exec(line)[0], value = line.slice(key.length).trim();
					switch (key) {
						case 'name': case 'type': case 'description': rule[key] = value; break;
						case 'default': rule.default = value.split(/\s+/g);
					}
				}
				if (!rule.name) { console.error(`ignoring @include rule without name:`, block); }
				rule.description = rule.description || rule.name;
				includes.push(rule);
			}
		}
	}
	return meta;
}

Sheet.Section = Section;
return Sheet;

}); })(this);
