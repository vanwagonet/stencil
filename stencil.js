/*! Stencil Template v0.6.2
 *  Async templating for JavaScript
 * Copyright(c) 2012 Andy VanWagoner
 * MIT licensed **/
(function(scope) {
		// mortar between template chunks
	var MT = '',   NEST = 'include', SAFE = 'escape',
		NL = '\n', ECHO = 'print',   DATA = 'context',
		CR = '\r', NEXT = 'next',    ASYNC = 'async',

		PARAMS = [ DATA, ECHO, SAFE, NEXT ].join(),

		ECHO_START = ',',  ECHO_DONE = ',',
		SAFE_START = ',' + SAFE + '(',  SAFE_DONE = '),',
		CODE_START = ');', CODE_DONE = ';' + ECHO + '(',

		NEST_START  = ');' + ECHO + '.' + NEST + '(',
		NEST_DONE   = ');' + ECHO + '(',
		ASYNC_START = ');' + ECHO + '.' + ASYNC + '(function(){',
		ASYNC_DONE  = '});' + ECHO + '(',
		EXTRA = '""',  CALL_NEXT = NEXT + '()',

		TAB_RE     = /\\t/g,          TAB_ESCAPED     = '\t', // use real tabs instead of escaped
		NEWLINE_RE = /((\\r)?\\n)/g,  NEWLINE_ESCAPED = '$1",\n"', // properly encode newlines
		COMMENT_RE = /\/\/(.*)$/,     COMMENT_ESCAPED = '/*$1*/', // keep // comments from breaking result
		TRAIL_RE   = /[;,](\s*)$/,    TRAIL_ESCAPED   = '$1', // fix trailing commas and semicolons

		// make data members "global"
		DATA_START = 'with(' + DATA + '){', DATA_END = '}';


	/** Loads the template asynchronously, and then fires a callback
	 * with the error, if any, and the compiled function. **/
	function stencil(o, vars, data, end) {
		var id = ('string' === typeof o) ? o : o && o.id, result;
		if (id && stencil.cache[id]) return stencil.cache[id](vars, data, end);
		stencil.compile(o, function(err, fn) {
			if (err) return (end || data)(err);
			result = fn(vars, data, end);
		});
		return result; // just in case is was synchronous.
	}

	stencil.cache = {}; // cache resulting functions


	/** Loads the template, and then fires a callback with the error, if any,
	 * and the compiled function. **/
	stencil.compile = function(o, next, string) {
		(o.fetch || stencil.fetch)(o, function(err, text) {
			if (err) return next(err);
			try {
				var fn = translate(text, o);
				if (string) {
					fn = 'function(' + PARAMS + '){' + fn + '}';
				} else {
					fn += '\n//@ sourceURL=' + o.id;
					fn = stencil.prepare(new Function(PARAMS, fn), o);
				}
				next(null, fn);
			} catch (err) { next(err); }
		});
	};


	/** merges the defaults into the object provided */
	stencil.options = function(o, defs) {
		if ('string' === typeof o) o = { id:o };
		o = o || {}; defs = defs || stencil.defaults;
		for (var opt in defs) { o[opt] = o[opt] || defs[opt]; }
		return o;
	};


	/** default options */
	stencil.defaults = {
		id:    null, /* Identifier for the template (filename, or dom id) */
		start: '<?', /* Start tag in the template */
		stop:  '?>', /* Stop tag in the template */
		echo:  '-',  /* Suffix for echoing result of the expression */
		safe:  '=',  /* Suffix for echoing result of the expression html encoded */
		nest:  '#',  /* Suffix for including the template identified by the result of the expression */
		async: '!',  /* Suffix for async blocks, after which any execution is paused, and only resumed by calling output.resume() */
		sync_include: false, /* If true, nested templates will be fetched and rendered synchronously */
		parse: null, /* A reference to parse-js or uglify-js's parser, used to kill the with statement */
		fetch: null  /* A function that retrieves the template text. function(options, next(err, text))  */
	};


	/** Loads the identified template **/
	if (scope.document && scope.XMLHttpRequest) { // browser
		stencil.fetch = function(o, next) {
			var text;
			if (text = document.getElementById(o.id)) { // get text from dom id
				text = (text.value || text.innerHTML)
					.replace(/^\s*<!\[CDATA\[\s*\r?\n?|\r?\n?\s*\]\]>\s*$/g, MT);
				next(null, text); return text; // always synchronous
			}

			text = new XMLHttpRequest(); // get input from url, only basic support.
			text.onload = function() {
				if (200 <= text.status && 300 > text.status) {
					next(null, text = text.responseText);
				} else { text.onerror(); }
			};
			text.onerror = function() { next(new Error('Could not find template '+o.id)); }
			text.open('GET', o.id, !o.sync_include);
			text.send();
			return text; // if successful sync request, will be the text, otherwise the xhr object
		};
	} else { // assume node-like environment
		stencil.fetch = function(o, next) {
			var fs = require('fs'), text;
			if (o.sync_include) {
				text = fs.readFileSync(o.id, o.charset || 'utf-8');
				next(null, text); return text;
			} else {
				fs.readFile(o.id, o.charset || 'utf-8', next);
			}
		};
	}


	/** @private convert template text to javascript code **/
	function translate(src, opts) {
		opts = stencil.options(opts);
		var s, i = 0, code, pre, post, // start index, end index, ...
			fn = opts.parse ? MT : DATA_START, // resulting script
			// cache vars used in loop
			start = opts.start, startl = start.length,
			stopt = opts.stop,  stopl  = stopt.length,
			echot = opts.echo,  echol  = echot.length,
			safet = opts.safe,  safel  = safet.length,
			nest  = opts.nest,  nestl  = nest.length,
			async = opts.async, asyncl = async.length;

		fn += CODE_DONE;

		while (i >= 0) {
			// encode static chunk
			s = i; i = src.indexOf(start, i);
			if (s !== i) {
				fn += JSON.stringify(i < 0 ? src.substr(s) : src.substring(s, i))
					.replace(TAB_RE, TAB_ESCAPED)
					.replace(NEWLINE_RE, NEWLINE_ESCAPED);
			}

			// check for next chunk
			if (i < 0) { break; }

			// wrap javascript chunk
			s = (i += startl); i = src.indexOf(stopt, s);
			if (src.substr(s, safel) === safet) { // safe echo chunk
				s  += safel; pre = SAFE_START; post = SAFE_DONE;
			} else if (src.substr(s, echol) === echot) { // echo chunk
				s  += echol; pre = ECHO_START; post = ECHO_DONE;
			} else if (src.substr(s, nestl) === nest) { // nest template chunk
				s  += nestl; pre = NEST_START; post = NEST_DONE;
			} else if (src.substr(s, asyncl) === async) { // async funciton call chunk
				s  += asyncl; pre = ASYNC_START; post = ASYNC_DONE;
			} else { // regular code chunk
				pre = CODE_START; post = CODE_DONE;
			}
			code = (i < 0 ? src.substr(s) : src.substring(s, i))
				.replace(COMMENT_RE, COMMENT_ESCAPED).replace(TRAIL_RE, TRAIL_ESCAPED);
			fn += pre + code + post;
			if (i >= 0) {
				i += stopl;
				// skip newline directly following close tag
				if (src.charAt(i) === CR) { ++i; fn += CR; }
				if (src.charAt(i) === NL) { ++i; fn += NL; }
			} else {
				fn += EXTRA;
			}
		}

		// callback to indicate completion
		fn += CODE_START + CALL_NEXT;

		if (opts.parse) {
			fn = without(opts, fn);
		} else {
			fn += DATA_END;
		}

		return fn;
	}


	/** @private Uses parse-js to compile a version of the template that avoids the 'with' statement. */
	function without(opts, fn) {
		opts = stencil.options(opts);
		var names = {}, declare = [], name, ast,
			whitelist = [ ECHO, SAFE, DATA, NEXT ];

		try { ast = opts.parse(fn); }
		catch (err) { return DATA_START + fn + DATA_END; }

		(function findnames(ast) {
			if (!ast) return;
			if ('name' === ast[0]) return names[ast[1]] = true;
			if ('object' === typeof ast) {
				for (var i = 0; i < ast.length; ++i) {
					findnames(ast[i]);
				}
			}
		})(ast);
		for (name in names) {
			if (~whitelist.indexOf(name)) continue;
			declare.push(name + '=context.' + name + '||this.' + name);
		}
		if (declare.length) { fn = 'var ' + declare.join() + ';' + fn; }
		return fn;
	};


	/** wrap the compiled function to make sure env is set up properly. **/
	stencil.prepare = function(fn, opts) {
		opts = stencil.options(opts);
		function template(vars, data, end) {
			if (!end) { end = data; data = null; }
			if (!end) { end = function(err) { if (err) throw err; }; }

			function print() {
				var text = Array.prototype.join.call(arguments, MT),
					last = print.q[print.q.length - 1];
				if (fn !== last && fn === print.q[0]) {
					last.buffer += text;
				} else {
					print.result += text;
					if (data && text) data(text);
				}
			}

			function encode() {
				return Array.prototype.join.call(arguments, MT)
					.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
					.replace(/</g, '&lt;').replace(/>/g, '&gt;')
					.replace(/&/g, '&amp;');
			};

			print[NEST] = function(o, v) {
				print[ASYNC](function() {
					o = stencil.options(o, opts);
					v = stencil.options(v, vars);
					stencil(o, v, print, function(err) {
						return err ? end(err, result) : next();
					});
				});
			};

			print[ASYNC] = function(async) {
				async.buffer = MT;
				async.index = print.q[print.q.length - 1].index + 1;
				print.q.push(async);
			};

			function next(err) {
				if (err) return end(err);
				var first = print.q.shift();
				if (first.buffer) {
					print.result += first.buffer;
					if (data) data(first.buffer);
				}
				if (print.q.length) { print.q[0](); }
				else { end(null, print.result); }
			};

			print.result = MT;
			print.q = [ fn ];

			fn(vars || {}, print, encode, next);

			return print.result; // just in case is was synchronous.
		}
		template.inner = fn;
		return stencil.cache[opts.id] = template;
	};


	// export the stencil function
	if ('undefined' !== typeof exports) {
		if ('undefined' !== typeof module && module.exports) {
			exports = module.exports = stencil;
		}
		exports.stencil = stencil;
	} else {
		scope.stencil = stencil;
	}
})(this);

