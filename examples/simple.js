var http = require('http'),
	Url  = require('url'),
	sys  = require('sys'),
	Path = require('path'),

	Template = require('../src/Template').Template;


/** Parse, execute, and send the requested file
 * @param {http.ServerRequest} request The request to handle
 * @param {http.ServerResponse} response The response to write to
 * @return {Template} The template used to respond to the request **/
http.createServer(function handleRequest(request, response) {
	var started = false;

	var url = Url.parse(request.url, true),
		filename = Path.join(process.cwd(), url.pathname.replace(/\.\.+/g, '.'));

	return (new Template({ id:filename })).exec(url.query || {}, {
		onerror:  function(err) {
			if (!started) { // send error response if no response yet sent
				var code = (err.errno === process.ENOENT) ? 404 : 500;
				response.writeHead(code, { 'Content-Type': 'text/plain' });
				response.end();
			}
			sys.log(err);
		},
		ondata: function(data) {
			if (!started) {
				started = true;
				response.writeHead(200, {
				//	'Content-Type':      getMime(filename),
					'Last-Modified':     this.template.stat.mtime.toUTCString(),
					'Transfer-Encoding': 'chunked'
				});
			}
			response.write(data, 'utf-8');
		},
		onend: function() {
			response.end();
			sys.log('Complete: ' + request.url);
		}
	});
}).listen(8000);

