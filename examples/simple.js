var http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),

	stencil = require('../stencil');

http.createServer(function handleRequest(request, response) {
	var rurl = url.parse(request.url, true), content,
		filename = path.join(process.cwd(), rurl.pathname.replace(/\.\.+/g, '.'));

	try { content = fs.readFileSync(filename, 'utf-8'); }
	catch (err) {
		response.statusCode = (err.code === 'ENOENT') ? 404 : 500;
		console.error(err);
		response.end();
		return;
	}
	stencil({ id:filename, src:content }, rurl.query, function(err, data) {
		response.statusCode = 200;
		response.write(data || '', 'utf-8');
		console.log('Complete: ' + request.url);
		response.end();
	});
}).listen(8000);

