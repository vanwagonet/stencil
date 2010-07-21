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

		TEMPLATE = 'template', OUTPUT = 'output',
		PARAMS   = [ TEMPLATE, OUTPUT, DATA ].join(),

		ECHO_START  = 'output.echo(',   ECHO_DONE = '\n);',
		STAT_START  = ECHO_START + "'", STAT_DONE = "');",

		ASYNC_START = '(function(){',
		ASYNC_CONT  = '\n})(output.pause(function(){',
		ASYNC_DONE  = '}))',

		NEST_START  = 'output.include(',
		NEST_CONT   = '\n,data,output.pause(function(){',

		// find & properly encode quotes & newlines
		QUOTE_RE    = /([^\\])?'/g, QUOTE_ESCAPED   = "$1\\'",
		NEWLINE_RE  = /(\r?\n)/g,   NEWLINE_ESCAPED = '\\\n',

		CALL_DONE   = "template.dispatchEvent('end')";


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
		this.echo  = o.echo  || this.echo;
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
			else if (value && toString(value) === ar) { handlers[i] = value; }
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
	Template.prototype.echo = '=';
	/** The tag suffix for including the template identified
	 *  by the result of the expression */
	Template.prototype.nest = '#';
	/** The tag suffix for async blocks, after which
	 *  any execution is paused, and only resumed by calling resume() */
	Template.prototype.async = '!';
	/** The function compiled from the template text */
	Template.prototype.compiled = null;
	/** The constructor of the template */
	Template.prototype.self = Template;

	/** @private used internally to store event handlers */
	Template.prototype.handlers = { compiled: [], end: [], exec: [], error: [], data: [] };
	
	/** Returns input, which is the string representation of the template */
	Template.prototype.toString = function toString() { return this.input; };


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
	 * @param {Function} next Called when the code is ready to execute
	 * @return this (the new code is in this.compiled)
	 * @type Template
	 **/
	function compile(use_cached, next) {
		// already compiled
		if (use_cached && this.compiled) {
			if (next) { next.call(this); }
			return this;
		}

		var s, i = 0, n = 0, // start, end, nested template count
			fn    = MT, // resulting script
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
			s = (i += startl);
			if (src.substr(s, echol) === echot) {
				// echo chunk
				s  += echol; i = src.indexOf(stopt, s);
				fn += ECHO_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += ECHO_DONE;
			} else if (src.substr(s, nestl) === nest) {
				// nest template chunk
				s  += nestl; i = src.indexOf(stopt, s); ++n;
				fn += NEST_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += NEST_CONT;
			} else if (src.substr(s, asyncl) === async) {
				// async funciton call chunk
				s  += asyncl; i = src.indexOf(stopt, s); ++n;
				fn += ASYNC_START;
				fn += (i < 0 ? src.substr(s) : src.substring(s, i));
				fn += ASYNC_CONT;
			} else {
				// regular code chunk
				i   = src.indexOf(stopt, s);
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
		if (next) { next.call(this); }
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
		this.compile(true, function process() {
			// process result
			this.dispatchEvent('exec');
			this.compiled(this, new Output(this), data);
		});
		return this;
	}
	Template.prototype.exec = exec;


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


	/**
	 * Template.Output constructor
	 *  Sets up template properties
	 * @constructor
	 * @param {Template} template The template the output comes from
	 **/
	function Output(template) { this.template = template; }
	Template.Output = Output;


	/**
	 * Template prototype
	 *  Sets up defaults for properties and attaches public methods
	 *  Defaults can be changed by updating the prototype
	 **/
	Output.prototype = {};
	/** The template the output belongs to */
	Output.prototype.template = null;


	/**
	 * Continue template execution
	 * @methodOf Template.Output.prototype
	 **/
	function resume() {}
	Output.prototype.resume = resume;


	/**
	 * Appends all the arguments to the Output
	 * @methodOf Template.Output.prototype
	 * @return this
	 * @type Template.Output
	 **/
	function echo() {
		var data = Array.prototype.join.call(arguments, MT);
		if (data) { this.template.dispatchEvent(DATA, data); }
		return this;
	}
	Output.prototype.echo = echo;


	/**
	 * Execute the child template and append its output
	 * @methodOf Template.Output.prototype
	 * @param {String} id The identifier for the nested template
	 * @param {Object} data The data context for the nest template
	 * @return this
	 * @type Template.Output
	 **/
	function include(id, data) {
		var out = this, tmpl = this.template,
			child = tmpl.self.getTemplateById(id, tmpl);
		child.addEventListener(DATA, function(data) {
			tmpl.dispatchEvent(DATA, data);
		});
		child.addEventListener('error', function(err) {
			tmpl.dispatchEvent('error', err);
			out.resume(); // continue processing parent
		});
		child.addEventListener('end', this.resume);
		child.exec(data);
		return this;
	}
	Output.prototype.include = include;


	/**
	 * Pause execution and bind the continuation to resume
	 * @methodOf Template.Output.prototype
	 * @param {Function} fn The template continuation
	 **/
	function pause(fn) {
		var out = this;
		out.resume = function resume() { fn(); out.resume = resume; };
		return;
	}
	Output.prototype.pause = pause;


	// attach to namespace or exports (in IE this.window === window is false)
	if (this.window && this.window == window) { window.Template = Template; }
	else { exports.Template = Template; }
	return Template;
})();

