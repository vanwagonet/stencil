var http = require('http'),
	ServerTemplate = require('../src/ServerTemplate').ServerTemplate;

ServerTemplate.root = '/path/to/stencil/examples';

http.createServer(ServerTemplate.handleRequest).listen(8000);

