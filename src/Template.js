/*!
 * Stencil Template v0.1
 *  Async templating for JavaScript
 * Copyright(c) 2010 Andy VanWagoner
 * MIT licensed
 **/
(function() {
		// mortar between template chunks
	var MT    = '',     NL   = '\n',      CR   = '\r',
		ECHO  = 'echo', NEST = 'include', DATA = 'data',

		PARAMS = DATA,

		ECHO_START  = 'this.' + ECHO + '(', ECHO_DONE = ');',
		STAT_START  = ECHO_START + "'",     STAT_DONE = "');",

		ASYNC_START = '(function(resume){',
		ASYNC_CONT  = '})(this.bind(function(' + PARAMS + '){',
		ASYNC_DONE  = '},this,arguments))',

		NEST_START  = 'this.' + NEST + '(',
		NEST_CONT   = ',data,this.bind(function(' + PARAMS + '){',

		// find & properly encode quotes & newlines
		QUOTE_RE    = /([^\\])?'/g, QUOTE_ESCAPED   = "$1\\'",
		NEWLINE_RE  = /(\r?\n)/g,   NEWLINE_ESCAPED = '\\\n',

		CALL_DONE   = "this.dispatchEvent('complete')";


	/**
	 * Template constructor
	 *  Sets up template properties
	 * @constructor
	 * @version 0.1
	 * @param {Object} o A hash of the settings to override
	 **/
	function Template(o) {
		o = o || {};
		// default to prototype values
		this.input = o.input || this.input;
		this.start = o.start || this.start;
		this.stop  = o.stop  || this.stop;
		this.send  = o.send  || this.send;
		this.nest  = o.nest  || this.nest;
		this.async = o.async || this.async;

		// shortcuts for type detection
		var toString = Object.prototype.toString,
			ar = '[object Array]', fn = 'function';

		// add any event handlers specified
		var events = this.handlers, handlers = {}, value;
		for (var i in events) {
			value = o['on' + i];
			if (typeof(value) === fn) { handlers[i] = [ value ]; }
			else if (toString(value) === ar) { handlers[i] = value; }
			else { handlers[i] = []; }
		}
		this.handlers = handlers;

		return this;
	}


	/**
	 * Template prototype
	 *  Sets up defaults for properties and attaches public methods
	 *  Defaults can be changed by updating the prototype
	 **/
	Template.prototype = {};
	/** The template text to process */
	Template.prototype.input = MT;
	/** The code start tag in the template */
	Template.prototype.start = '<?';
	/** The code stop tag in the template */
	Template.prototype.stop = '?>';
	/** The tag suffix for echoing result of the expression */
	Template.prototype.send = '=';
	/** The tag suffix for including the template identified
	 *  by the result of the expression */
	Template.prototype.nest = '#';
	/** The tag suffix for async blocks, after which
	 *  any execution is paused, and only resumed by calling resume() */
	Template.prototype.async = '!';
	/** The function compiled from the template text */
	Template.prototype.compiled = null;
	/** The resulting output from executing the template */
	Template.prototype.output = null;

	// used internally to store event handlers
	Template.prototype.handlers = { compiled: [], complete: [], exec: [], error: [] };


	/**
	 * Add a function to execute on an event
	 * @methodOf Template.prototype
	 * @param {String} event The name of the event the function handles
	 * @param {Function} fn The handler to execute on the event
	 * @return this
	 * @type Template
	 **/
	function addEventListener(event, fn) {
		if (!this.handlers[event]) { return; }
		this.handlers[event].push(fn);
		return this;
	}
	Template.prototype.addEventListener = addEventListener;


	/**
	 * Remove a handler from firing on an event
	 * @methodOf Template.prototype
	 * @param {String} event The name of the event the function handles
	 * @param {Function} fn The handler to remove from the event
	 * @return this
	 * @type Template
	 **/
	function removeEventListener(event, fn) {
		if (!this.handlers[event]) { return; }
		var a = this.handlers[event], i = a.length;
		while (i--) { if (a[i] === fn) { a = a.splice(i, 1); } }
		this.handlers[event] = a;
		return this;
	}
	Template.prototype.removeEventListener = removeEventListener;


	/**
	 * Execute all handlers for the specified event
	 * @methodOf Template.prototype
	 * @param {String} event The name of the event
	 * @return this
	 * @type Template
	 **/
	function dispatchEvent(event) {
		if (!this.handlers[event]) { return; }
		var args = Array.prototype.slice.call(arguments, 1),
			a = this.handlers[event], l = a.length;
		for (var i = 0; i < l; ++i) { a[i].apply(this, args); }
		return this;
	}
	Template.prototype.dispatchEvent = dispatchEvent;


	/**
	 * Turn input into executable JavaScript
	 * @methodOf Template.prototype
	 * @param {Boolean} use_cached If true, prevents the template from recompiling
	 * @return this (the new code is in this.compiled)
	 * @type Template
	 **/
	function compile(use_cached) {
		if (use_cached && this.compiled) { return this; }

		var s, i = 0, n = 0, // start, end, nested template count
			fn    = MT, // resulting script
			src   = this.input, // cache vars used in loop
			start = this.start, startl = start.length,
			stop  = this.stop,  stopl  = stop.length,
			send  = this.send,  sendl  = send.length,
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
			s = (i += startl);
			if (src.substr(s, sendl) === send) {
				// echo chunk
				s  += sendl; i = src.indexOf(stop, s);
				fn += ECHO_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += ECHO_DONE;
			} else if (src.substr(s, nestl) === nest) {
				// nest template chunk
				s  += nestl; i = src.indexOf(stop, s); ++n;
				fn += NEST_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += NEST_CONT;
			} else if (src.substr(s, asyncl) === async) {
				// async funciton call chunk
				s  += asyncl; i = src.indexOf(stop, s); ++n;
				fn += ASYNC_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += ASYNC_CONT;
			} else {
				// regular code chunk
				i   = src.indexOf(stop, s);
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
		fn += CALL_DONE;

		// close async template callbacks
		while (n--) { fn += ASYNC_DONE; }

		// compile & cache resulting script as a function
		this.compiled = new Function(PARAMS, fn);
		this.dispatchEvent('compiled');
		return this;
	}
	Template.prototype.compile = compile;


	/**
	 * Process the template given a data context
	 * @methodOf Template.prototype
	 * @param {Object} data The data context for the template
	 *  data will be in scope in the template
	 * @return this
	 * @type Template
	 **/
	function exec(data) {
		data = data || {}; // must be an object
		this.compile(true); // compile if necessary

		// process result
		this.output = MT;
		this.dispatchEvent('exec');
		this.compiled.call(this, data);
		return this;
	}
	Template.prototype.exec = exec;


	/**
	 * Appends all the arguments to the template output
	 * @methodOf Template.prototype
	 * @return this
	 * @type Template
	 **/
	function echo() {
		this.output += Array.prototype.join.call(arguments, MT);
		return this;
	}
	Template.prototype.echo = echo;


	/**
	 * Execute the child template and append its output
	 * @methodOf Template.prototype
	 * @param {String} id The identifier for the nested template
	 * @param {Object} data The data context for the nest template
	 * @param {Function} next The continuation after the nested template
	 * @return this
	 * @type Template
	 **/
	function include(id, data, next) {
		// if more args are passed in, the last is the continuation
		// this can happen if the user passes in custom data for the child
		if (arguments.length > 3) { next = arguments[arguments.length - 1]; }

		var parent = this, child = Template.getTemplateById(id, parent);
		child.addEventListener('complete', function() {
			parent.output += child.output;
			next.call(parent, data);
		});
		child.exec(data);
		return this;
	}
	Template.prototype.include = include;


	/**
	 * Create a callback with the correct context
	 *  Used internally for async tags
	 * @methodOf Template.prototype
	 * @param {Function} fn The function to wrap
	 * @param {Object} scope The 'this' to use inside fn
	 * @param {Arguments} args The arguments passed to fn when called
	 * @return The function wrapped with the scope and arguments
	 * @type Function
	 **/
	function bind(fn, scope, args) {
		return function() { return fn.apply(scope, args); };
	}
	Template.prototype.bind = bind;


	/**
	 * Get a Template object from a DOM Element
	 * @methodOf Template
	 * @param {String} id The identifier for the DOM Element
	 * @param {Object} settings A hash of Template settings (or Template object)
	 * @return The template created from the Element's content
	 * @type Template
	 **/
	function getTemplateById(id, settings) {
		// populate template object, strip surrounding CDATA
		var template = new Template(settings);
		template.input = document.getElementById(id).innerHTML
			.replace(/^\s*<!\[CDATA\[\r?\n?|\r?\n?\]\]>\s*$/g, MT);
		return template;
	}
	Template.getTemplateById = getTemplateById;


	// attach to namespace or exports (in IE this.window === window is false)
	if (this.window && this.window == window) { window.Template = Template; }
	else { exports.Template = Template; }
	return Template;
})();

