(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/regexpx/': RegExpX,
	'shim!node_modules/yamljs/dist/yaml.min:YAML': YAML,
}) => {

/**
 * Parsed CSS Style `Sheet` for analysis and manipulation.
 * Most noteworthy, it contains an array of `@document` rule `Section`s.
 * @property  {[Section]}  sections   Array of `Section`s representing all `@document` blocks.
 *                                    The first `Section` has no include rules and contains all global code.
 * @property  {namespace}  namespace  The sheets default namespace as it appeared in the code.
 * @property  {object}     meta       File metadata parsed from the `==UserStyle==` comment block.
 *                                    Tries to is infer at least the `.meta.name` if no metadata block is found.
 */
class Sheet {

	/**
	 * Parses a code string into a `Sheet` with `Section`s.
	 * @param  {string}    code      Style sheet source code string.
	 * @param  {function}  .onerror  Function called with (error) when a parsing error occurs.
	 *                               Default behavior is to abort parsing and return with an incomplete list of `.sections`
	 * @return {Sheet}               The parsed `Sheet`.
	 */
	static fromCode(code, options) { return Sheet_fromCode(code, options); }

	/**
	 * Transforms `userstyles.orgs` JSON sheets into plain CSS code.
	 * @param  {string}  json  JSON response from `userstyles.orgs` API.
	 * @return {string}        Converted CSS code.
	 */
	static json2css(json) { return json2css(json); }

	/// creates a sheet from its components
	constructor(meta, sections, namespace) {
		this.meta = meta; this.sections = sections; this.namespace = namespace;
	}

	/// creates a clone of the `Sheet` but sets a different `.sections` Array.
	cloneWithSections(sections) { return new Sheet(this.meta, sections, this.namespace); }

	/**
	 * Casts the `Sheet` (back) into a string. Note that this may not result
	 * in the exact original code. While formatting within blocks can be mostly preserved,
	 * all global code and comments will be placed at the beginning of the file.
	 * @see  `Section.toString`, which is called with `options` to stringify each `Section`.
	 * @param  {boolean}  .namespace  Whether to include the default namespace.
	 * @param  {boolean}  .minify     Whether to collapse or preserve whitespaces.
	 * @param  {Object}   .important  See  `Section.toString`.
	 * @return {string}               Code that, except for `.minify`, `.important` and
	 *                                any modifications made to the `Sheet` should have
	 *                                the same effect as the code originally parsed.
	 */
	toString({ namespace = true, minify = false, } = { }) {
		return (
			namespace && this.namespace ? '@namespace '+ this.namespace +';' : ''
		) + (minify ? '' : '\n\n') + this.sections.map(
			_=>_.toString(arguments[0])
		).join(minify ? '' : '\n\n');
	}

	/// Copies the current values of all options occurring in this `Sheet`s `.sections` to `get`
	/// and replaces them by the values in `set`. Works with { [name]: value, } objects.
	/// If either object is not provided, the read and/or set is skipped. Returns `get`.
	/// Only writes values to `get` that are not defined yet, i.e. always reads the first occurrence of any option.
	swapOptions(get, set) { this.sections.forEach(_=>_.swapOptions(get, set)); return get; } // TODO: skip global section

	/// Gets the currently set / default options as a { [name]: value, } object.
	getOptions() { return this.swapOptions({ }, null); }

	toJSON() { return Object.assign({ }, this); }

	static fromJSON({ meta, sections, namespace, }) {
		return new Sheet(meta, sections, namespace);
	}
}

/**
 * Parsed `@document` block within a `Sheet`. Exported as `Sheet.Section`.
 * All include rules are set as interpreted strings, e.g.
 * a literal `@regexp("a\\b\/c\.d")` would result in a `a\b/c.d` entry in `.regexp`.
 * @property {[{value,as,}]}   urls         `url()` document include rules.
 * @property {[{value,as,}]}   urlPrefixes  `url-prefixe()` document include rules.
 * @property {[{value,as,}]}   domains      `domain()` document include rules.
 * @property {[{value,as,}]}   regexps      `regexp()` document include rules.
 * @property {[{value,as,}]}   dynamic      Dynamically configurable document include rules, like regexps.
 * @property {[int,int]?}      location     For `Section`s directly parsed by `Section.fromCode` this
 *                                          is their location within the original source code string.
 */
class Section {

	/// Constructs a `Sheet` from its components.
	constructor(urls = [ ], urlPrefixes = [ ], domains = [ ], regexps = [ ], tokens = [ ], location = null, dynamic = [ ]) {
		this.urls = urls; this.urlPrefixes = urlPrefixes; this.domains = domains; this.regexps = regexps;
		this.tokens = tokens; this.location = location; this.dynamic = dynamic;
	}

	cloneWithoutIncludes() { return new Section([ ], [ ], [ ], [ ], this.tokens, this.location, [ ]); }

	/// Returns `true` iff the `Section`s code consists of only comments and whitespaces.
	isEmpty() { return !this.tokens.some(_=>!(/^\s*$|^\/\*/).test(_)); }

	/// Copies the current values of all options occurring in this `Section`s `.tokens` to `get`
	/// and replaces them by the values in `set`. Works with { [name]: value, } objects.
	/// If either object is not provided, the read and/or set is skipped. Returns `get`.
	/// Only writes values to `get` that are not defined yet, i.e. always reads the first occurrence of any option.
	swapOptions(get, set) { return Section_swapOptions.call(this, get, set); }

	/// Applies the user set options as a { [name]: value, } object to this `Section`s `.tokens`.
	setOptions(prefs) { return this.swapOptions(null, prefs); }

	/**
	 * Casts the `Section` (back) into a string.
	 * @param  {boolean}  .minify     Whether to collapse or preserve whitespaces.
	 * @param  {Object}   .important  If `true`, appends the string '/*rS* /!important' (without the space)
	 *                                after each declaration that is not already `!important`.
	 *                                This allows to apply sheets without `!important` to
	 *                                be applied with `cssOrigin: 'user'` and still have an effect.
	 *                                The `rS` comment allows to remove the added `!important`s later.
	 * @return {string}               Code that, except for `.minify`, `.important`  and
	 *                                any modifications made to the `Sheet` should have
	 *                                the same effect as the code originally parsed.
	 */
	toString() { return Section_toString.apply(this, arguments); }

	toJSON() { return Object.assign({ }, this); }

	static fromJSON({ urls, urlPrefixes, domains, regexps, tokens, dynamic, }) {
		return new Section(urls, urlPrefixes, domains, regexps, tokens, dynamic);
	}
}
Sheet.Section = Section;

//// start implementation

function Sheet_fromCode(css, { onerror = error => console.warn('CSS parsing error', error), } = { }) {

	// Gets the char offset (within the source) of a token by its index in `tokens`.
	let lastLoc = 0, lastIndex = 0; function locate(index) { // Must be called with increasing indices.
		while (lastIndex < index) { lastLoc += tokens[lastIndex++].length; } return lastLoc;
	}

	const globalTokens = [ ], sections = [ new Section([ ], [ ], [ ], [ ], globalTokens), ];
	const meta = { }, self = new Sheet(meta, sections, '');

	const tokens = tokenize(css || '');
	loop: for (let index = 0; index < tokens.length; ++index) { switch (tokens[index]) {
		case '@namespace': {
			const end = tokens.indexOf(';', index);
			if (end < 0) { onerror(Error(`Missing ; in namespace declaration`)); break loop; }
			const parts = tokens.slice(index + 1, end).filter(_=>!(/^\s*$|^\/\*/).test(_));
			switch (parts.length) {
				case 0: break; // or throw?
				case 1: self.namespace = parts[0]; break;
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
				const { type, string, raw = evalString(string), as, } = match;
				switch (type) {
					case 'url': urls.push({ value: raw, as, }); break;
					case 'url-prefix': urlPrefixes.push({ value: raw, as, }); break;
					case 'domain': domains.push({ value: raw, as, }); break;
					case 'regexp': regexps.push({ value: raw, as, }); break;
					default: onerror(new Error(`Unrecognized @document rule ${ type }`)); return;
				}
			});
			const end = skipBlock(tokens, start);
			sections.push(new Section(urls, urlPrefixes, domains, regexps, tokens.slice(start +1, end), [ locate(start +1), locate(end), ]));
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

	const metaBlock = globalTokens.find(token =>
		(/^\/\*[*!]*\s*==+[Uu]ser-?[Ss]tyle==+\s*?\n/).test(token)
	); if (metaBlock) {
		try { Object.assign(meta, YAML.parse(
			metaBlock.replace(/^.*\n|\s*\*\//g, '').replace(/^ ?\*? ?/gm, '') // strip comment frame
		)); } catch (error) { onerror(error); }
	} else {
		const where = globalTokens.slice(0, 5).concat(sections[1] ? sections[1].tokens.slice(0, 4) : [ ]);
		rsFuzzyTitle.some(exp => where.some(token => {
			if (!(/^\/\*/).test(token)) { return null; }
			const match = exp.exec(token);
			return match && (meta.name = match[1].replace(/ \(?$/, ''));
		}));
	}

	return self;
}

const rsFuzzyTitle = [
	RegExpX('mi')`^  # in any line
		[\ \t]*?\*[\ \t]* (?:  # indention
			  (?:@ \s*)? (?:name|title) (?: [\ \t]* : [\ \t]* | \ {5,} )
			| (?:@ \s*)  (?:name|title) [\ \t]+
		) (.*)
	`,
	RegExpX`^\/\*   # at comment start
		(?:\*{10,}|!)       # comment block or preservable comment
		\s*(?:\*\s*)?       # whitespaces, may wrap to next line
		(\w (?: . (?! \(?   # the entire line, but don't include
			  \ v\d[\d\.]{2}     # version numbers
			| [\d\.\/-]          # or dates
		\)? ) )* \S )
		.* (?:\n|\*\/$)  # end of line or comment
	`,
	RegExpX`^\/\*   # at comment start
		\s* ( \w{3} [\ \w] \w{2} (?: [\w! .+~|–-] (?! \(?   # just something sufficiently wordish, but don't include
			  \ v\d[\d\.]{2}     # version numbers
			| [\d\.\/-]          # or dates
		\)? ) )* )
	`,
];

function json2css(json) {
	return JSON.parse(json).sections.map(({ urls, urlPrefixes, domains, regexps, code, }) => {
		// the urls, urlPrefixes, domains and regexps returned by userstyles.org are escaped so that they could directly be paced in double-quoted strings
		// but e.g. to compare them against actual URLs, their escapes need to be evaluated
		const toObj = s => ({ value: evalString(s), });
		urls = urls.map(toObj); urlPrefixes = urlPrefixes.map(toObj);
		domains = domains.map(toObj); regexps = regexps.map(toObj);

		return Section_toString.call({ urls, urlPrefixes, domains, regexps, tokens: [ code, ], location: null, dynamic: [ ], });
	}).join('\n\n');
}

function Section_toString({ minify = false, important = false, } = { }) {
	let { tokens, } = this;
	important && (tokens = addImportants(tokens));
	minify && (tokens = minifyTokens(tokens));

	if (this.urls.length + this.urlPrefixes.length + this.domains.length + this.regexps.length + this.dynamic.length === 0) { return tokens.join(''); }

	return '@-moz-document'+ (minify ? ' ' : '\n\t') + [
		...this.urls.map(({ value, }) => `url(${ JSON.stringify(value) })`),
		...this.urlPrefixes.map(({ value, }) => `url-prefix(${ JSON.stringify(value) })`),
		...this.domains.map(({ value, }) => `domain(${ JSON.stringify(value) })`),
		...this.regexps.map(({ value, }) => `regexp(${ JSON.stringify(value) })`),
		...this.dynamic.map(({ value, }) => `regexp(${ JSON.stringify(value) })`),
	].join(minify ? ',' : ',\n\t')
	+ (minify ? '' : '\n') +'{'+ tokens.join('') +'}';
}

const rOptionTag = RegExpX`^
	\/\*!?\[\[            # /*[[ or /*![[
		([\!\/])          # ! for opening, / for closing
		([a-zA-Z][\w-]+)  # name
	\]\]\*\/              # ]]*/
$`;
function Section_swapOptions(get, set) {
	// format: /*[[!<name>]]*/<value>/*[[/<name>]]*/
	const { tokens, } = this;
	let start = -1, name = null;
	for (let i = 0, l = tokens.length, token = tokens[i]; i < l; token = tokens[++i]) {
		const match = rOptionTag.exec(token); if (!match) { continue; }
		if (match[1] === '!') {
			start = i; name = match[2];
		} else {
			if (name !== match[2]) { continue; }
			if (get && !(name in get)) {
				get[name] = tokens.slice(start + 1, i).join('');
			}
			if (set && (name in set)) {
				const now = tokenize(set[name]);
				const old = tokens.splice(start + 1, i - start - 1, ...now);
				i += now.length - old.length;
			}
			start = -1; name = null;
		}
	}
	return get;
}

// Splits a CSS code string into atomic parts (as far as this parser is concerned).
// That is: some keywords, comments, strings, whitespace sequences, words
// and other individual symbols (including control characters).
// Especially, this skips everything within comments and strings.
function tokenize(css) {
	const tokens = [ ];
	css.replace(rTokens, token => (tokens.push(token), ''));
	return tokens;
}
const rNonEscape = RegExpX('n')`( # shortest possible sequence that does not end with a backslash
	  [^\\]         # something that's not a backslash
	| \\ [^\\]      # a backslash followed by something that's not, so the backslash is consumed
	| ( \\ \\ )*    # an even number of backslashes
)*?`;
const rUrlRule = RegExpX('n')`
	(?<type> url(-prefix)? | domain | regexp )
	\s* ( \/\* .*? \*\/ \s* )? \( \s* ( \/\* .*? \*\/ \s* )? ( # whitespace/comment + open (
		  ' (?<string> ${rNonEscape} ) '
		| " (?<string> ${rNonEscape} ) "
		| (?<raw> .*? )
	) \s* ( \/\* ( !? as:\ ? (?<as> (chrome|content|web) ) | .*? ) \*\/ \s* )? \)
`;
const rTokens = RegExpX('gns')`
	# TODO: \\ [^] should be a token, probably with highest priority
	  @namespace\b
	| @(-moz-)?document\b
	| ${rUrlRule}
	| [\[\]{}();:] # these would also be matched by 'others' below, but let's be explicit
	| \/\* .*? ( \*\/ | $ ) # comments
	| ' ${rNonEscape} ' | " ${rNonEscape} " # strings
	| !important\b
	| \s+ # whitespaces
	| [\w.,<>*-]+ # words
	| . # others
`;

/// Replaces all sequences of comments and whitespace tokens in a token stream with '' or ' ',
/// depending on the surrounding tokens, so that the joined code retains its CSS meaning.
function minifyTokens(tokens) {
	tokens = tokens.slice();
	// remove comments and collapse surrounding whitespaces
	if (comment(tokens[0])) { tokens[0] = ''; }
	if (comment(tokens[tokens.length - 1])) { tokens[tokens.length - 1] = ''; }
	for (let i = 1, end = tokens.length - 1; i < end; ++i) {
		if (comment(tokens[i])) {
			tokens[i] = '';
			if (blank(tokens[i - 1]) && blank(tokens[i + 1])) {
				tokens[i + 1] = '';
			}
		}
	}
	// replace whitespace sequences by '' or ' ' depending on the next (non-empty) and previous token
	if (blank(tokens[0])) { tokens[0] = ''; }
	if (blank(tokens[tokens.length - 1])) { tokens[tokens.length - 1] = ''; }
	for (let i = 1, end = tokens.length - 1; i < end; ++i) {
		if (blank(tokens[i])) {
			let j = i + 1, next; while ((!(next = tokens[j]) || blank(next)) && j < end) { ++j; }
			if (!tokens[i - 1] || (/[>:;,{}+]$/).test(tokens[i - 1]) || (/^[>!;,(){}+]/).test(next)) {
				tokens[i] = '';
			} else {
				tokens[i] = ' ';
			}
		}
	}
	return tokens.filter(_=>_);
	function blank(token) { return (/^\s/).test(token); }
	function comment(token) { return (/^\/\*/).test(token); }
}

/**
 * Finds the end of a code block. Minds nested blocks.
 * @param  {[token]}  tokens  `tokenize`d code.
 * @param  {number}   index   Index with a opening bracket.
 * @return {index}            The index with the matching closing bracket.
 * @throws {Error}    If a mismatching closing bracket of the wrong type is encountered or the stream ends.
 */
function skipBlock(tokens, index) {
	const done = ({ '(': ')', '{': '}', '[': ']', })[tokens[index]];
	for (++index; index < tokens.length; ++index) { switch (tokens[index]) {
		case done: return index;
		case '(': case '{': case '[': index = skipBlock(tokens, index); break;
		case ')': case '}': case ']': throw new Error(`Unbalanced bracket, expected ${ done } got ${ tokens[index] } at token ${ index }`);
	} }
	throw new Error(`missing closing bracket, expected ${ done } got EOF`);
}

// (Tries to) make all CSS declaration in the code '!important':
// Copies the token stream and adds an '/*rS*/!important' in front of every ';' or '}' token
// that follows a ':' token (close enough), unless the '!important' is already there.
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
			&& out.push('/*rS*/', '!important'); hadColon = false;
		} break;
	} out.push(tokens[index]); }
	return out;
}

// should evaluate (i.e. unescape) a (quoted) CSS string literal into a string value
function evalString(string) {
	// TODO: this ignores all meaningful escapes except `/` (there shouldn't be any, since URLs don't support them either, but still)
	return string.replace(/\\+/g, _ => '\\'.repeat(Math.ceil(_.length / 2)));
}

return Sheet;

}); })(this);
