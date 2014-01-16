/*! Stencil Template v0.8.4
 *  Async templating for JavaScript
 * Copyright(c) 2012 Andy VanWagoner
 * MIT licensed **/
(function(global) {
	"use strict";

	function stencil(o, vars, end) {
		var result = stencil.compile(o);
		if (arguments.length > 1) { result = result(vars, end); }
		return result;
	}

	stencil.compile = function(o, string) {
		var k, fn, d = stencil.defaults, params;
		o = ('string' === typeof o) ? { src:o } : o || {};
		if (!string && stencil.cache[o.id]) { return stencil.cache[o.id]; }
		for (k in d) { if (!(k in o)) { o[k] = d[k]; } }
		fn = translate(o); params = o.noevents ? o.dataVar : [ o.dataVar, o.chunkVar, o.doneVar ];
		if (string) { return 'function(' + params + '){' + fn + '}'; }
		fn = new Function(params, fn + (o.uri ? '\n//# sourceURL=' + o.uri : ''));
		if (o.id) { stencil.cache[o.id] = fn; }
		return fn;
	};

	stencil.cache = {};

	stencil.defaults = {
		uri:   '',   /* Filename or url */
		src:   '',   /* Source template string */
		start: '<?', /* Start tag in the template */
		stop:  '?>', /* Stop tag in the template */
		echo:  '-',  /* Suffix for echoing result of the expression */
		safe:  '=',  /* Suffix for echoing result of the expression html encoded */
		async: '!',  /* Suffix for async blocks, Output is still in document order */
		noevents: false, /* if true, the output code ignores events, callbacks and only returns synchonous template code */

		strict:    true,     /* start function with "use strict"; or wrap function in with */
		dataVar:   '$',      /* name of object parameter containing data mambers to use in execution */
		chunkVar:  '$$c',    /* name of function parameter called when each chunk is ready */
		doneVar:   '$$z',    /* name of function parameter called when output is complete */
		outputVar: '$$s',    /* name of string used to hold the output */
		safeVar:   'escape', /* name of function used to encode html characters */
		echoVar:   'print',  /* name of function used to output strings */
		asyncVar:  '$$a',    /* name of function used internally on async blocks */
		nextVar:   'next'    /* name of function to call when done with async block */
	};

	function translate(opts) {
		var fn, src = opts.src, s, i = 0,
			code, pre, post, inasyn = 0,

			$ = opts.dataVar, out = opts.outputVar,
			chunk = opts.chunkVar, done = opts.doneVar,
			esc = opts.safeVar, echo = opts.echoVar,
			asyn = opts.asyncVar, next = opts.nextVar,

			start = opts.start, startl = start.length,
			stopt = opts.stop,  stopl  = stopt.length,
			echot = opts.echo,  echol  = echot.length,
			safet = opts.safe,  safel  = safet.length,
			asynct = opts.async, asyncl = asynct.length;

		if (opts.strict) { fn = '"use strict";'; }
		else { fn = 'with(' + $ + '){'; }
		fn += out + '=';

		while (i >= 0) {
			// encode static chunk
			s = i; i = src.indexOf(start, i);
			fn += JSON.stringify(i < 0 ? src.slice(s) : src.slice(s, i))
				.replace(/\\t/g, '\t').replace(/((\\r)?\\n)/g, '$1"+\n"');

			// check for next chunk
			if (i < 0) { break; }

			// wrap javascript chunk
			s = (i += startl); i = src.indexOf(stopt, s);
			if (src.substr(s, safel) === safet) { // safe echo chunk
				s += safel; pre = '+'+esc+'('; post = ')+';
			} else if (src.substr(s, echol) === echot) { // echo chunk
				s += echol; pre = ';'+echo+'('; post = ');'+out+'+=';
			} else {
				if (src.substr(s, asyncl) === asynct) { // async funciton call chunk
					s += asyncl; pre = ';'+asyn+'(function(){'; ++inasyn;
				} else { // regular code chunk
					pre = ';';
				}
				if ((i < 0 && inasyn) || src.substr(i-asyncl, asyncl) === asynct) {
					post = '});'+out+'+='; --inasyn; i -= asyncl;
				} else {
					post = ';'+out+'+=';
				}
			}
			code = (i < 0 ? src.slice(s) : src.slice(s, i))
				.replace(/[;,](\s*(\/\*.*?\*\/)?\s*)$/, '$1');
			if (i > 0) { i = src.indexOf(stopt, i); } // in case we back-tracked for async
			fn += pre + code + post;
			if (i >= 0) {
				i += stopl;
				// skip newline directly following close tag
				if (src.charAt(i) === '\r') { ++i; fn += '\r'; }
				if (src.charAt(i) === '\n') { ++i; fn += '\n'; }
			} else {
				fn += '""';
			}
		}

		if (~fn.indexOf(asyn) && opts.noevents) { throw new Error('Async code cannot be eventless.'); }

		fn += ';\n';
		if (!opts.noevents) { fn += next+'();\n'; }
		fn += 'return ' + out + ';';
		if (!opts.strict) { fn += '\n}'; }
		fn += '\n\nvar '+out+';\n';

		if (~fn.indexOf(echo)) {
			fn += 'function '+echo+'() {\n' +
			'	'+out+' += Array.prototype.join.call(arguments, "");\n' +
			'}\n\n';
		}
		if (~fn.indexOf(esc)) {
			fn += 'function '+esc+'() {\n' +
			'	return Array.prototype.join.call(arguments, "").replace(/&/g, "&amp;")\n' +
			'		.replace(/</g, "&lt;").replace(/>/g, "&gt;")\n' +
			'		.replace(/"/g, "&#34;").replace(/\'/g, "&#39;");\n' +
			'}\n\n';
		}
		if (~fn.indexOf(asyn)) {
			fn += 'function '+asyn+'(fn) {\n' +
			'	fn.buffer = '+out+'; '+out+' = "";\n' +
			'	('+asyn+'.q || ('+asyn+'.q = [])).push(fn);\n' +
			'}\n\n' +
			'function '+next+'(err, str) {\n' +
			'	if (!'+done+') { '+done+' = '+chunk+' || function(){}; '+chunk+' = function(){}; }\n' +
			'	if (!'+chunk+') { '+chunk+' = function(){}; }\n' +
			'	if (err) { return '+done+'(err); }\n' +
			'	if (str) { '+out+' += str; }\n' +
			'	'+asyn+'.result = '+asyn+'.result || "";\n\n' +
			'	var fn = ('+asyn+'.q || []).shift();\n' +
			'	if (!fn) {\n' +
			'		if ('+asyn+'.started) { '+out+' += '+asyn+'.end || ""; }\n' +
			'		if ('+out+') { '+chunk+'('+out+'); }\n' +
			'		return '+done+'(null, '+out+' = ('+asyn+'.result += '+out+'));\n' +
			'	}\n' +
			'	if ('+asyn+'.started) {\n' +
			'		'+out+' += fn.buffer;\n' +
			'		if ('+out+') { '+chunk+'('+out+'); }\n' +
			'		'+asyn+'.result += '+out+'; '+out+' = "";\n' +
			'	} else {\n' +
			'		'+asyn+'.started = true;\n' +
			'		'+asyn+'.end = '+out+'; '+out+' = "";\n' +
			'		'+asyn+'.result = fn.buffer;\n' +
			'		if ('+asyn+'.result) { '+chunk+'('+asyn+'.result); }\n' +
			'	}\n' +
			'	return fn();\n' +
			'}\n';
		} else if (!opts.noevents) {
			fn += 'function '+next+'(err, str) {\n' +
			'	if (!'+done+') { '+done+' = '+chunk+' || function(){}; '+chunk+' = function(){}; }\n' +
			'	if (!'+chunk+') { '+chunk+' = function(){}; }\n' +
			'	if (err) { return '+done+'(err); }\n' +
			'	if (str) { '+out+' += str; }\n' +
			'	'+chunk+'('+out+');\n' +
			'	'+done+'(null, '+out+');\n' +
			'}\n';
		}

		return fn;
	}

	if ('function' === typeof define && define.amd) { define(function() { return stencil; }); } // amd
	else if ('undefined' === typeof exports) { global.stencil = stencil; } // browser, explicit global
	else if ('object' !== typeof module || !module.exports) { exports.stencil = stencil; } // commonjs
	else { module.exports = stencil; } // node
})(this);
