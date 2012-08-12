var http = require('http'),
	url = require('url'),
	path = require('path'),

	stencil = require('../stencil');

http.createServer(function handleRequest(request, response) {
	var rurl = url.parse(request.url, true),
		filename = path.join(process.cwd(), rurl.pathname.replace(/\.\.+/g, '.'));

	stencil({ id:filename }, rurl.query, function(err, data) {
		if (err) {
			response.statusCode = (err.code === 'ENOENT') ? 404 : 500;
			console.error(err);
		} else {
			response.statusCode = 200;
			response.write(data || '', 'utf-8');
			console.log('Complete: ' + request.url);
		}
		response.end();
	});
}).listen(8000);

