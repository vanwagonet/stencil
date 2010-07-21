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
	Url      = require('url'),
	Path     = require('path'),

	DEFAULT_PATH = '/index.html',

	MT = '', UTF8 = 'utf-8', COMPLETE = 'end', ERROR = 'error',
	join = Array.prototype.join, slice = Array.prototype.slice;


/**
 * ServerTemplate constructor
 *  Sets up template properties,
 *  and connects to the request and response objects
 * @constructor
 * @extends Template
 * @version 0.1
 * @param {Object} o A hash of the settings to override
 * @return this
 * @type ServerTemplate
 **/
function ServerTemplate(o) {
	Template.apply(this, arguments);

	o = o || {}; // must be an object
	this.path     = o.path     || this.path;
	this.stat     = o.stat     || this.stat;

	return this;
}


/**
 * ServerTemplate prototype
 *  Sets up defaults for properties and attaches public methods
 *  Defaults can be changed by updating the prototype
 **/
ServerTemplate.prototype          = new Template();
/** The path to the template file input */
ServerTemplate.prototype.path     = DEFAULT_PATH;
/** The stat object populated when the template file is loaded */
ServerTemplate.prototype.stat     = null;
/** The constructor of the template */
ServerTemplate.prototype.self     = ServerTemplate;


/**
 * Turn input into executable JavaScript
 * @methodOf ServerTemplate.prototype
 * @param {Boolean} use_cached If true, prevents the template from recompiling
 * @param {Function} next Called when the code is ready to execute
 * @return this (the new code is in this.compiled)
 * @type ServerTemplate
 **/
function compile(use_cached, next) {
	// already compiled
	if (use_cached && this.compiled) {
		if (next) { next.call(this); }
		return this;
	}

	// already has template input
	if (this.input) {
		Template.prototype.compile.call(this, use_cached, next);
		return this;
	}

	// read input from file
	var template = this,
		file = Path.join(ServerTemplate.root, this.path.replace(/\.\.+/g, '.'));

	fs.stat(file, function(err, stat) {
		if (err) { template.dispatchEvent(ERROR, err); return; }

		template.stat = stat;
		fs.readFile(file, UTF8, function(err, input) {
			if (err) { template.dispatchEvent(ERROR, err); return; }

			// save input from file and compile
			template.input = input;
			Template.prototype.compile.call(template, use_cached, next);
		});
	});

	return this;
}
ServerTemplate.prototype.compile = compile;


/**
 * Get a ServerTemplate object from a file
 * @methodOf ServerTemplate
 * @param {String} id The filename to use for the template
 * @param {Object} settings A hash of settings (or ServerTemplate object)
 * @return The template created from the file's content
 * @type ServerTemplate
 **/
function getTemplateById(id, settings) {
	if (id[id.length - 1] === '/') { id += DEFAULT_PATH; }

	// populate template object
	var template   = new ServerTemplate(settings);
	template.input = MT;
	template.path  = id;

	return template;
}
ServerTemplate.getTemplateById = getTemplateById;


/**
 * Parse, execute, and send the requested file
 * @methodOf ServerTemplate
 * @param {http.ServerRequest} request The request to handle
 * @param {http.ServerResponse} response The response to write to
 * @return The template used to respond to the request
 * @type ServerTemplate
 **/
function handleRequest(request, response) {
	var started = false;

	var url = Url.parse(request.url, true);

	var template = ServerTemplate.getTemplateById(url.pathname, {
		onerror:  function(err) {
			if (!started) { // send error response if no response yet sent
				var code = (err.errno === process.ENOENT) ? 404 : 500;
				response.writeHead(code, { 'Content-Type': 'text/plain' });
				response.end();
			}
			sys.log(err);
		},
		onexec: function() {
			started = true;
			response.writeHead(200, {
			//	'Content-Type':      getMime(filename),
				'Last-Modified':     this.stat.mtime.toUTCString(),
				'Transfer-Encoding': 'chunked'
			});
		},
		ondata: function(data) {
			response.write(data, UTF8);
		},
		onend: function() {
			response.end();
			sys.log('Complete: ' + request.url);
		}
	});

	return template.exec(url.query || {});
}
ServerTemplate.handleRequest = handleRequest;
/** The root path to search for template files */
ServerTemplate.root = process.cwd();


// export the class
exports.ServerTemplate = ServerTemplate;

