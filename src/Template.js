/*! Stencil Template v0.4
 *  Async templating for JavaScript
 * Copyright(c) 2010 Andy VanWagoner
 * MIT licensed **/
(function() {
		// mortar between template chunks
	var MT = '',  ERROR = 'error', NEST = 'include',
		NL = '\n', DATA = 'data',  UTF8 = 'utf-8',
		CR = '\r', ECHO = 'echo',   END = 'end',

		TEMPLATE = 'template', OUTPUT = 'output',
		PARAMS   = [ TEMPLATE, OUTPUT, DATA ].join(),

		ECHO_START  = 'output.echo(',   ECHO_DONE = '\n);',
		STAT_START  = ECHO_START + "'", STAT_DONE = "');",

		NEST_START  = 'output.include(', NEST_CONT = '\n,data,output.pause(function(){',
		ASYNC_START = '(function(){',   ASYNC_CONT = '\n})(output.pause(function(){',
		ASYNC_DONE  = '}))',              CALL_END = "output.dispatchEvent('end')",

		// find & properly encode quotes & newlines
		QUOTE_RE    = /([^\\])?'/g, QUOTE_ESCAPED = "$1\\'",
		NEWLINE_RE  = /(\r?\n)/g, NEWLINE_ESCAPED = '\\n',

		// make data members "global"
		CONTEXT_START = 'with(data){', CONTEXT_END = '}',

		// assume CommonJS if the global is not a window
		browser = this.window && this.window == window, // in IE this.window === window is false
		fs      = !browser && require('fs');


	/** Sets up template properties
	 * @param {Object} o A hash of the settings to override **/
	function Template(o) {
		o = o || {};
		this.id    = o.id    || this.id;
		this.stat  = o.stat  || this.stat;
		this.input = o.input || this.input;
		return this;
	}

	Template.prototype = {
		id:    null, /** Identifier for the template (filename, or dom id) */
		stat:  null, /** Stat object populated when the template file is loaded */
		input: MT,   /** Template text to process */
		start: '<?', /** Start tag in the template */
		stop:  '?>', /** Stop tag in the template */
		echo:  '=',  /** Suffix for echoing result of the expression */
		nest:  '#',  /** Suffix for including the template identified by the result of the expression */
		async: '!',  /** Suffix for async blocks, after which any execution is paused, and only resumed by calling output.resume() */

		error:    null, /** An error that occurred when compiling */
		compiled: null, /** The function compiled from the template text */
		toString: function toString() { return this.input; } /** Returns string representation of the template */
	};


	/** @private input to function conversion */
	function compile_fn(next) {
		var s, i = 0, n = 0, // start, end, nested template count
			fn    = CONTEXT_START, // resulting script
			src   = this.input, // cache vars used in loop
			start = this.start, startl = start.length,
			stopt = this.stop,  stopl  = stopt.length,
			echot = this.echo,  echol  = echot.length,
			nest  = this.nest,  nestl  = nest.length,
			async = this.async, asyncl = async.length;

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
			if (src.substr(s, echol) === echot) {
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

		fn += CONTEXT_END;

		// compile and cache resulting script as a function
		this.compiled = new Function(PARAMS, fn);
		if (next) { next.call(this); }
		return this;
	}


	/** Turn input into executable JavaScript
	 * @param {Function} next Called when the code is ready to execute
	 * @return {Template} this (the new code is in this.compiled) **/
	function compile(next) {
		// already compiled
		if (this.compiled) { if (next) { next.call(this); } return this; }

		// already has template input
		if (this.input) { return compile_fn.call(this, next); }

		// get input from dom id
		if (browser && document.getElementById(this.id)) {
			this.input = document.getElementById(this.id).innerHTML
				.replace(/^\s*<!\[CDATA\[\r?\n?|\r?\n?\]\]>\s*$/g, MT);
			return compile_fn.call(this, next);
		}

		// TODO: get input from url
		if (browser) { return this; }

		// read input from file
		var template = this;
		fs.stat(template.id, function(err, stat) {
			if (err) { if (next) { next.call(this, err); } return; }
			template.stat = stat;
			return fs.readFile(template.id, UTF8, function(err, input) {
				if (err) { if (next) { next.call(this, err); } return; }
				template.input = input;
				return compile_fn.call(template, next);
			});
		});

		return this;
	} Template.prototype.compile = compile;


	/** Process the template given a data context
	 * @param {Object} data The data context for the template
	 * @param {Object|Function} handle All the event handlers for the output process
	 * @return {Template} this **/
	function exec(data, handle) {
		data = data || {}; // must be an object
		return this.compile(function process(err) {
			var out = new Output(this, handle), fn = this.compiled;
			return fn ? fn(this, out, data) : out.dispatchEvent(ERROR, err);
		});
	} Template.prototype.exec = exec;


	/** Sets up template properties
	 * @param {Template} template The template the output comes from
	 * @param {Object|Function} handle All the event handlers for the output process **/
	function Output(template, handle) {
		this.template = template;

		// shortcuts for type detection
		var toString = Object.prototype.toString,
			ar = '[object Array]', fn = 'function';

		// add any event handlers specified
		handle = handle || {};
		var events = this.handlers, handlers = {}, value;
		for (var i in events) {
			value = handle['on' + i];
			if (typeof(value) === fn) { handlers[i] = [ value ]; }
			else if (value && toString(value) === ar) { handlers[i] = value; }
			else { handlers[i] = []; }
		}
		this.handlers = handlers;

		// allow handle to be function(error, output)
		if (typeof handle === fn) {
			var buffer = [], b_len = 0;
			handlers.error.push(fn);
			handlers.data.push(function(data) { buffer[b_len++] = data; });
			handlers.end.push(function() { fn.call(this, null, buffer.join(MT)); });
		}
	}

	(Template.Output = Output).prototype = {
		template:null,
		handlers:{ data:[], end:[], error:[] } /** @private */
	};


	/** Continue template execution **/
	function resume() {} Output.prototype.resume = resume;


	/** Appends all the arguments to the Output
	 * @return {Template.Output} this **/
	function echo() {
		var data = Array.prototype.join.call(arguments, MT);
		if (data) { this.dispatchEvent(DATA, data); }
		return this;
	} Output.prototype.echo = echo;


	/** Execute the child template and append its output
	 * @param {String} id The identifier for the nested template
	 * @param {Object} data The data context for the nest template
	 * @return {Template.Output} this **/
	function include(id, data) {
		var out = this, child = new Template({ id:id });
		return child.exec(data, {
			ondata:function ondata(data)  {
				out.dispatchEvent(DATA, data);
			},
			onerror:function onerror(err) {
				out.dispatchEvent(ERROR, err);
				out.resume(); // continue processing parent
			},
			onend:this.resume
		});
	} Output.prototype.include = include;


	/** Pause execution and bind the continuation to resume
	 * @param {Function} fn The template continuation **/
	function pause(fn) {
		var out = this;
		out.resume = function resume() { fn(); out.resume = resume; };
		return out;
	} Output.prototype.pause = pause;


	/** Add a function to execute on an event
	 * @param {String} event The name of the event the function handles
	 * @param {Function} fn The handler to execute on the event
	 * @return {Template.Output} this **/
	function addEventListener(event, fn) {
		if (!this.handlers[event]) { return; }
		this.handlers[event].push(fn);
		return this;
	} Output.prototype.addEventListener = addEventListener;


	/** Remove a handler from firing on an event
	 * @param {String} event The name of the event the function handles
	 * @param {Function} fn The handler to remove from the event
	 * @return {Template.Output} this **/
	function removeEventListener(event, fn) {
		if (!this.handlers[event]) { return; }
		var a = this.handlers[event], i = a.length;
		while (i--) { if (a[i] === fn) { a = a.splice(i, 1); } }
		this.handlers[event] = a;
		return this;
	} Output.prototype.removeEventListener = removeEventListener;


	/** Execute all handlers for the specified event
	 * @param {String} event The name of the event
	 * @return {Template.Output} this **/
	function dispatchEvent(event) {
		if (!this.handlers[event]) { return; }
		var args = Array.prototype.slice.call(arguments, 1),
			a = this.handlers[event], l = a.length;
		for (var i = 0; i < l; ++i) { a[i].apply(this, args); }
		return this;
	} Output.prototype.dispatchEvent = dispatchEvent;


	// attach to namespace or exports
	return ((browser ? window : exports).Template = Template);
})();
