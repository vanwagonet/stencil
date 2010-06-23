/*!
 * Stencil ServerTemplate v0.1
 *  Connect provider for Stencil Templates
 * Copyright(c) 2010 Andy VanWagoner
 * MIT Licensed
 **/

	// imports, constants, and shortcuts
var Template = require('./Template').Template,
	fs       = require('fs'),
	sys      = require('sys'),
	Path     = require('path'),

	DEFAULT_PATH = '/index.html',

	MT = '', UTF8 = 'utf-8', COMPLETE = 'complete', ERROR = 'error',
	join = Array.prototype.join, slice = Array.prototype.slice;


/**
 * ServerTemplate constructor
 *  Sets up template properties,
 *  and connects to the request and response objects
 * @param Object o A hash of the settings to override
 * @return ServerTemplate this
 **/
function ServerTemplate(o) {
	Template.apply(this, arguments);

	o = o || {}; // must be an object
	this.root     = o.root     || this.root;
	this.path     = o.path     || this.path;
	this.request  = o.request  || this.request;
	this.response = o.response || this.response;

	return this;
}


/**
 * Template prototype
 *  Sets up defaults for properties and attaches public methods
 *  Defaults can be changed by updating the prototype
 **/
ServerTemplate.prototype          = new Template();
ServerTemplate.prototype.root     = process.cwd();
ServerTemplate.prototype.path     = DEFAULT_PATH;
ServerTemplate.prototype.stat     = null;
ServerTemplate.prototype.request  = null;
ServerTemplate.prototype.response = null;


/**
 * Turn input into executable JavaScript
 * @param Boolean use_cached If true, prevents the template from recompiling
 * @param Function next Called when the code is ready to execute
 * @return ServerTemplate this (the new code is in this.compiled)
 **/
function compile(use_cached, next) {
	// already compiled
	if (use_cached && this.compiled) {
		if (next) { next.call(this); }
		return this;
	}

	// already has template input
	if (this.input) {
		Template.prototype.compile.call(t);
		if (next) { next.call(this); }
		return this;
	}

	// read input from file
	var template = this,
		file = Path.join(this.root, this.path.replace(/\.\.+/g, '.'));

	fs.stat(file, function(err, stat) {
		if (err) { template.dispatchEvent(ERROR, err); return; }

		template.stat = stat;
		fs.readFile(file, UTF8, function(err, input) {
			if (err) { template.dispatchEvent(ERROR, err); return; }

			// save input from file and compile
			template.input = input;
			Template.prototype.compile.call(template);
			if (next) { next.call(template); }
		});
	});

	return this;
}
ServerTemplate.prototype.compile = compile;


/**
 * Process the template given a data context
 * @param Object data The data context for the template
 *  data will be in scope in the template
 * @return ServerTemplate this
 **/
function exec(data) {
	data = data || {}; // must be an object
	this.compile(true, function() {
		// process result
		this.dispatchEvent('exec');
		return this.compiled.call(this, data);
	});
	return this;
}
ServerTemplate.prototype.exec = exec;


/**
 * Append the arguments to the template output
 * @params The arguments to be appended as strings
 * @return ServerTemplate this
 **/
function echo() {
	this.response.write(join.call(arguments, MT), UTF8);
	return this;
}
ServerTemplate.prototype.echo = echo;


/**
 * Execute the child template and append its output
 **/
function include(id, data, next) {
	var parent = this, child = ServerTemplate.getTemplateByFilename(id, parent);
	child.addEventListener(ERROR, function(err) {
		parent.dispatchEvent(ERROR, err);
		// continue processing parent
		return next.call(parent, data);
	}).addEventListener(COMPLETE, function() {
		return next.call(parent, data);
	});

	child.exec(data);
}
ServerTemplate.prototype.include = include;


/**
 * Get a ServerTemplate object from a file
 * @param String id The filename to use for the template
 * @param Object settings A hash of settings (or SereverTemplate object)
 * @return ServerTemplate the template created from the file's content
 **/
function getTemplateByFilename(id, settings) {
	if (id[id.length - 1] === '/') { id += DEFAULT_PATH; }

	// populate template object
	var template   = new ServerTemplate(settings);
	template.input = MT;
	template.path  = id;

	return template;
}
ServerTemplate.getTemplateByFilename = getTemplateByFilename;


/**
 * Parse, execute, and send the requested file
 * @param http.ServerRequest request The request to handle
 * @param http.ServerResponse response The response to write to
 * @return ServerTemplate The template used to respond to the request
 **/
function handleRequest(request, response) {
	var started = false;

	var template = ServerTemplate.getTemplateByFilename(request.url, {
		root:     ServerTemplate.root,
		request:  request,
		response: response,
		onerror:  function(err) {
			if (!started) { // send error response if no response yet sent
				var code = (err.errno === process.ENOENT) ? 404 : 500;
				this.response.writeHead(code, { 'Content-Type': 'text/plain' });
				this.response.end();
			}
			sys.log(err);
		},
		onexec: function() {
			started = true;
			this.response.writeHead(200, {
			//	'Content-Type':      getMime(filename),
				'Last-Modified':     this.stat.mtime.toUTCString(),
				'Transfer-Encoding': 'chunked'
			});
		},
		oncomplete: function() {
			this.response.end();
			sys.log('Complete: ' + request.url);
		}
	});

	return template.exec({});
}
ServerTemplate.handleRequest = handleRequest;
ServerTemplate.root = process.cwd();


// export the class
exports.ServerTemplate = ServerTemplate;

