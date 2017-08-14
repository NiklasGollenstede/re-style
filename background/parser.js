(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/regexpx/': RegExpX,
}) => {

function parseStyle(css, { minify = true, } = { }) {
	const tokens = tokenize(css);

	let namespace = '';
	const declarations = [ ];
	const sections = [ ];
	let globalCode = '';

	for (let index = 0; index < tokens.length; ++index) { switch (tokens[index]) {
		case '@namespace': {
			const end = tokens.indexOf(';', index);
			if (end < 0) { throw new Error(`Missing ; in namespace declaration`); }
			const parts = tokens.slice(index + 1, end).filter(_=>!(/^\s*$/).test(_));
			index += parts.length + 2;
			switch (parts.length) {
				case 0: break; // or throw?
				case 1: namespace = parts; break;
				default: declarations.push('@namespace '+ parts.join(' ') +';');
			}
		} break;
		case '@document': case '@-moz-document': {
			const start = tokens.indexOf('{', index);
			if (start < 0) { throw new Error(`Missing block after @document declaration`); }
			const parts = tokens.slice(index +1, start).filter(_=>!(/^\s*$|^,$|^\/\*/).test(_));
			const patterns = parts.map(decl => {
				const match = rUrlRule.exec(decl);
				if (!match) { throw new Error(`Can't parse @document rule \`\`\`${ decl }´´´`); }
				const { type, string, raw = string.replace(/\\+/g, _ => '\\'.repeat(Math.floor(_.length / 2))), } = match;
				switch (type) {
					case 'url': return RegExpX`^${ raw }$`;
					case 'url-prefix': return RegExpX`^${ raw }.*$`;
					case 'domain': return RegExpX`^https?://(?:[^/]*.)?${ raw }(?:$|/.*)$`;
					case 'regexp': return RegExpX`^${ new RegExp(raw) }$`;
					default: throw new Error(`Unrecognized @document rule ${ type }`);
				}
			});
			const end = skipBlock(tokens, start);
			const code = finalizeCode(tokens.slice(start +1, end));
			sections.push({ patterns, code, });
			index = end +1;
		} break;
		case '{': case '(': {
			const closing = skipBlock(tokens, index);
			globalCode += finalizeCode(tokens.slice(index +1, closing));
			index = closing + 1;
		} break;
		default: {
			globalCode += finalizeCode([ tokens[index], ]);
		}
	} }

	const prefix = (namespace ? '@namespace '+ namespace +';' : '') + declarations.join('');
	minify && (globalCode = globalCode.replace(/\s+/, ' '));
	globalCode = (/^\s*$/).test(globalCode) ? '' : prefix + globalCode;
	sections.forEach(_ => (_.code = prefix + _.code));

	return {
		namespace,
		declarations,
		sections,
		globalCode,
	};

	function finalizeCode(tokens) {
		minify && (tokens = tokens.filter(_=>!(/^\/\*/).test(_)));
		const code = tokens.join('');
		return minify ? stripWhitespace(code) : code;
	}
}

const rNonEscape = RegExpX`(?:
	  [^\\]         # something that's not a backslash
	| \\ [^\\]      # a backslash followed by something that's not, so the backslash is consumed
	| (?: \\\\ )*   # an even number of backslashes
)*?`;
const rUrlRule = RegExpX`
	(?<type> url(?:-prefix)?|domain|regexp ) \s* \( (?:
		  ' (?<string> ${ rNonEscape }) '
		| " (?<string> ${ rNonEscape }) "
		| (?<raw> .*? )
	) \)
`;
const rTokens = RegExpX('gs')`
	  @namespace
	| @(?:-moz-)document
	| ${ rUrlRule }
	| [{}();]
	| \/\* .*? (?: \*\/ | $ ) # comments
	| ' ${ rNonEscape } ' | " ${ rNonEscape } " # strings
	| \s+ # whitespaces
	| [\w-]+ # words
	| . # others
`;
function tokenize(css) {
	const tokens = [ ];
	css.replace(rTokens, token => (tokens.push(token), ''));
	return tokens;
}

function stripWhitespace(css) {
	return css
	.replace(/(^|\S)\s+/g, (_, prefix) => prefix + ((/[:;,.{}+\-*]/).test(prefix) ? '' : ' '))
	.replace(/\s+(\S|$)/g, (_, suffix) => ((/[;,(){}+\-*]/).test(suffix) ? '' : ' ') + suffix);
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

return {
	parseStyle,
};

}); })(this);
