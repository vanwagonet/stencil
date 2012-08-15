/*! Stencil Template v0.5
 *  Async templating for JavaScript
 * Copyright(c) 2012 Andy VanWagoner
 * MIT licensed **/
(function(scope) {
		// mortar between template chunks
	var MT = '',   NEST = 'include',
		NL = '\n', ECHO = 'print',
		CR = '\r', END  = 'end',

		PARAMS = [ ECHO, NEST, 'context' ].join(),

		ECHO_START  = ECHO + '(',       ECHO_DONE = '\n);',
		STAT_START  = ECHO_START + "'", STAT_DONE = "');",
		SAFE_START  = 'print.safe(',    SAFE_DONE = '\n);',

		NEST_START  = 'include(',         NEST_CONT  = '\n,function(){',
		ASYNC_START = '(function(next){', ASYNC_CONT = '\n})(function(){',
		ASYNC_DONE  = '})',               CALL_END   = 'print.end()',

		// find & properly encode quotes & newlines
		QUOTE_RE    = /([^\\])?'/g, QUOTE_ESCAPED = "$1\\'",
		NEWLINE_RE  = /(\r?\n)/g, NEWLINE_ESCAPED = '\\n',

		// make data members "global"
		CONTEXT_START = 'with(context){', CONTEXT_END = '}';


	/** Loads the template asynchronously, and then fires a callback
	 * with the error, if any, and the compiled function. **/
	function stencil(o, vars, data, end) {
		var id = typeof o === 'string' ? o : o && o.id, result;
		if (id && stencil.cache[id]) return stencil.cache[id](vars, data, end);
		stencil.compile(o, function(err, fn) {
			if (err) return (end || data)(err);
			result = (stencil.cache[id] = fn)(vars, data, end);
		});
		return result; // just in case is was synchronous.
	}

	stencil.cache = {}; // cache each template's function


	/** Loads the template, and then fires a callback with the error, if any,
	 * and the compiled function. **/
	stencil.compile = function(o, next) {
		o = stencil.options(o);
		stencil.fetch(o, function(err, text) {
			if (err) return next(err);
			var fn = compile(text, o);
			try {
				fn = wrap(new Function(PARAMS, fn), o);
				stencil.cache[o.id] = fn;
				next(null, fn);
			} catch (err) { next(err); }
		});
	};


	/** merges the defaults into the object provided */
	stencil.options = function(o) {
		if (typeof o === 'string') o = { id:o };
		o = o || {};
		var opt, defs = stencil.defaults;
		for (opt in defs) { o[opt] = o[opt] || defs[opt]; }
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
		parse: null  /* A reference to parse-js or uglify-js's parser, used to kill the with statement */
	};


	/** Loads the identified template **/
	if (scope.document && scope.XMLHttpRequest) { // browser
		stencil.fetch = function(o, next) {
			var text;
			if (text = document.getElementById(o.id)) { // get text from dom id
				text = (text.value || text.innerHTML)
					.replace(/^\s*<!\[CDATA\[\r?\n?|\r?\n?\]\]>\s*$/g, MT);
				next(null, text); return text; // always synchronous
			}

			text = new XMLHttpRequest(); // get input from url, only basic support.
			text.onload = function() {
				if (text.status >= 200 && text.status < 300) {
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
	function compile(src, opts) {
		var s, i = 0, n = 0, // start, end, nested template count
			fn = opts.parse ? MT : CONTEXT_START, // resulting script
			// cache vars used in loop
			start = opts.start, startl = start.length,
			stopt = opts.stop,  stopl  = stopt.length,
			echot = opts.echo,  echol  = echot.length,
			safet = opts.safe,  safel  = safet.length,
			nest  = opts.nest,  nestl  = nest.length,
			async = opts.async, asyncl = async.length;

		while (i >= 0) {
			// encode static chunk
			s = i; i = src.indexOf(start, i);
			if (s !== i) {
				fn += STAT_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i))
					.replace(QUOTE_RE, QUOTE_ESCAPED)
					.replace(NEWLINE_RE, NEWLINE_ESCAPED);
				fn += STAT_DONE;
			}

			// check for next chunk
			if (i < 0) { break; }

			// wrap javascript chunk
			s = (i += startl); i = src.indexOf(stopt, s);
			if (src.substr(s, safel) === safet) {
				// safe echo chunk
				s  += echol;
				fn += SAFE_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += SAFE_DONE;
			} else if (src.substr(s, echol) === echot) {
				// echo chunk
				s  += echol;
				fn += ECHO_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += ECHO_DONE;
			} else if (src.substr(s, nestl) === nest) {
				// nest template chunk
				s  += nestl; ++n;
				fn += NEST_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += NEST_CONT;
			} else if (src.substr(s, asyncl) === async) {
				// async funciton call chunk
				s  += asyncl; ++n;
				fn += ASYNC_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += ASYNC_CONT;
			} else {
				// regular code chunk
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += NL;
			}
			if (i >= 0) {
				i += stopl;
				// skip newline directly following close tag
				if (src.charAt(i) === CR) { ++i; }
				if (src.charAt(i) === NL) { ++i; }
			}
		}

		// callback to indicate completion
		fn += CALL_END;

		// close async template callbacks
		while (n--) { fn += ASYNC_DONE; }

		if (opts.parse) {
			fn = without(opts, fn);
		} else {
			fn += CONTEXT_END;
		}
		console.log(fn);

		return fn;
	}


	/** @private Uses parse-js to compile a version of the template that avoids the 'with' statement. */
	function without(opts, fn) {
		var names = {}, declare = [], name,
			whitelist = [ 'print', 'include', 'context', 'next' ];
		(function findnames(ast) {
			if (!ast) return;
			if ('name' === ast[0]) return names[ast[1]] = true;
			if ('object' === typeof ast) {
				for (var i = 0; i < ast.length; ++i) {
					findnames(ast[i]);
				}
			}
		})(opts.parse(fn));
		for (name in names) {
			if (~whitelist.indexOf(name)) continue;
			declare.push(name + '=context.' + name + '||this.' + name);
		}
		fn = 'var ' + declare.join() + ';\n' + fn;
		return fn;
	};


	/** @private wrap the compiled function to make sure env is set up properly. **/
	function wrap(fn, opts) {
		function template(vars, data, end) {
			if (!end) { end = data; data = null; }
			if (!end) { end = function(err) { if (err) throw err; }; }

			var result = MT, join = Array.prototype.join;

			function print() {
				var text = join.call(arguments, MT);
				result += text;
				if (data && text) data(text);
			}

			print.safe = function() {
				var text = join.call(arguments, MT).replace(/&/g, '&amp;')
					.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
					.replace(/</g, '&lt;').replace(/>/g, '&gt;');
				result += text;
				if (data && text) data(text);
			};

			print.end = function(err) { end(err, result); };

			function include(o, v, next) {
				if (typeof o === 'string') o = { id:o };
				if (!next) { next = v; v = {}; }

				var subopts = function(){}, i;
				subopts.prototype = opts;
				subopts = new subopts();
				for (i in o) { subopts[i] = o[i]; }

				var subvars = function(){};
				subvars.prototype = vars;
				subvars = new subvars();
				for (i in v) { subvars[i] = v[i]; }

				stencil(subopts, subvars, print, function(err) {
					return err ? end(err, result) : next();
				});
			}

			fn(print, include, vars || {});

			return result; // just in case is was synchronous.
		}
		template.inner = fn;
		return template;
	}


	// export the stencil function
	if (typeof exports !== 'undefined') {
		if (typeof module !== 'undefined' && module.exports) {
			exports = module.exports = stencil;
		}
		exports.stencil = stencil;
	} else {
		scope.stencil = stencil;
	}
})(this);

