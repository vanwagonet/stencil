var http = require('http'),
	Url  = require('url'),
	sys  = require('sys'),
	Path = require('path'),

	Template = require('../src/Template').Template;


/**
 * Parse, execute, and send the requested file
 * @param {http.ServerRequest} request The request to handle
 * @param {http.ServerResponse} response The response to write to
 * @return The template used to respond to the request
 * @type Template
 **/
http.createServer(function handleRequest(request, response) {
	var started = false;

	var url = Url.parse(request.url, true),
		filename = Path.join(process.cwd(), url.pathname.replace(/\.\.+/g, '.'));

	var template = Template.getTemplateById(filename, {
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
			response.write(data, 'utf-8');
		},
		onend: function() {
			response.end();
			sys.log('Complete: ' + request.url);
		}
	});

	return template.exec(url.query || {});
}).listen(8000);

